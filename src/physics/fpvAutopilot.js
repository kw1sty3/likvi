import { Euler, Quaternion } from 'three'
import { FPV_FLIGHT, FPV_HOVER_THROTTLE, GRAVITY, PHYSICS_STEP } from './dronePhysics.js'

const clamp = (value, max) => Math.max(-max, Math.min(max, value))
const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle))

// This pilot produces stick/throttle commands. Only Rapier moves the drone,
// and the normal swept gate checks decide whether a checkpoint was passed.
export function createFpvAutopilot(track) {
  let gateIndex = -1, entering = true, turnaround = null
  let command = { throttle: FPV_HOVER_THROTTLE, pitch: 0, roll: 0, yaw: 0, brake: false, autopilot: true }
  const angles = new Euler(0, 0, 0, 'YXZ'), orientation = new Quaternion()
  return {
    reset() { gateIndex = -1; entering = true; turnaround = null; command = { throttle: FPV_HOVER_THROTTLE, pitch: 0, roll: 0, yaw: 0, brake: false, autopilot: true } },
    step({ position, velocity, quaternion, activeRingIndex }, dt = PHYSICS_STEP) {
      const gate = track.gates[activeRingIndex]
      if (!gate) return { ...command, throttle: 0, brake: true }
      if (gateIndex !== activeRingIndex) {
        const previous = track.gates[gateIndex]
        if (previous && previous.normal.x * gate.normal.x + previous.normal.z * gate.normal.z < -0.8) {
          turnaround = { x: previous.position.x + previous.normal.x * 11, y: previous.position.y,
            z: previous.position.z + previous.normal.z * 11, yaw: previous.yaw, turning: false }
        }
        gateIndex = activeRingIndex; entering = true
      }
      angles.setFromQuaternion(orientation.copy(quaternion), 'YXZ')
      const yaw = angles.y
      if (turnaround) {
        const arrived = Math.hypot(turnaround.x - position.x, turnaround.y - position.y, turnaround.z - position.z) < 2
        const slow = Math.hypot(velocity.x, velocity.z) < 1.8
        if (arrived && slow) turnaround.turning = true
        if (turnaround.turning && arrived && slow && Math.abs(wrap(gate.yaw - yaw)) < 0.18) turnaround = null
      }
      const normal = gate.normal
      const before = { x: gate.position.x - normal.x * 7, y: gate.position.y, z: gate.position.z - normal.z * 7 }
      const distanceBefore = Math.hypot(before.x - position.x, before.y - position.y, before.z - position.z)
      if (distanceBefore < 1.5) entering = false
      const offset = entering ? -7 : 8
      const target = turnaround ?? { x: gate.position.x + normal.x * offset, y: gate.position.y, z: gate.position.z + normal.z * offset }
      const dx = target.x - position.x, dz = target.z - position.z, distance = Math.hypot(dx, dz)
      const speed = Math.min(10, Math.sqrt(Math.max(0, distance) * 5))
      const vx = distance > 0.01 ? dx / distance * speed : 0
      const vz = distance > 0.01 ? dz / distance * speed : 0
      const drag = v => v * (FPV_FLIGHT.horizontalLinearDrag + Math.abs(v) * FPV_FLIGHT.horizontalQuadraticDrag)
      let ax = (turnaround ? dx * 1.2 - velocity.x * 2.6 : (vx - velocity.x) * 2.3) + drag(velocity.x)
      let az = (turnaround ? dz * 1.2 - velocity.z * 2.6 : (vz - velocity.z) * 2.3) + drag(velocity.z)
      const acceleration = Math.hypot(ax, az)
      if (acceleration > 6) { ax *= 6 / acceleration; az *= 6 / acceleration }
      const localX = Math.cos(yaw) * ax - Math.sin(yaw) * az
      const localZ = Math.sin(yaw) * ax + Math.cos(yaw) * az
      const pitch = Math.atan2(localZ, GRAVITY)
      const roll = -Math.atan2(localX * Math.cos(pitch), GRAVITY)
      const desiredHeading = turnaround ? (turnaround.turning ? gate.yaw : turnaround.yaw) : distance > 18 ? Math.atan2(-dx, -dz) : gate.yaw
      const lift = GRAVITY + clamp((target.y - position.y) * 2.5 - velocity.y * 2.8, 4)
      const targetCommand = {
        throttle: (lift / FPV_FLIGHT.maxThrust) ** (1 / FPV_FLIGHT.throttleExponent),
        pitch: clamp(pitch / FPV_FLIGHT.maxTilt, 1), roll: clamp(roll / FPV_FLIGHT.maxTilt, 1),
        yaw: clamp(wrap(desiredHeading - yaw) * 1.8 / FPV_FLIGHT.yawRate, 0.48)
      }
      const blend = 1 - Math.exp(-dt / 0.09)
      for (const key of ['throttle', 'pitch', 'roll', 'yaw']) command[key] += (targetCommand[key] - command[key]) * blend
      return { ...command }
    }
  }
}
