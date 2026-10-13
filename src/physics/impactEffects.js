import { Vector3 } from 'three'

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
export function impactKind(impact) {
  if (impact.reason === 'Попадание в воду') return 'water'
  if (impact.reason === 'Выход за границы полигона') return 'bounds'
  return 'solid'
}

// A serializable, immutable event shared by local and server flight. The id
// changes only on a new attempt: repeated network snapshots cannot replay it.
export function createImpactEvent(impact, revision) {
  const normal = new Vector3().copy(impact.normal)
  if (normal.lengthSq() < 1e-8 || !Number.isFinite(normal.lengthSq())) normal.set(0, 1, 0)
  normal.normalize()
  return {
    ...impact, id: `impact-${revision}`, kind: impactKind(impact),
    point: { ...impact.point }, normal: { x: normal.x, y: normal.y, z: normal.z },
    normalSpeed: impact.normalSpeed ?? impact.speed / 3.6
  }
}

export function impactStrength(impact) {
  return clamp((impact?.normalSpeed ?? 0) / 14, 0.2, 1)
}

// Small visual flex; the Rapier body and its colliders remain authoritative.
export function impactSpring(impact) {
  const strength = impactStrength(impact)
  return { kick: impact.kind === 'solid' ? 0.09 * strength : 0,
    config: { mass: 0.7, tension: 230, friction: 15, precision: 0.0001 } }
}

export function createImpactParticles(impact) {
  if (!impact || impact.kind === 'bounds') return null
  const water = impact.kind === 'water', strength = impactStrength(impact)
  const count = Math.round((water ? 80 : 48) + strength * 48)
  const initial = new Float32Array(count * 3), positions = new Float32Array(count * 3)
  const velocities = new Float32Array(count * 3), colors = new Float32Array(count * 3)
  const normal = new Vector3().copy(impact.normal).normalize()
  const tangent = new Vector3().crossVectors(normal, Math.abs(normal.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0)).normalize()
  const bitangent = new Vector3().crossVectors(normal, tangent)
  // Seeded for repeatable screenshots and frame-rate regression checks.
  let seed = 1729
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
  for (let i = 0; i < count; i++) {
    const angle = random() * Math.PI * 2, spread = random() * (1.5 + 3 * strength)
    const velocity = normal.clone().multiplyScalar(1 + random() * (2 + 6 * strength))
      .addScaledVector(tangent, Math.cos(angle) * spread).addScaledVector(bitangent, Math.sin(angle) * spread)
    velocity.toArray(velocities, i * 3)
    normal.clone().multiplyScalar(0.03 + random() * 0.08).toArray(initial, i * 3)
    colors.set(water ? [0.35, 0.8, 1] : [1, 0.4 + random() * 0.4, 0.08], i * 3)
  }
  return { initial, positions, velocities, colors, lifetime: water ? 1.8 : 1.3,
    normal, water, gravity: water ? 9.81 : 6, size: water ? 0.1 : 0.075 }
}

// Analytic motion sampled by elapsed time, so 30/60/120 FPS and a long render
// pause give the same result. Reflect behind-plane particles to avoid sparks
// leaking into the impacted wall; this is a visual approximation, not debris physics.
export function sampleImpactParticles(particles, elapsed) {
  const age = Math.max(0, elapsed), { initial, positions, velocities, normal } = particles
  if (age >= particles.lifetime) return false
  for (let i = 0; i < positions.length; i += 3) {
    let x = initial[i] + velocities[i] * age
    let y = initial[i + 1] + velocities[i + 1] * age - 0.5 * particles.gravity * age * age
    let z = initial[i + 2] + velocities[i + 2] * age
    const distance = x * normal.x + y * normal.y + z * normal.z
    if (distance < 0) { x -= distance * normal.x; y -= distance * normal.y; z -= distance * normal.z }
    positions[i] = x; positions[i + 1] = y; positions[i + 2] = z
  }
  return true
}
