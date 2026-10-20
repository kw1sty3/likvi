export const ARENA_VERSION = 'polytech-physics-v2'
export const RACE_RINGS = [
  { id: 'ring-1', position: { x: 0, y: 5, z: -18 }, radius: 4, color: '#32ff7e' },
  { id: 'ring-2', position: { x: 12, y: 7, z: -40 }, radius: 4, color: '#32ff7e' },
  { id: 'ring-3', position: { x: -10, y: 6, z: -64 }, radius: 4, color: '#32ff7e' },
  { id: 'ring-4', position: { x: 4, y: 8, z: -88 }, radius: 4, color: '#32ff7e' },
  { id: 'ring-finish', position: { x: 0, y: 6, z: -112 }, radius: 4.5, color: '#ffd34d', finish: true }
]
export function calculateScore({ timeMs, ringsPassed, totalRings }) {
  return (ringsPassed >= totalRings ? 5000 : 0) + ringsPassed * 600 + Math.max(0, 5000 - Math.round(timeMs / 1000 * 55))
}
