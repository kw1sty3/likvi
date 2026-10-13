import test from 'node:test'
import assert from 'node:assert/strict'
import RAPIER from '@dimforge/rapier3d-compat'
import { Vector3 } from 'three'
import { createArticulatedRig, driveLift, HINGE, JOINT_DEMO_SPAWN, kickHinge, LIFT, measureRig } from '../src/physics/articulatedRig.js'
import { createDroneBody, freezeDrone, PHYSICS_STEP, START_POSITION } from '../src/physics/dronePhysics.js'
import { findCrashContact, snapshotBodyMotions } from '../src/physics/contactEvents.js'
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
const steps = (world, count) => { for (let i = 0; i < count; i++) world.step() }

test('revolute joint keeps its anchor and ±35° limits under torque in both directions', () => {
  const world = makeWorld()
  try {
    const rig = createArticulatedRig(RAPIER, world)
    near(rig.hinge.mass(), HINGE.mass)
    for (const sign of [1, -1]) {
      rig.hinge.resetTorques(true)
      rig.hinge.addTorque({ x: sign * 350, y: 80, z: 40 }, true)
      for (let i = 0; i < 300; i++) {
        world.step()
        const m = measureRig(rig.hinge, rig.lift)
        assert.ok(Math.abs(m.hingeAngle) < 35.1, `limit exceeded: ${m.hingeAngle}`)
        assert.ok(m.anchorError < 0.002, `anchor detached: ${m.anchorError}`)
        near(rig.hinge.rotation().y, 0)
        near(rig.hinge.rotation().z, 0)
      }
      near(measureRig(rig.hinge, rig.lift).hingeAngle, sign * 35, 0.1)
    }
  } finally { world.free() }
})

test('prismatic joint blocks sideways motion, rotation and travel beyond 0–4.8 m', () => {
  const world = makeWorld()
  try {
    const rig = createArticulatedRig(RAPIER, world)
    near(rig.lift.mass(), LIFT.mass)
    for (const sign of [1, -1]) {
      rig.lift.resetForces(true)
      rig.lift.addForce({ x: 120, y: sign * 3000, z: 90 }, true)
      rig.lift.addTorque({ x: 20, y: 20, z: 20 }, true)
      for (let i = 0; i < 300; i++) {
        world.step()
        const m = measureRig(rig.hinge, rig.lift)
        assert.ok(m.liftTravel >= -0.001 && m.liftTravel <= LIFT.travel + 0.001)
        assert.ok(m.lateralError < 0.001)
        near(rig.lift.rotation().w, 1)
      }
      near(measureRig(rig.hinge, rig.lift).liftTravel, sign > 0 ? LIFT.travel : 0)
    }
  } finally { world.free() }
})

test('lift motor opens and closes, while the hinge swings and loses energy', () => {
  const world = makeWorld()
  try {
    const rig = createArticulatedRig(RAPIER, world)
    kickHinge(rig.hinge)
    driveLift(rig.liftJoint, rig.lift, true)
    let initialPeak = 0, latePeak = 0
    for (let i = 0; i < 600; i++) {
      world.step()
      const angle = Math.abs(measureRig(rig.hinge, rig.lift).hingeAngle)
      if (i < 120) initialPeak = Math.max(initialPeak, angle)
      if (i >= 480) latePeak = Math.max(latePeak, angle)
    }
    assert.ok(initialPeak > 30 && initialPeak <= 35.1)
    assert.ok(latePeak < initialPeak / 2)
    // Position motors under gravity have a small steady-state error.
    near(measureRig(rig.hinge, rig.lift).liftTravel, LIFT.travel, 0.1)
    driveLift(rig.liftJoint, rig.lift, false)
    steps(world, 240)
    near(measureRig(rig.hinge, rig.lift).liftTravel, 0)
  } finally { world.free() }
})

test('reset restores both bodies, clears applied loads, and re-enables a frozen rig', () => {
  const world = makeWorld()
  try {
    const rig = createArticulatedRig(RAPIER, world)
    kickHinge(rig.hinge)
    driveLift(rig.liftJoint, rig.lift, true)
    rig.hinge.addTorque({ x: 80, y: 0, z: 0 }, true)
    rig.lift.addForce({ x: 0, y: 100, z: 0 }, true)
    steps(world, 100)
    freezeDrone(rig.hinge); freezeDrone(rig.lift)
    rig.reset()
    for (const [body, spec] of [[rig.hinge, HINGE], [rig.lift, LIFT]]) {
      assert.equal(body.isEnabled(), true)
      near(body.translation().x, spec.position[0]); near(body.translation().y, spec.position[1]); near(body.translation().z, spec.position[2])
      near(body.rotation().w, 1)
      near(new Vector3().copy(body.linvel()).length(), 0)
      near(new Vector3().copy(body.angvel()).length(), 0)
    }
    steps(world, 180)
    near(measureRig(rig.hinge, rig.lift).hingeAngle, 0)
    near(measureRig(rig.hinge, rig.lift).liftTravel, 0)
    assert.equal(world.impulseJoints.len(), 2)
  } finally { world.free() }
})

test('repeated rig creation and removal leaves no bodies, colliders or joints behind', () => {
  const world = makeWorld()
  try {
    for (let i = 0; i < 10; i++) {
      const rig = createArticulatedRig(RAPIER, world)
      assert.equal(world.bodies.len(), 3)
      assert.equal(world.impulseJoints.len(), 2)
      steps(world, 10)
      rig.dispose()
      assert.equal(world.bodies.len(), 0)
      assert.equal(world.colliders.len(), 0)
      assert.equal(world.impulseJoints.len(), 0)
    }
  } finally { world.free() }
})

function simulateFrames(fps) {
  const world = makeWorld()
  try {
    const rig = createArticulatedRig(RAPIER, world)
    let accumulator = 0, tick = 0
    for (let frame = 0; frame < fps * 4; frame++) {
      accumulator += 1 / fps
      while (accumulator + 1e-10 >= PHYSICS_STEP) {
        if (tick === 0) kickHinge(rig.hinge)
        if (tick === 30) driveLift(rig.liftJoint, rig.lift, true)
        if (tick === 180) driveLift(rig.liftJoint, rig.lift, false)
        world.step()
        accumulator -= PHYSICS_STEP
        tick++
      }
    }
    return { tick, ...measureRig(rig.hinge, rig.lift) }
  } finally { world.free() }
}
test('joint simulation gives identical results at 30, 60 and 120 rendered FPS', () => {
  const expected = simulateFrames(60)
  assert.equal(expected.tick, 240)
  assert.deepEqual(simulateFrames(30), expected)
  assert.deepEqual(simulateFrames(120), expected)
})

test('a swinging gate can crash a stationary drone, using pre-impact relative velocity', () => {
  const world = makeWorld(0)
  try {
    const rig = createArticulatedRig(RAPIER, world)
    const drone = createDroneBody(RAPIER, world, { x: 18, y: 2, z: -19.1 })
    rig.hinge.addTorque({ x: 600, y: 0, z: 0 }, true)
    let impact = null
    for (let i = 0; i < 120 && !impact; i++) {
      const center = drone.worldCom(), velocity = drone.linvel(), angular = drone.angvel()
      const motions = snapshotBodyMotions(world, drone)
      world.step()
      impact = findCrashContact(world, drone, center, velocity, angular, null, motions)
    }
    assert.ok(impact, 'moving panel must produce an impact')
    assert.equal(impact.reason, 'Удар подвижных ворот')
    assert.ok(impact.speed >= 3 * 3.6)
    assert.ok(impact.point.z < -16)
  } finally { world.free() }
})

test('two touching bodies moving together do not cause a false high-speed crash', () => {
  const world = makeWorld(0)
  try {
    const drone = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setLinvel(0, 0, 10))
    world.createCollider(RAPIER.ColliderDesc.cuboid(1, 1, 1), drone)
    const gate = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0, 2).setLinvel(0, 0, 10))
    gate.userData = { surface: 'moving-gate' }
    world.createCollider(RAPIER.ColliderDesc.cuboid(1, 1, 1), gate)
    let contacts = 0
    for (let i = 0; i < 30; i++) {
      const center = drone.worldCom(), velocity = drone.linvel(), angular = drone.angvel()
      const motions = snapshotBodyMotions(world, drone)
      world.step()
      world.contactPair(drone.collider(0), gate.collider(0), manifold => { contacts += manifold.numSolverContacts() })
      assert.equal(findCrashContact(world, drone, center, velocity, angular, null, motions), null)
    }
    assert.ok(contacts > 0, 'the test must exercise actual contacts')
  } finally { world.free() }
})

test('demo controls reset after a crash and its spawn never leaks into free flight or a race', () => {
  useSimulatorStore.setState(useSimulatorStore.getInitialState(), true)
  useSimulatorStore.getState().startJointDemo()
  const initial = useSimulatorStore.getState()
  assert.equal(initial.jointDemoEnabled, true)
  assert.deepEqual(initial.gps, JOINT_DEMO_SPAWN)
  initial.swingJointGate(); initial.toggleJointLift()
  assert.equal(useSimulatorStore.getState().jointGateOpen, true)
  initial.registerCrash({ reason: 'test', point: new Vector3(), normal: new Vector3(0, 1, 0), speed: 20 })
  initial.swingJointGate(); initial.toggleJointLift()
  assert.equal(useSimulatorStore.getState().jointKick, 1)
  assert.equal(useSimulatorStore.getState().jointGateOpen, true)
  initial.resetFlight()
  const reset = useSimulatorStore.getState()
  assert.equal(reset.jointKick, 0)
  assert.equal(reset.jointGateOpen, false)
  assert.equal(reset.jointDemoEnabled, true)
  assert.equal(reset.isFlying, true)
  assert.deepEqual(reset.gps, JOINT_DEMO_SPAWN)
  reset.returnHome()
  assert.equal(useSimulatorStore.getState().jointDemoEnabled, false)
  reset.startFreeFlight()
  assert.deepEqual(useSimulatorStore.getState().gps, START_POSITION)
  reset.startJointDemo(); reset.startCountdown()
  assert.equal(useSimulatorStore.getState().jointDemoEnabled, false)
  assert.deepEqual(useSimulatorStore.getState().gps, START_POSITION)
  assert.equal(useSimulatorStore.getState().competitionStatus, 'countdown')
})
