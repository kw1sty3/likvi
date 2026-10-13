import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import RAPIER from '@dimforge/rapier3d-compat'
import { createArenaCollisionRoot, makeWorldData } from '../src/physics/arena.js'
import { createStaticCollisionWorld, raycastSurface } from '../src/physics/staticCollisionWorld.js'
import { ARENA_VERSION, RACE_RINGS } from '../src/physics/raceRules.js'
import { createServerRace, validateInput } from '../server/simulation.js'
import { createPhysicsServer } from '../server/httpServer.js'
import { createResultStore } from '../server/resultStore.js'
import { useSimulatorStore } from '../src/store/useSimulatorStore.js'
import { pilotKeys } from './helpers/autopilot.js'

await RAPIER.init()
const arena = createArenaCollisionRoot()
const collisionIndex = createStaticCollisionWorld(arena.root)
arena.dispose()
after(() => collisionIndex.dispose())
const near = (a, b, epsilon = 0.001) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`)

test('trusted arena contains buildings, roofs, trees, lights, rocks and exact river geometry', () => {
  assert.ok(collisionIndex.solid.triangleCount > 100000)
  assert.ok(collisionIndex.water.triangleCount > 0)
  const house = makeWorldData().buildings.find(building => building.lowHouse)
  const hit = raycastSurface(collisionIndex.solid, { x: house.position[0], y: 100, z: house.position[2] }, { x: 0, y: -1, z: 0 })
  assert.ok(hit.point.y > house.size[1], 'the roof is a collider too')
  const second = createArenaCollisionRoot()
  const repeat = createStaticCollisionWorld(second.root)
  try {
    assert.deepEqual(repeat.solid.geometry.attributes.position.array, collisionIndex.solid.geometry.attributes.position.array)
    assert.deepEqual(repeat.water.geometry.attributes.position.array, collisionIndex.water.geometry.attributes.position.array)
  } finally { repeat.dispose(); second.dispose() }
})

test('protocol rejects coordinate, time and score injection, malformed keys and sequence numbers', () => {
  for (const message of [null, [], { seq: 1, keys: [], position: { x: 0, y: 0, z: -112 } },
    { seq: 1, keys: [], score: 999999 }, { seq: 1, keys: [], dt: 10 },
    { seq: NaN, keys: [] }, { seq: 1.5, keys: [] }, { seq: -1, keys: [] },
    { seq: 1, keys: ['KeyQ', 'KeyQ'] }, { seq: 1, keys: ['Teleport'] }, { seq: 1, keys: 'KeyQ' }]) {
    assert.throws(() => validateInput(message))
  }
  assert.doesNotThrow(() => validateInput({ seq: 1, keys: ['KeyQ', 'KeyW'] }))
})

test('input floods never advance server time, replayed packets cannot replace newer controls', () => {
  const race = createServerRace(RAPIER, null)
  try {
    for (let seq = 1; seq <= 1000; seq++) race.acceptInput({ seq, keys: ['KeyQ'] }, 0)
    assert.equal(race.snapshot().tick, 0)
    near(race.snapshot().position.y, 0.86)
    assert.throws(() => race.acceptInput({ seq: 1000, keys: [] }, 0), error => error.status === 409)
    for (let i = 0; i < 300; i++) { race.acceptInput({ seq: 1001 + i, keys: ['KeyQ'] }, i * 1000 / 60); race.step(i * 1000 / 60) }
    assert.equal(race.snapshot().status, 'countdown')
    assert.equal(race.snapshot().controls.throttle, 0)
    race.step(5000)
    assert.equal(race.snapshot().status, 'running')
    near(race.snapshot().controls.throttle, 0.65 / 60)
  } finally { race.dispose() }
})

test('lost input aborts and freezes a race; later packets cannot revive or finish it', () => {
  const race = createServerRace(RAPIER, null, { countdownTicks: 0 })
  try {
    race.acceptInput({ seq: 1, keys: ['KeyQ'] }, 0)
    for (let i = 0; i < 150; i++) race.step(i * 1000 / 60)
    assert.equal(race.snapshot().status, 'aborted')
    const stopped = race.snapshot()
    race.acceptInput({ seq: 2, keys: ['KeyQ'] }, 3000)
    race.step(3000)
    assert.deepEqual(race.snapshot().position, stopped.position)
    assert.equal(race.snapshot().raceElapsedMs, stopped.raceElapsedMs)
    assert.equal(race.snapshot().result, null)
  } finally { race.dispose() }
})

test('server detects a real hard landing and prevents any result after the crash', () => {
  const race = createServerRace(RAPIER, collisionIndex, { countdownTicks: 0 })
  try {
    for (let i = 0; i < 1000; i++) {
      race.acceptInput({ seq: i + 1, keys: i < 75 ? ['KeyQ'] : ['KeyE'] }, i * 1000 / 60)
      race.step(i * 1000 / 60)
      if (race.snapshot().status === 'crashed') break
    }
    assert.equal(race.snapshot().status, 'crashed')
    assert.equal(race.snapshot().crashInfo.reason, 'Жёсткая посадка')
    assert.equal(race.snapshot().result, null)
    near(race.snapshot().velocity.y, 0)
  } finally { race.dispose() }
})

test('the full server-owned route can be completed on the real arena using only key commands', () => {
  const race = createServerRace(RAPIER, collisionIndex, { countdownTicks: 0 })
  try {
    const visited = new Set()
    for (let i = 0; i < 6000 && !['finished', 'crashed', 'aborted'].includes(race.snapshot().status); i++) {
      const snapshot = race.snapshot()
      visited.add(snapshot.activeRingIndex)
      // First step exits the zero-length test countdown.
      race.acceptInput({ seq: i + 1, keys: pilotKeys(snapshot) }, i * 1000 / 60)
      race.step(i * 1000 / 60)
    }
    const finish = race.snapshot()
    assert.equal(finish.status, 'finished', JSON.stringify(finish))
    assert.deepEqual([...visited], [0, 1, 2, 3, 4])
    assert.equal(finish.result.ringsPassed, RACE_RINGS.length)
    assert.equal(finish.result.verifiedBy, 'server')
    assert.ok(finish.result.timeMs > 30000 && finish.result.timeMs < 90000)
    for (let i = 0; i < 120; i++) race.step(120000)
    assert.deepEqual(race.snapshot().result, finish.result)
  } finally { race.dispose() }
})

async function fixture(options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'likvi-server-test-'))
  let now = 0
  const resultPath = join(dir, 'results.json')
  const app = await createPhysicsServer({ resultPath, collisionIndex, autoTick: false, clock: () => now, ...options })
  const address = await app.listen(0)
  const base = `http://127.0.0.1:${address.port}/api/physics/`
  async function request(path, method = 'GET', body, token, extraHeaders = {}) {
    const response = await fetch(base + path, { method, headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extraHeaders
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    return { status: response.status, data: await response.json() }
  }
  return { app, request, resultPath,
    async session() { const response = await request('session', 'POST', { protocol: 1, arenaVersion: ARENA_VERSION }); assert.equal(response.status, 201); return response.data },
    advance(ms) { now += ms; app.pump() },
    async dispose() { await app.close(); await rm(dir, { recursive: true, force: true }) }
  }
}

test('HTTP enforces session ownership, schema/version checks and no client result submissions', async () => {
  const f = await fixture()
  try {
    assert.equal((await f.request('health')).status, 200)
    assert.equal((await f.request('session', 'POST', { protocol: 1, arenaVersion: 'wrong' })).status, 409)
    assert.equal((await f.request('session', 'POST', { protocol: 1, arenaVersion: ARENA_VERSION }, null, { Origin: 'https://foreign.example' })).status, 403)
    const a = await f.session(), b = await f.session()
    assert.notEqual(a.token, b.token)
    assert.equal((await f.request('input', 'POST', { seq: 1, keys: [] }, 'forged')).status, 401)
    assert.equal((await f.request('input', 'POST', { seq: 1, keys: [], score: 999999 }, a.token)).status, 400)
    assert.equal((await f.request('input', 'POST', { padding: 'x'.repeat(3000) }, a.token)).status, 413)
    assert.equal((await f.request('input', 'POST', { seq: 1, keys: ['KeyQ'] }, a.token)).status, 200)
    assert.equal((await f.request('input', 'POST', { seq: 1, keys: [] }, a.token)).status, 409)
    assert.equal((await f.request('results', 'POST', { score: 999999 }, a.token)).status, 404)
    assert.deepEqual((await f.request('results')).data.results, [])
    await f.request('session', 'DELETE', undefined, a.token)
    assert.equal((await f.request('input', 'POST', { seq: 2, keys: [] }, a.token)).status, 401)
    assert.equal((await f.request('input', 'POST', { seq: 1, keys: [] }, b.token)).status, 200)
  } finally { await f.dispose() }
})

test('HTTP finish is persisted once and survives server restart; only server ticks move the drone', async () => {
  const f = await fixture({ raceOptions: { countdownTicks: 0 } })
  try {
    const { token, snapshot } = await f.session()
    let state = snapshot
    for (let seq = 1; seq < 6000 && state.status !== 'finished'; seq++) {
      const response = await f.request('input', 'POST', { seq, keys: pilotKeys(state) }, token)
      assert.equal(response.status, 200)
      state = response.data
      assert.notEqual(state.status, 'crashed', JSON.stringify(state.crashInfo))
      f.advance(1000 / 60)
    }
    assert.equal(state.status, 'finished')
    // Wait for the atomic file replacement, without advancing simulated physics.
    for (let i = 0; i < 100; i++) {
      const list = (await f.request('results')).data.results
      if (list.length) break
      await new Promise(resolve => setTimeout(resolve, 5))
    }
    const saved = JSON.parse(await readFile(f.resultPath, 'utf8'))
    assert.equal(saved.length, 1)
    assert.equal(saved[0].id, state.result.id)
    assert.equal(saved[0].verifiedBy, 'server')
    const reopened = await createResultStore(f.resultPath)
    assert.deepEqual(reopened.list(), saved)
    await reopened.save(saved[0])
    assert.equal(reopened.list().length, 1)
    await f.app.close()
    const restarted = await createPhysicsServer({ resultPath: f.resultPath, collisionIndex, autoTick: false })
    try {
      const address = await restarted.listen(0)
      const response = await fetch(`http://127.0.0.1:${address.port}/api/physics/results`)
      assert.deepEqual((await response.json()).results, saved)
    } finally { await restarted.close() }
  } finally { await f.dispose() }
})

test('server stall invalidates live attempts and abandoned sessions expire', async () => {
  const f = await fixture()
  try {
    const { token } = await f.session()
    f.advance(500)
    const response = await f.request('input', 'POST', { seq: 1, keys: [] }, token)
    assert.equal(response.data.status, 'aborted')
    assert.equal(response.data.result, null)
    f.advance(31000)
    assert.equal((await f.request('input', 'POST', { seq: 2, keys: [] }, token)).status, 401)
  } finally { await f.dispose() }
})

test('HTTP limits input floods without advancing simulation or damaging the session', async () => {
  const f = await fixture()
  try {
    const { token } = await f.session()
    for (let seq = 1; seq <= 120; seq++) {
      const response = await f.request('input', 'POST', { seq, keys: [] }, token)
      assert.equal(response.status, 200)
      assert.equal(response.data.tick, 0)
    }
    assert.equal((await f.request('input', 'POST', { seq: 121, keys: [] }, token)).status, 429)
    f.advance(100)
    assert.equal((await f.request('input', 'POST', { seq: 122, keys: [] }, token)).status, 200)
  } finally { await f.dispose() }
})

test('local scoring methods cannot finish a server race and reset starts a fresh connection', () => {
  useSimulatorStore.setState(useSimulatorStore.getInitialState(), true)
  const actions = useSimulatorStore.getState()
  actions.startServerRace()
  useSimulatorStore.setState({ competitionStatus: 'running' })
  actions.passActiveRing(); actions.finishRace(); actions.updateRaceElapsed(); actions.startRaceRun()
  assert.equal(useSimulatorStore.getState().activeRingIndex, 0)
  assert.equal(useSimulatorStore.getState().lastResult, null)
  assert.equal(useSimulatorStore.getState().leaderboard.length, 0)
  actions.serverFlightError('Disconnected')
  assert.equal(useSimulatorStore.getState().isFlying, false)
  actions.resetFlight()
  assert.equal(useSimulatorStore.getState().competitionStatus, 'connecting')
  assert.equal(useSimulatorStore.getState().serverError, null)
})
