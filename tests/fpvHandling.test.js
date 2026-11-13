import test from 'node:test'
import assert from 'node:assert/strict'
import RAPIER from '@dimforge/rapier3d-compat'
import { Quaternion, Vector3 } from 'three'
import { advanceControls, createDroneBody, createFlightController, FPV_FLIGHT, FPV_HOVER_THROTTLE, PHYSICS_STEP } from '../src/physics/dronePhysics.js'
import { measure } from '../scripts/measure-fpv-flight.mjs'

await RAPIER.init()

test('FPV accelerates past 90 km/h in 3 seconds, responds within 350 ms and brakes with banked thrust', () => {
  const result = measure(FPV_FLIGHT)
  assert.ok(result.responseMs <= 350, JSON.stringify(result))
  assert.ok(result.speed3s >= 90 && result.speed6s < 150, JSON.stringify(result))
  assert.ok(result.speedAfter2s < 8, JSON.stringify(result))
  assert.ok(Math.abs(result.altitude - 30) < 0.05, 'lift compensation must hold the initial height at hover throttle')
  const neutral = measure(FPV_FLIGHT, false)
  assert.ok(neutral.speedAfter2s < neutral.speed6s / 2, 'releasing WASD must slow the drone')
})

test('FPV throttle trim, brake, input release and opposite keys give predictable controls', () => {
  let c = { throttle: 0.9, pitch: 0, roll: 0, yaw: 0 }
  c = advanceControls(c, { KeyH: true, Space: true }, PHYSICS_STEP, FPV_FLIGHT)
  assert.equal(c.throttle, FPV_HOVER_THROTTLE)
  assert.equal(c.brake, true)
  for (let i = 0; i < 6; i++) c = advanceControls(c, { KeyW: true, ArrowLeft: true }, PHYSICS_STEP, FPV_FLIGHT)
  assert.ok(c.pitch < -0.8 && c.yaw > 0.8)
  for (let i = 0; i < 20; i++) c = advanceControls(c, { KeyW: true, KeyS: true, ArrowLeft: true, ArrowRight: true }, PHYSICS_STEP, FPV_FLIGHT)
  assert.ok(Math.abs(c.pitch) < 0.003 && Math.abs(c.yaw) < 0.003)
  assert.equal(c.brake, false)
})

function fly(fps) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  world.timestep = PHYSICS_STEP
  const body = createDroneBody(RAPIER, world, { x: 0, y: 30, z: 0 })
  const controller = createFlightController(FPV_FLIGHT)
  let controls = { throttle: FPV_HOVER_THROTTLE, pitch: 0, roll: 0, yaw: 0 }, accumulator = 0, tick = 0
  try {
    for (let frame = 0; frame < fps * 5; frame++) {
      accumulator += 1 / fps
      while (accumulator + 1e-10 >= PHYSICS_STEP) {
        controls = advanceControls(controls, { KeyW: tick < 120, ArrowLeft: tick >= 60 && tick < 140, Space: tick >= 180, KeyQ: tick >= 210 && tick < 225 }, PHYSICS_STEP, FPV_FLIGHT)
        controller.step(body, controls)
        world.step(); accumulator -= PHYSICS_STEP; tick++
        assert.ok(Number.isFinite(body.translation().x + body.translation().y + body.translation().z))
      }
    }
    return { position: { ...body.translation() }, rotation: { ...body.rotation() }, velocity: { ...body.linvel() } }
  } finally { world.free() }
}

test('FPV handling is identical at 30, 60 and 120 rendered frames per second', () => {
  assert.deepEqual(fly(30), fly(60))
  assert.deepEqual(fly(120), fly(60))
})

test('yaw turns relative to the drone heading and zero throttle still obeys gravity', () => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  world.timestep = PHYSICS_STEP
  const body = createDroneBody(RAPIER, world, { x: 0, y: 30, z: 0 }), controller = createFlightController(FPV_FLIGHT)
  try {
    for (let i = 0; i < 60; i++) { controller.step(body, { throttle: FPV_HOVER_THROTTLE, pitch: 0, roll: 0, yaw: 1 }); world.step() }
    const forward = new Vector3(0, 0, -1).applyQuaternion(new Quaternion().copy(body.rotation()))
    assert.ok(forward.z > 0.7, 'a one-second yaw command should turn close to 180 degrees')
    const before = body.translation().y
    for (let i = 0; i < 60; i++) { controller.step(body, { throttle: 0, pitch: 0, roll: 0, yaw: 0, brake: true }); world.step() }
    assert.ok(body.translation().y < before - 4, 'assist cannot create lift with stopped motors')
  } finally { world.free() }
})
