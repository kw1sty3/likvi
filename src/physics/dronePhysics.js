import { Euler, Quaternion, Vector3 } from 'three'

// SI units: metres, kilograms, seconds. Shared by the scene and headless checks.
export const PHYSICS_STEP = 1 / 60
export const GRAVITY = 9.81
export const START_POSITION = { x: 0, y: 0.86, z: 0 }
export const WORLD_HALF = 420
export const MAX_THRUST = 27.2
export const HOVER_THROTTLE = GRAVITY / MAX_THRUST
export const TRAINING_FLIGHT = Object.freeze({
  id: 'training', maxThrust: MAX_THRUST, throttleExponent: 1, maxTilt: 0.52,
  inputResponse: 0.16, throttleRate: 0.65, yawRate: 1.5,
  attitudeGain: 13, yawGain: 10, attitudeDamping: 3.2, yawDamping: 3, maxTorque: 8,
  horizontalLinearDrag: 0.25, horizontalQuadraticDrag: 0.06,
  liftAssist: false, neutralBrake: 0
})
export const FPV_FLIGHT = Object.freeze({
  id: 'fpv-v2', maxThrust: 58, throttleExponent: 1.6, maxTilt: Math.PI / 3,
  inputResponse: 0.055, throttleRate: 0.6, yawRate: 3.2,
  attitudeGain: 100, yawGain: 80, attitudeDamping: 14, yawDamping: 12, maxTorque: 65,
  horizontalLinearDrag: 0.12, horizontalQuadraticDrag: 0.012,
  liftAssist: true, neutralBrake: 0.9
})
export const hoverThrottle = (profile = TRAINING_FLIGHT) => (GRAVITY / profile.maxThrust) ** (1 / profile.throttleExponent)
export const FPV_HOVER_THROTTLE = hoverThrottle(FPV_FLIGHT)
export const DRONE_PASS_RADIUS = 2.4
export const DRONE_COLLIDERS = [
  { shape: 'cuboid', args: [0.8, 0.32, 0.8], position: [0, 0, 0], mass: 0.55 },
  { shape: 'cuboid', args: [1.72, 0.06, 0.06], position: [0, 0, 0], mass: 0.05 },
  { shape: 'cuboid', args: [0.06, 0.06, 1.72], position: [0, 0, 0], mass: 0.05 },
  ...[-1.2, 1.2].flatMap(x => [-1.2, 1.2].map(z => ({
    shape: 'cylinder', args: [0.09, 0.66], position: [x, 0.71, z], mass: 0.06
  }))),
  ...[-0.52, 0.52].map(x => ({
    shape: 'cuboid', args: [0.05, 0.04, 0.74], position: [x, -0.78, 0], mass: 0.055
  }))
]
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export function advanceControls(current, keys, dt = PHYSICS_STEP, profile = TRAINING_FLIGHT) {
  const blend = 1 - Math.exp(-dt / profile.inputResponse)
  const approach = (value, target) => {
    const next = value + (target - value) * blend
    return Math.abs(next) < 0.0001 ? 0 : next
  }
  return {
    throttle: profile.liftAssist && keys.KeyH ? hoverThrottle(profile) :
      clamp(current.throttle + ((keys.KeyQ ? 1 : 0) - (keys.KeyE ? 1 : 0)) * profile.throttleRate * dt, 0, 1),
    pitch: approach(current.pitch, (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0)),
    roll: approach(current.roll, (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0)),
    yaw: approach(current.yaw, (keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0)),
    ...(profile.liftAssist ? { brake: Boolean(keys.Space), autopilot: false } : {})
  }
}

export function createFlightController(profile = TRAINING_FLIGHT) {
  const orientation = new Quaternion(), target = new Quaternion(), error = new Quaternion()
  const inverse = new Quaternion(), force = new Vector3(), torque = new Vector3()
  const angles = new Euler(0, 0, 0, 'YXZ')
  const localVelocity = new Vector3(), up = new Vector3(0, 1, 0)
  let heading = 0
  return {
    reset(rotation = { x: 0, y: 0, z: 0, w: 1 }) {
      heading = angles.setFromQuaternion(orientation.copy(rotation), 'YXZ').y
    },
    step(body, controls, dt = PHYSICS_STEP) {
      orientation.copy(body.rotation())
      heading += clamp(controls.yaw, -1, 1) * profile.yawRate * dt
      const velocity = body.linvel()
      let pitch = controls.pitch * profile.maxTilt, roll = controls.roll * profile.maxTilt
      if (profile.liftAssist) {
        localVelocity.copy(velocity).applyAxisAngle(up, -heading)
        const brakeStrength = controls.brake ? 4 : profile.neutralBrake
        const brakeTilt = controls.brake ? profile.maxTilt : 0.5
        // Brake by banking the thrust against momentum, rather than deleting velocity.
        if (controls.brake || (!controls.autopilot && Math.abs(controls.pitch) < 0.04)) pitch = clamp(Math.atan2(-localVelocity.z * brakeStrength, GRAVITY), -brakeTilt, brakeTilt)
        if (controls.brake || (!controls.autopilot && Math.abs(controls.roll) < 0.04)) roll = clamp(Math.atan2(localVelocity.x * brakeStrength, GRAVITY), -brakeTilt, brakeTilt)
        const tilt = Math.hypot(pitch, roll)
        if (tilt > profile.maxTilt) { pitch *= profile.maxTilt / tilt; roll *= profile.maxTilt / tilt }
      }
      target.setFromEuler(angles.set(pitch, heading, roll, 'YXZ'))
      error.copy(target).multiply(inverse.copy(orientation).conjugate())
      // Shortest quaternion rotation; PD controller models attitude stabilization.
      const sign = error.w < 0 ? -1 : 1
      const angular = body.angvel()
      torque.set(error.x * sign * profile.attitudeGain - angular.x * profile.attitudeDamping,
        error.y * sign * profile.yawGain - (angular.y - (profile.liftAssist ? clamp(controls.yaw, -1, 1) * profile.yawRate : 0)) * profile.yawDamping,
        error.z * sign * profile.attitudeGain - angular.z * profile.attitudeDamping).clampLength(0, profile.maxTorque)
      force.set(0, 1, 0).applyQuaternion(orientation)
      const compensation = profile.liftAssist ? 1 / Math.max(0.4, force.y) : 1
      const thrust = Math.min(profile.maxThrust, clamp(controls.throttle, 0, 1) ** profile.throttleExponent * profile.maxThrust * compensation)
      force.multiplyScalar(thrust)
      // Drag is a force, not a per-render-frame multiplier.
      force.x -= velocity.x * (profile.horizontalLinearDrag + Math.abs(velocity.x) * profile.horizontalQuadraticDrag)
      force.y -= velocity.y * (0.12 + Math.abs(velocity.y) * 0.015)
      force.z -= velocity.z * (profile.horizontalLinearDrag + Math.abs(velocity.z) * profile.horizontalQuadraticDrag)
      body.resetForces(true)
      body.resetTorques(true)
      body.addForce(force, true)
      body.addTorque(torque, true)
    }
  }
}

export function resetDrone(body, position = START_POSITION) {
  body.setTranslation(position, true)
  body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
  body.setLinvel({ x: 0, y: 0, z: 0 }, true)
  body.setAngvel({ x: 0, y: 0, z: 0 }, true)
  body.resetForces(true)
  body.resetTorques(true)
}

export function freezeDrone(body) {
  body.setLinvel({ x: 0, y: 0, z: 0 }, false)
  body.setAngvel({ x: 0, y: 0, z: 0 }, false)
  body.resetForces(false)
  body.resetTorques(false)
  body.setEnabled(false)
}

// Intersect the swept path with the ring plane, in the route direction.
export function crossesRing(previous, current, ring, clearance = DRONE_PASS_RADIUS) {
  if (!ring || ring.radius <= clearance) return false
  // Legacy rings face -Z. Track gates can face any horizontal direction.
  const normal = ring.normal ?? { x: 0, y: 0, z: -1 }
  const dot = point => (point.x - ring.position.x) * normal.x +
    (point.y - ring.position.y) * normal.y + (point.z - ring.position.z) * normal.z
  const a = dot(previous), b = dot(current)
  if (a >= 0 || b < 0) return false
  const t = a / (a - b)
  const x = previous.x + (current.x - previous.x) * t - ring.position.x
  const y = previous.y + (current.y - previous.y) * t - ring.position.y
  const z = previous.z + (current.z - previous.z) * t - ring.position.z
  return x * x + y * y + z * z <= (ring.radius - clearance) ** 2
}

export function createDroneBody(rapier, world, position = START_POSITION) {
  const body = world.createRigidBody(rapier.RigidBodyDesc.dynamic()
    .setTranslation(position.x, position.y, position.z)
    .setCcdEnabled(true).setCanSleep(false).setAngularDamping(0.15))
  for (const collider of DRONE_COLLIDERS) {
    world.createCollider(rapier.ColliderDesc[collider.shape](...collider.args)
      .setTranslation(...collider.position).setMass(collider.mass)
      .setFriction(0.7).setRestitution(0.05), body)
  }
  return body
}
