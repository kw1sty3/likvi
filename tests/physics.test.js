import test from 'node:test'
import assert from 'node:assert/strict'
import RAPIER from '@dimforge/rapier3d-compat'
import { BoxGeometry, Group, Mesh, Quaternion, Shape, ShapeGeometry, Vector3 } from 'three'
import { advanceControls, createDroneBody, createFlightController, crossesRing, freezeDrone, HOVER_THROTTLE, PHYSICS_STEP, resetDrone, START_POSITION } from '../src/physics/dronePhysics.js'
import { findCrashContact } from '../src/physics/contactEvents.js'
import { createStaticCollisionWorld, nearestSurface, raycastSurface, waterContact } from '../src/physics/staticCollisionWorld.js'
import { useSimulatorStore } from '../src/store/useSimulatorStore.js'

await RAPIER.init()
const near = (actual, expected, tolerance = 0.001) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`)
function makeWorld(gravity = -9.81) {
  const world = new RAPIER.World({ x: 0, y: gravity, z: 0 })
  world.timestep = PHYSICS_STEP
  world.integrationParameters.numSolverIterations = 8
  world.integrationParameters.maxCcdSubsteps = 4
  return world
}
function addGround(world) {
  const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.25, 0))
  ground.userData = { surface: 'ground' }
  world.createCollider(RAPIER.ColliderDesc.cuboid(50, 0.25, 50).setFriction(0.9).setRestitution(0.05), ground)
}

test('the compound drone has a mass of 1 kg and hovers at the calculated throttle', () => {
  const world = makeWorld()
  try {
    const body = createDroneBody(RAPIER, world, { x: 0, y: 10, z: 0 })
    const controller = createFlightController()
    for (let i = 0; i < 300; i++) {
      controller.step(body, { throttle: HOVER_THROTTLE, pitch: 0, roll: 0, yaw: 0 })
      world.step()
    }
    near(body.mass(), 1)
    near(body.translation().y, 10)
    near(body.linvel().y, 0)
    assert.equal(body.isCcdEnabled(), true)
  } finally { world.free() }
})

function simulateFrames(fps) {
  const world = makeWorld()
  try {
    const body = createDroneBody(RAPIER, world, { x: 0, y: 20, z: 0 })
    const controller = createFlightController()
    let controls = { throttle: HOVER_THROTTLE, pitch: 0, roll: 0, yaw: 0 }
    let accumulator = 0, tick = 0
    for (let frame = 0; frame < fps * 4; frame++) {
      accumulator += 1 / fps
      while (accumulator + 1e-10 >= PHYSICS_STEP) {
        controls = advanceControls(controls, { KeyW: tick >= 30 && tick < 150, KeyQ: tick < 15, ArrowLeft: tick >= 150 && tick < 180 })
        controller.step(body, controls)
        world.step()
        accumulator -= PHYSICS_STEP
        tick++
      }
    }
    return { tick, position: { ...body.translation() }, velocity: { ...body.linvel() }, rotation: { ...body.rotation() } }
  } finally { world.free() }
}
test('the same fixed-step input sequence gives identical results at 30, 60 and 120 rendered FPS', () => {
  const result = simulateFrames(60)
  assert.equal(result.tick, 240)
  assert.deepEqual(simulateFrames(30), result)
  assert.deepEqual(simulateFrames(120), result)
  assert.ok(result.position.z < -1, 'W must move the drone forward along negative Z')
})

test('opposite input cancels, throttle is bounded, and released controls return to neutral', () => {
  let controls = { throttle: 1, pitch: -1, roll: 1, yaw: 1 }
  controls = advanceControls(controls, { KeyQ: true, KeyE: true, KeyW: true, KeyS: true })
  assert.equal(controls.throttle, 1)
  for (let i = 0; i < 200; i++) controls = advanceControls(controls, { KeyE: true })
  assert.deepEqual(controls, { throttle: 0, pitch: 0, roll: 0, yaw: 0 })
})

test('a gentle landing rests on the skids without triggering a crash', () => {
  const world = makeWorld()
  try {
    addGround(world)
    const body = createDroneBody(RAPIER, world, { x: 0, y: 1, z: 0 })
    for (let i = 0; i < 180; i++) {
      const p = body.translation(), v = body.linvel(), a = body.angvel()
      world.step()
      assert.equal(findCrashContact(world, body, p, v, a), null)
    }
    near(body.translation().y, 0.82, 0.02)
    assert.ok(Math.abs(body.linvel().y) < 0.1)
  } finally { world.free() }
})

test('a hard vertical landing is detected even without horizontal speed', () => {
  const world = makeWorld()
  try {
    addGround(world)
    const body = createDroneBody(RAPIER, world, { x: 0, y: 8, z: 0 })
    let impact = null
    for (let i = 0; i < 180 && !impact; i++) {
      const p = body.translation(), v = body.linvel(), a = body.angvel()
      world.step()
      impact = findCrashContact(world, body, p, v, a)
    }
    assert.ok(impact, 'hard landing must produce an impact')
    assert.equal(impact.reason, 'Жёсткая посадка')
    assert.ok(impact.speed > 14.4)
  } finally { world.free() }
})

test('CCD stops a fast compound drone at a thin wall', () => {
  const world = makeWorld(0)
  try {
    const wall = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(5, 5, 0))
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.025, 10, 20), wall)
    const body = createDroneBody(RAPIER, world, { x: 0, y: 5, z: 0 })
    body.setLinvel({ x: 300, y: 0, z: 0 }, true)
    let impact = null
    for (let i = 0; i < 12; i++) {
      const p = body.translation(), v = body.linvel(), a = body.angvel()
      world.step()
      impact ||= findCrashContact(world, body, p, v, a)
      assert.ok(body.translation().x < 5, 'must not tunnel through the wall')
    }
    assert.ok(impact, 'the fast impact must be reported')
  } finally { world.free() }
})

test('freeze stops movement and reset removes previous forces, rotation and velocity', () => {
  const world = makeWorld()
  try {
    const body = createDroneBody(RAPIER, world, { x: 0, y: 8, z: 0 })
    body.setLinvel({ x: 10, y: -10, z: 5 }, true)
    freezeDrone(body)
    for (let i = 0; i < 60; i++) world.step()
    near(body.translation().y, 8)
    resetDrone(body)
    assert.deepEqual({ ...body.linvel() }, { x: 0, y: 0, z: 0 })
    near(body.translation().y, START_POSITION.y)
    body.setEnabled(true)
    world.step()
    near(body.translation().x, 0)
    near(body.translation().z, 0)
  } finally { world.free() }
})

test('BVH respects rotated and scaled world geometry and rejects empty bounding-box corners', () => {
  const root = new Group(), parent = new Group()
  parent.position.set(10, 0, -5)
  const mesh = new Mesh(new BoxGeometry(2, 2, 2))
  mesh.rotation.y = Math.PI / 4
  mesh.scale.y = 2
  mesh.userData.isCollidable = true
  parent.add(mesh); root.add(parent)
  const index = createStaticCollisionWorld(root)
  try {
    const hit = raycastSurface(index.solid, { x: 10, y: 5, z: -5 }, { x: 0, y: -1, z: 0 })
    near(hit.point.y, 2)
    assert.equal(raycastSurface(index.solid, { x: 11.3, y: 5, z: -3.7 }, { x: 0, y: -1, z: 0 }), null)
    near(nearestSurface(index.solid, { x: 10, y: 2.25, z: -5 }).distance, 0.25)
  } finally { index.dispose(); mesh.geometry.dispose() }
})

test('BVH water contacts follow the river polygon and ignore the dry part of its bounding box', () => {
  const shape = new Shape()
  shape.moveTo(-4, -4); shape.lineTo(4, -4); shape.lineTo(4, 0)
  shape.lineTo(0, 0); shape.lineTo(0, 4); shape.lineTo(-4, 4); shape.closePath()
  const mesh = new Mesh(new ShapeGeometry(shape))
  mesh.rotation.x = -Math.PI / 2
  mesh.userData = { isCollidable: true, collisionType: 'water' }
  const root = new Group(); root.add(mesh)
  const index = createStaticCollisionWorld(root)
  try {
    const rotation = new Quaternion()
    assert.ok(waterContact(index.water, { x: -3, y: 1, z: -3 }, { x: -3, y: 0.82, z: -3 }, rotation))
    assert.equal(waterContact(index.water, { x: 3, y: 1, z: -3 }, { x: 3, y: 0.82, z: -3 }, rotation), null)
    assert.equal(waterContact(index.water, { x: -3, y: 4, z: -3 }, { x: -3, y: 3, z: -3 }, rotation), null)
  } finally { index.dispose(); mesh.geometry.dispose() }
})

test('rings require a forward plane crossing with room for the full drone', () => {
  const ring = { position: { x: 0, y: 5, z: -18 }, radius: 4 }
  assert.equal(crossesRing({ x: 0, y: 5, z: -16 }, { x: 0, y: 5, z: -17 }, ring), false)
  assert.equal(crossesRing({ x: 0, y: 5, z: -20 }, { x: 0, y: 5, z: -16 }, ring), false)
  assert.equal(crossesRing({ x: 0, y: 5, z: 0 }, { x: 0, y: 5, z: -40 }, ring), true)
  assert.equal(crossesRing({ x: 3, y: 5, z: -16 }, { x: 3, y: 5, z: -20 }, ring), false)
})

test('a crash stops the race, blocks checkpoints and scoring, and reset starts a new countdown', () => {
  useSimulatorStore.setState(useSimulatorStore.getInitialState(), true)
  useSimulatorStore.getState().startCountdown()
  useSimulatorStore.getState().startRaceRun()
  useSimulatorStore.getState().registerCrash({ reason: 'test', point: new Vector3(), normal: new Vector3(0, 1, 0), speed: 25 })
  const frozenTime = useSimulatorStore.getState().raceElapsedMs
  useSimulatorStore.getState().updateRaceElapsed()
  useSimulatorStore.getState().passActiveRing()
  useSimulatorStore.getState().finishRace()
  const crashed = useSimulatorStore.getState()
  assert.equal(crashed.competitionStatus, 'crashed')
  assert.equal(crashed.raceElapsedMs, frozenTime)
  assert.equal(crashed.activeRingIndex, 0)
  assert.equal(crashed.leaderboard.length, 0)
  const revision = crashed.flightRevision
  crashed.resetFlight()
  const reset = useSimulatorStore.getState()
  assert.equal(reset.competitionStatus, 'countdown')
  assert.equal(reset.countdown, 5)
  assert.equal(reset.crashInfo, null)
  assert.equal(reset.awaitingStart, true)
  assert.equal(reset.flightRevision, revision + 1)
})

test('free-flight reset remains playable and a successful solo race still scores once', () => {
  useSimulatorStore.setState(useSimulatorStore.getInitialState(), true)
  useSimulatorStore.getState().startFreeFlight()
  useSimulatorStore.getState().resetFlight()
  assert.equal(useSimulatorStore.getState().isFlying, true)
  assert.equal(useSimulatorStore.getState().awaitingStart, false)
  useSimulatorStore.getState().startCountdown()
  assert.equal(useSimulatorStore.getState().isFlying, false)
  useSimulatorStore.getState().startRaceRun()
  for (let i = 0; i < 5; i++) useSimulatorStore.getState().passActiveRing()
  useSimulatorStore.getState().finishRace()
  const state = useSimulatorStore.getState()
  assert.equal(state.competitionStatus, 'finished')
  assert.equal(state.leaderboard.length, 1)
  assert.ok(state.lastResult.score > 0)
})
