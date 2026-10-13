import { Euler, Quaternion, Vector3 } from 'three'

// SI units: metres, kilograms, seconds. Shared by the scene and headless checks.
export const PHYSICS_STEP = 1 / 60
export const GRAVITY = 9.81
export const START_POSITION = { x: 0, y: 0.86, z: 0 }
export const WORLD_HALF = 420
export const MAX_THRUST = 27.2
export const HOVER_THROTTLE = GRAVITY / MAX_THRUST
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

export function advanceControls(current, keys, dt = PHYSICS_STEP) {
  const blend = 1 - Math.exp(-dt / 0.16)
  const approach = (value, target) => {
    const next = value + (target - value) * blend
    return Math.abs(next) < 0.0001 ? 0 : next
  }
  return {
    throttle: clamp(current.throttle + ((keys.KeyQ ? 1 : 0) - (keys.KeyE ? 1 : 0)) * 0.65 * dt, 0, 1),
    pitch: approach(current.pitch, (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0)),
    roll: approach(current.roll, (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0)),
    yaw: approach(current.yaw, (keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0))
  }
}

export function createFlightController() {
  const orientation = new Quaternion(), target = new Quaternion(), error = new Quaternion()
  const inverse = new Quaternion(), force = new Vector3(), torque = new Vector3()
  const angles = new Euler(0, 0, 0, 'YXZ')
  let heading = 0
  return {
    reset(rotation = { x: 0, y: 0, z: 0, w: 1 }) {
      heading = angles.setFromQuaternion(orientation.copy(rotation), 'YXZ').y
    },
    step(body, controls, dt = PHYSICS_STEP) {
      orientation.copy(body.rotation())
      heading += clamp(controls.yaw, -1, 1) * 1.5 * dt
      target.setFromEuler(angles.set(controls.pitch * 0.52, heading, controls.roll * 0.52, 'YXZ'))
      error.copy(target).multiply(inverse.copy(orientation).conjugate())
      // Shortest quaternion rotation; PD controller models attitude stabilization.
      const sign = error.w < 0 ? -1 : 1
      const angular = body.angvel()
      torque.set(error.x * sign * 13 - angular.x * 3.2,
        error.y * sign * 10 - angular.y * 3.0,
        error.z * sign * 13 - angular.z * 3.2).clampLength(0, 8)
      const velocity = body.linvel()
      force.set(0, clamp(controls.throttle, 0, 1) * MAX_THRUST, 0).applyQuaternion(orientation)
      // Drag is a force, not a per-render-frame multiplier.
      force.x -= velocity.x * (0.25 + Math.abs(velocity.x) * 0.06)
      force.y -= velocity.y * (0.12 + Math.abs(velocity.y) * 0.015)
      force.z -= velocity.z * (0.25 + Math.abs(velocity.z) * 0.06)
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
  const a = previous.z - ring.position.z, b = current.z - ring.position.z
  if (a <= 0 || b > 0) return false
  const t = a / (a - b)
  const x = previous.x + (current.x - previous.x) * t - ring.position.x
  const y = previous.y + (current.y - previous.y) * t - ring.position.y
  return x * x + y * y <= (ring.radius - clearance) ** 2
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
