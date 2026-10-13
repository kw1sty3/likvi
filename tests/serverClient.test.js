import test from 'node:test'
import assert from 'node:assert/strict'
import { createServerFlightClient } from '../src/network/serverFlightClient.js'
import { ARENA_VERSION } from '../src/physics/raceRules.js'

const state = status => ({ protocol: 1, arenaVersion: ARENA_VERSION, status })
const response = data => ({ ok: true, json: async () => data })

test('client sends only keys/sequence, then releases a terminal session without more polling', async () => {
  const calls = [], snapshots = [], errors = []
  const connection = createServerFlightClient({ readKeys: () => ({ KeyQ: true, KeyE: false }),
    onSnapshot: snapshot => snapshots.push(snapshot), onError: error => errors.push(error),
    fetchImpl: async (url, options) => {
      calls.push({ url, ...options })
      if (options.method === 'DELETE') return response({ closed: true })
      if (url.endsWith('/session')) return response({ token: 'private-token', snapshot: state('countdown') })
      return response(state('crashed'))
    } })
  await connection.start()
  assert.deepEqual(JSON.parse(calls[1].body), { seq: 1, keys: ['KeyQ'] })
  assert.equal(calls[1].headers.Authorization, 'Bearer private-token')
  assert.equal(calls.at(-1).method, 'DELETE')
  assert.deepEqual(snapshots.map(snapshot => snapshot.status), ['countdown', 'crashed'])
  assert.deepEqual(errors, [])
})

test('leaving while session creation is pending removes the late session and ignores its snapshot', async () => {
  let releaseResponse
  const calls = [], snapshots = []
  const pendingResponse = new Promise(resolve => { releaseResponse = resolve })
  const connection = createServerFlightClient({ readKeys: () => ({}), onSnapshot: snapshot => snapshots.push(snapshot), onError: assert.fail,
    fetchImpl: async (url, options) => {
      calls.push({ url, ...options })
      return options.method === 'DELETE' ? response({ closed: true }) : pendingResponse
    } })
  const starting = connection.start()
  connection.stop()
  releaseResponse(response({ token: 'late-token', snapshot: state('countdown') }))
  await starting
  assert.equal(snapshots.length, 0)
  assert.equal(calls.length, 2)
  assert.equal(calls[1].method, 'DELETE')
})

test('network failure reports an error and never silently starts a local race', async () => {
  const errors = [], snapshots = []
  const connection = createServerFlightClient({ readKeys: () => ({}), onSnapshot: snapshot => snapshots.push(snapshot), onError: error => errors.push(error),
    fetchImpl: async () => { throw new TypeError('Failed to fetch') } })
  await connection.start()
  assert.equal(snapshots.length, 0)
  assert.equal(errors.length, 1)
  assert.match(errors[0], /Нет связи с сервером/)
})
