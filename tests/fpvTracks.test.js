import test from 'node:test'
import assert from 'node:assert/strict'
import { Vector3 } from 'three'
import { FPV_TRACKS, createFpvCollisionRoot, getTrack, TRACK_VERSION } from '../src/physics/fpvTracks.js'
import { createStaticCollisionWorld, nearestSurface, raycastSurface } from '../src/physics/staticCollisionWorld.js'
import { crossesRing, DRONE_PASS_RADIUS, FPV_HOVER_THROTTLE, FPV_FLIGHT, START_POSITION } from '../src/physics/dronePhysics.js'
import { useSimulatorStore } from '../src/store/useSimulatorStore.js'
import RAPIER from '@dimforge/rapier3d-compat'
import { advanceControls, createDroneBody, createFlightController, PHYSICS_STEP } from '../src/physics/dronePhysics.js'
import { findCrashContact } from '../src/physics/contactEvents.js'
import { createFpvColliders } from '../src/physics/fpvCollisionShapes.js'

await RAPIER.init()

for (const track of FPV_TRACKS) {
  test(`${track.id}: entire racing line has clearance for the compound drone, including tunnel openings and floor transitions`, () => {
    const arena = createFpvCollisionRoot(track), index = createStaticCollisionWorld(arena.root)
    try {
      assert.ok(index.solid.triangleCount > 1000)
      assert.ok(track.gates.length >= 10)
      const points = [track.spawn, ...track.gates.map(gate => gate.position)]
      for (let i = 1; i < points.length; i++) {
        const from = new Vector3().copy(points[i - 1]), to = new Vector3().copy(points[i])
        const count = Math.ceil(from.distanceTo(to) * 3)
        for (let j = 0; j <= count; j++) {
          const position = new Vector3().lerpVectors(from, to, j / count)
          const hit = nearestSurface(index.solid, position, DRONE_PASS_RADIUS + 0.1)
          assert.ok(!hit || hit.distance >= DRONE_PASS_RADIUS,
            `blocked segment ${i}, sample ${j}/${count}, position ${position.toArray()}, clearance ${hit?.distance}`)
          assert.ok(position.y > DRONE_PASS_RADIUS)
        }
      }
      for (const gate of track.gates) {
        const offset = new Vector3().copy(gate.normal).multiplyScalar(8)
        const before = new Vector3().copy(gate.position).sub(offset)
        const after = new Vector3().copy(gate.position).add(offset)
        assert.equal(crossesRing(before, after, gate), true)
        assert.equal(crossesRing(after, before, gate), false, 'reverse flight cannot score')
        assert.equal(crossesRing(before.clone().add(new Vector3(0, gate.radius, 0)), after.clone().add(new Vector3(0, gate.radius, 0)), gate), false)
        assert.equal(crossesRing(before, before.clone().lerp(gate.position, 0.5), gate), false, 'proximity alone cannot score')
      }
    } finally { index.dispose(); arena.dispose() }
  })

  test(`${track.id}: a full lap can be flown with real keyboard controls, CCD and the scene collision geometry`, () => {
    const arena = createFpvCollisionRoot(track), index = createStaticCollisionWorld(arena.root)
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    world.timestep = PHYSICS_STEP
    world.integrationParameters.numSolverIterations = 8
    world.integrationParameters.maxCcdSubsteps = 4
    const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
    ground.userData = { surface: 'ground' }
    world.createCollider(RAPIER.ColliderDesc.cuboid(420, 0.25, 420).setTranslation(0, -0.25, 0), ground)
    createFpvColliders(RAPIER, world, track)
    const body = createDroneBody(RAPIER, world, track.spawn), controller = createFlightController(FPV_FLIGHT)
    let controls = { throttle: FPV_HOVER_THROTTLE, pitch: 0, roll: 0, yaw: 0 }
    let gateIndex = 0, approaching = true, ticks = 0
    const clamp = (value, max) => Math.max(-max, Math.min(max, value))
    try {
      while (gateIndex < track.gates.length && ticks++ < 60 * 600) {
        const gate = track.gates[gateIndex]
        const position = body.translation(), velocity = body.linvel(), angular = body.angvel(), center = body.worldCom()
        const offset = approaching ? -7 : 7
        const target = { x: gate.position.x + gate.normal.x * offset, y: gate.position.y, z: gate.position.z + gate.normal.z * offset }
        if (approaching && Math.hypot(target.x - position.x, target.y - position.y, target.z - position.z) < 0.8) approaching = false
        const ax = clamp((target.x - position.x) * 1.3 - velocity.x * 2.2, 3)
        const az = clamp((target.z - position.z) * 1.3 - velocity.z * 2.2, 3)
        const roll = -Math.atan2(ax, 9.81) / FPV_FLIGHT.maxTilt, pitch = Math.atan2(az, 9.81) / FPV_FLIGHT.maxTilt
        const throttle = Math.max(0, Math.min(0.8, (Math.max(0, 9.81 + (target.y - position.y) * 2 - velocity.y * 2.6) /
          FPV_FLIGHT.maxThrust) ** (1 / FPV_FLIGHT.throttleExponent)))
        const keys = {}
        if (controls.throttle < throttle - 0.005) keys.KeyQ = true
        else if (controls.throttle > throttle + 0.005) keys.KeyE = true
        if (controls.pitch < pitch - 0.04) keys.KeyS = true
        else if (controls.pitch > pitch + 0.04) keys.KeyW = true
        if (controls.roll < roll - 0.04) keys.KeyA = true
        else if (controls.roll > roll + 0.04) keys.KeyD = true
        controls = advanceControls(controls, keys, PHYSICS_STEP, FPV_FLIGHT)
        controller.step(body, controls)
        world.step()
        const impact = findCrashContact(world, body, center, velocity, angular, index.solid)
        assert.equal(impact, null, `${track.id}: collision on gate ${gateIndex + 1} at ${JSON.stringify(body.translation())}: ${impact?.reason}`)
        if (crossesRing(position, body.translation(), gate)) { gateIndex++; approaching = true }
      }
      assert.equal(gateIndex, track.gates.length, `only ${gateIndex} gates passed in ${ticks / 60}s`)
    } finally { world.free(); index.dispose(); arena.dispose() }
  })
}

test('tunnels have open entrances and solid side walls, ceilings and round tube shells', () => {
  const arena = createFpvCollisionRoot(getTrack('tunnels')), index = createStaticCollisionWorld(arena.root)
  try {
    assert.equal(raycastSurface(index.solid, { x: 0, y: 9, z: 10 }, { x: 0, y: 0, z: -1 }, 75), null)
    assert.ok(raycastSurface(index.solid, { x: 0, y: 9, z: -30 }, { x: 1, y: 0, z: 0 }, 10))
    assert.ok(raycastSurface(index.solid, { x: 0, y: 9, z: -30 }, { x: 0, y: 1, z: 0 }, 10))
    assert.ok(raycastSurface(index.solid, { x: 50, y: 9, z: -88 }, { x: 0, y: 0, z: 1 }, 10))
  } finally { index.dispose(); arena.dispose() }
})

function resetStore() { useSimulatorStore.setState(useSimulatorStore.getInitialState(), true) }

test('three laps require every gate, finish once and keep FPV records separate from the classic leaderboard', () => {
  resetStore()
  const actions = useSimulatorStore.getState()
  actions.selectMap('stadium'); actions.setRaceLaps(3); actions.startCountdown()
  assert.deepEqual(useSimulatorStore.getState().gps, getTrack('stadium').spawn)
  assert.equal(useSimulatorStore.getState().cameraMode, 'fps')
  actions.passActiveRing()
  assert.equal(useSimulatorStore.getState().activeRingIndex, 0)
  actions.startRaceRun()
  assert.equal(useSimulatorStore.getState().throttle, FPV_HOVER_THROTTLE)
  actions.finishRace()
  assert.equal(useSimulatorStore.getState().competitionStatus, 'running', 'early finish is rejected')
  for (let lap = 1; lap <= 3; lap++) {
    for (let gate = 0; gate < getTrack('stadium').gates.length; gate++) actions.passActiveRing()
    const state = useSimulatorStore.getState()
    if (lap < 3) {
      assert.equal(state.currentLap, lap + 1)
      assert.equal(state.activeRingIndex, 0)
      assert.equal(state.competitionStatus, 'running')
      assert.equal(state.fpvRecords.length, 0)
    }
  }
  actions.passActiveRing(); actions.finishRace()
  const state = useSimulatorStore.getState()
  assert.equal(state.competitionStatus, 'finished')
  assert.equal(state.fpvRecords.length, 1)
  assert.equal(state.lastResult.trackId, 'stadium')
  assert.equal(state.lastResult.version, TRACK_VERSION)
  assert.equal(state.lastResult.laps, 3)
  assert.equal(state.lastResult.lapTimes.length, 3)
  assert.equal(state.leaderboard.length, 0)
  assert.equal(state.isFlying, false)
  actions.resetFlight()
  assert.equal(useSimulatorStore.getState().competitionStatus, 'countdown')
  assert.equal(useSimulatorStore.getState().currentLap, 1)
  assert.deepEqual(useSimulatorStore.getState().lapTimes, [])
})

test('a crash invalidates an FPV attempt; a free-flight reset and map switches use the correct spawn', () => {
  resetStore()
  const actions = useSimulatorStore.getState()
  actions.selectMap('tunnels'); actions.setRaceLaps(1); actions.startCountdown(); actions.startRaceRun()
  actions.selectMap('construction'); actions.setRaceLaps(5)
  assert.equal(useSimulatorStore.getState().selectedMapId, 'tunnels', 'track is locked during flight')
  assert.equal(useSimulatorStore.getState().raceLaps, 1)
  actions.registerCrash({ reason: 'wall', point: new Vector3(), normal: new Vector3(1, 0, 0), speed: 40 })
  for (let i = 0; i < 20; i++) actions.passActiveRing()
  actions.finishRace()
  assert.equal(useSimulatorStore.getState().fpvRecords.length, 0)
  actions.returnHome(); actions.selectMap('construction'); actions.startFreeFlight(); actions.resetFlight()
  assert.deepEqual(useSimulatorStore.getState().gps, getTrack('construction').spawn)
  assert.equal(useSimulatorStore.getState().throttle, FPV_HOVER_THROTTLE)
  assert.equal(useSimulatorStore.getState().isFlying, true)
  actions.returnHome(); actions.selectMap('polytech-arena'); actions.startFreeFlight()
  assert.deepEqual(useSimulatorStore.getState().gps, START_POSITION)
  actions.returnHome(); actions.selectMap('tunnels'); actions.startServerRace()
  assert.equal(useSimulatorStore.getState().selectedMapId, 'polytech-arena')
  assert.equal(useSimulatorStore.getState().rings.length, 5)
})
