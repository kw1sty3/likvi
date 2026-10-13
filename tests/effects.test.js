import test from 'node:test'
import assert from 'node:assert/strict'
import { BoxGeometry, Group, Mesh, PlaneGeometry, Vector3 } from 'three'
import { SpringValue } from '@react-spring/core'
import { createImpactEvent, createImpactParticles, impactSpring, sampleImpactParticles } from '../src/physics/impactEffects.js'
import { createImpactDecal, createImpactTexture } from '../src/physics/impactDecal.js'
import { useSimulatorStore } from '../src/store/useSimulatorStore.js'

const event = (extra = {}) => createImpactEvent({ reason: 'Столкновение с препятствием',
  normal: { x: 0, y: 0, z: 1 }, point: { x: 0, y: 0, z: 0.025 }, speed: 36, normalSpeed: 10, surface: 'obstacle', ...extra }, 1)

test('impact particles have identical positions at 30/60/120 FPS and expire after a long pause', () => {
  const buffers = [30, 60, 120].map(fps => {
    const particles = createImpactParticles(event())
    for (let i = 0; i <= fps / 2; i++) sampleImpactParticles(particles, i / fps)
    assert.ok(particles.positions.length <= 128 * 3)
    const positions = [...particles.positions]
    assert.equal(sampleImpactParticles(particles, 60), false)
    return positions
  })
  assert.deepEqual(buffers[0], buffers[1]); assert.deepEqual(buffers[1], buffers[2])
})

test('particles leave the struck surface and stay on its visible side for horizontal and vertical impacts', () => {
  for (const normal of [{ x: -1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }]) {
    const particles = createImpactParticles(event({ normal }))
    for (let i = 0; i < particles.velocities.length; i += 3) {
      assert.ok(new Vector3().fromArray(particles.velocities, i).dot(normal) > 0)
    }
    sampleImpactParticles(particles, 1.2)
    for (let i = 0; i < particles.positions.length; i += 3) {
      assert.ok(new Vector3().fromArray(particles.positions, i).dot(normal) >= -1e-6)
    }
  }
})

test('water has droplets while leaving the arena produces no fake collision particles or decal', () => {
  const water = event({ reason: 'Попадание в воду', normal: { x: 0, y: 1, z: 0 } })
  assert.equal(createImpactParticles(water).water, true)
  assert.equal(createImpactDecal(new Group(), water), null)
  const bounds = event({ reason: 'Выход за границы полигона' })
  assert.equal(createImpactParticles(bounds), null)
  assert.equal(createImpactDecal(new Group(), bounds), null)
  assert.equal(impactSpring(bounds).kick, 0)
})

test('the actual react-spring response settles and can restart after a second impact', async () => {
  const spring = new SpringValue(0), { kick, config } = impactSpring(event())
  for (let repeat = 0; repeat < 2; repeat++) {
    spring.set(kick)
    const finished = spring.start({ to: 0, config })
    for (let frame = 0; frame < 180; frame++) spring.advance(1000 / 60)
    assert.ok(Math.abs(spring.get()) < 0.0001)
    assert.equal((await finished).finished, true)
  }
  spring.stop()
})

test('a decal clips to a transformed thin panel, excludes its reverse face and follows later movement', () => {
  const root = new Group(), panel = new Mesh(new BoxGeometry(4, 4, 0.05))
  panel.userData.impactSurface = 'moving-gate'
  panel.position.set(8, 5, -10); panel.rotation.y = 0.7; panel.scale.set(1.5, 1, 1)
  root.add(panel); root.updateWorldMatrix(true, true)
  const point = panel.localToWorld(new Vector3(0, 0, 0.025))
  const normal = new Vector3(0, 0, 1).transformDirection(panel.matrixWorld)
  const mark = createImpactDecal(root, event({ surface: 'moving-gate', point, normal }))
  try {
    assert.ok(mark); assert.equal(mark.target, panel)
    const positions = mark.geometry.attributes.position
    assert.ok(positions.count > 0)
    for (let i = 0; i < positions.count; i++) assert.ok(Math.abs(positions.getZ(i) - 0.025) < 0.00001)
    const before = panel.localToWorld(new Vector3().fromBufferAttribute(positions, 0))
    panel.position.y += 3; panel.updateWorldMatrix(true, true)
    const after = panel.localToWorld(new Vector3().fromBufferAttribute(positions, 0))
    assert.ok(Math.abs(after.y - before.y - 3) < 0.00001)
    const uv = mark.geometry.attributes.uv
    for (const value of uv.array) assert.ok(value >= -1e-5 && value <= 1.00001)
  } finally { mark?.dispose(); panel.geometry.dispose() }
})

test('ground marks use the visible top surface and geometry/texture resources can be released', () => {
  const root = new Group()
  for (const y of [0, 0.02]) {
    const ground = new Mesh(new PlaneGeometry(10, 10))
    ground.rotation.x = -Math.PI / 2; ground.position.y = y
    ground.userData.impactSurface = 'ground'; root.add(ground)
  }
  const mark = createImpactDecal(root, event({ surface: 'ground', point: new Vector3(), normal: new Vector3(0, 1, 0) }))
  assert.equal(mark.target, root.children[1])
  let released = 0
  mark.geometry.addEventListener('dispose', () => released++)
  const texture = createImpactTexture()
  texture.addEventListener('dispose', () => released++)
  assert.equal(texture.image.data.length, 64 * 64 * 4)
  mark.dispose(); texture.dispose()
  assert.equal(released, 2)
  root.children.forEach(mesh => mesh.geometry.dispose())
})

test('duplicate crash reports do not replay effects, and a new attempt clears the previous event', () => {
  useSimulatorStore.setState(useSimulatorStore.getInitialState(), true)
  const actions = useSimulatorStore.getState()
  actions.startFreeFlight(); actions.registerCrash(event())
  const first = useSimulatorStore.getState().crashInfo
  actions.registerCrash(event())
  assert.equal(useSimulatorStore.getState().crashInfo, first)
  actions.resetFlight()
  assert.equal(useSimulatorStore.getState().crashInfo, null)
  actions.registerCrash(event())
  assert.notEqual(useSimulatorStore.getState().crashInfo.id, first.id)
})

test('repeated server snapshots preserve one impact identity and cannot overwrite it with a stale frame', () => {
  useSimulatorStore.setState(useSimulatorStore.getInitialState(), true)
  const actions = useSimulatorStore.getState(); actions.startServerRace()
  const snapshot = { tick: 300, status: 'crashed', crashInfo: event(), position: { x: 0, y: 1, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 }, velocity: { x: 0, y: 0, z: 0 }, angularVelocity: {}, controls: {} }
  actions.applyServerSnapshot(snapshot)
  const first = useSimulatorStore.getState().crashInfo
  actions.applyServerSnapshot(JSON.parse(JSON.stringify(snapshot)))
  assert.equal(useSimulatorStore.getState().crashInfo, first)
  actions.applyServerSnapshot({ ...snapshot, tick: 299, crashInfo: null })
  assert.equal(useSimulatorStore.getState().crashInfo, first)
  actions.resetFlight()
  assert.equal(useSimulatorStore.getState().crashInfo, null)
})
