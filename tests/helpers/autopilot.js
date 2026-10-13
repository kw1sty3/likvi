import { RACE_RINGS } from '../../src/physics/raceRules.js'

// Test driver sends the same keys as a human. It never changes bodies or scores.
export function pilotKeys(snapshot, rings = RACE_RINGS) {
  const ring = rings[snapshot.activeRingIndex]
  if (!ring || snapshot.status === 'countdown') return []
  const p = snapshot.position, v = snapshot.velocity, c = snapshot.controls
  const aligned = Math.abs(p.x - ring.position.x) < 1 && Math.abs(p.y - ring.position.y) < 1
  const targetZ = ring.position.z + (aligned ? -4 : 5)
  const ax = Math.max(-4, Math.min(4, (ring.position.x - p.x) * 1.3 - v.x * 2.2))
  const az = Math.max(-4, Math.min(4, (targetZ - p.z) * 1.3 - v.z * 2.2))
  const roll = -ax / 9.81 / 0.52, pitch = az / 9.81 / 0.52
  const throttle = Math.max(0, Math.min(0.8,
    (9.81 + (ring.position.y - p.y) * 2 - v.y * 2.6) / 27.2 / Math.cos(c.pitch * 0.52) / Math.cos(c.roll * 0.52)))
  const keys = []
  if (c.throttle < throttle - 0.005) keys.push('KeyQ')
  else if (c.throttle > throttle + 0.005) keys.push('KeyE')
  if (c.pitch < pitch - 0.04) keys.push('KeyS')
  else if (c.pitch > pitch + 0.04) keys.push('KeyW')
  if (c.roll < roll - 0.04) keys.push('KeyA')
  else if (c.roll > roll + 0.04) keys.push('KeyD')
  return keys
}
