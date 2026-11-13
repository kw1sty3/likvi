import RAPIER from '@dimforge/rapier3d-compat'
import { Euler, Quaternion } from 'three'
import { advanceControls, createDroneBody, createFlightController, FPV_FLIGHT, TRAINING_FLIGHT, hoverThrottle, PHYSICS_STEP } from '../src/physics/dronePhysics.js'

await RAPIER.init()
export function measure(profile, brake = true) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  world.timestep = PHYSICS_STEP
  const body = createDroneBody(RAPIER, world, { x: 0, y: 30, z: 0 })
  const controller = createFlightController(profile)
  let controls = { throttle: hoverThrottle(profile), pitch: 0, roll: 0, yaw: 0 }
  let responseMs = null, speed3s, speed6s
  try {
    for (let tick = 0; tick < 480; tick++) {
      const keys = tick < 360 ? { KeyW: true } : brake ? { Space: true } : {}
      controls = advanceControls(controls, keys, PHYSICS_STEP, profile)
      controller.step(body, controls)
      world.step()
      const pitch = new Euler().setFromQuaternion(new Quaternion().copy(body.rotation()), 'YXZ').x
      if (responseMs === null && Math.abs(pitch) > profile.maxTilt / 2) responseMs = Math.round((tick + 1) / 60 * 1000)
      const speed = Math.hypot(body.linvel().x, body.linvel().z) * 3.6
      if (tick === 179) speed3s = speed
      if (tick === 359) speed6s = speed
    }
    return { profile: profile.id, brake, responseMs, speed3s: +speed3s.toFixed(1), speed6s: +speed6s.toFixed(1),
      speedAfter2s: +(Math.hypot(body.linvel().x, body.linvel().z) * 3.6).toFixed(1),
      altitude: +body.translation().y.toFixed(2), throttle: +controls.throttle.toFixed(3) }
  } finally { world.free() }
}

if (process.argv[1]?.endsWith('measure-fpv-flight.mjs')) {
  console.log(JSON.stringify([measure(TRAINING_FLIGHT), measure(FPV_FLIGHT), measure(FPV_FLIGHT, false)], null, 2))
}
