import { BufferAttribute, BufferGeometry, DataTexture, Euler, Matrix4, Quaternion, Raycaster, RGBAFormat, Vector3 } from 'three'
import { DecalGeometry } from 'three-stdlib'
import { impactStrength } from './impactEffects.js'

export function createImpactDecal(root, impact) {
  if (!impact || impact.kind !== 'solid') return null
  root.updateWorldMatrix(true, true)
  const candidates = []
  root.traverse(object => {
    if (!object.isMesh || !object.geometry?.attributes.normal) return
    const data = object.userData
    const eligible = impact.surface === 'ground' ? data.impactSurface === 'ground'
      : impact.surface === 'moving-gate' || impact.surface === 'rig-frame' ? data.impactSurface === impact.surface
      : data.isCollidable && data.collisionType !== 'water'
    if (eligible) candidates.push(object)
  })
  const normal = new Vector3().copy(impact.normal).normalize()
  const origin = new Vector3().copy(impact.point).addScaledVector(normal, 0.6)
  const ray = new Raycaster(origin, normal.clone().negate(), 0, 1.2)
  const hit = ray.intersectObjects(candidates, false)[0]
  if (!hit) return null
  const orientation = new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), normal))
  const width = 0.55 + impactStrength(impact) * 1.1
  const projected = new DecalGeometry(hit.object, hit.point, orientation, new Vector3(width, width, 0.35))
  // A projector may include the reverse face of a thin panel. Keep only the
  // face receiving the impact, then attach local coordinates to that mesh.
  const position = [], normals = [], uv = []
  const p = projected.attributes.position, n = projected.attributes.normal, t = projected.attributes.uv
  for (let i = 0; i < p.count; i += 3) {
    if (new Vector3(n.getX(i), n.getY(i), n.getZ(i)).dot(normal) <= 0.05) continue
    for (let j = i; j < i + 3; j++) {
      position.push(p.getX(j), p.getY(j), p.getZ(j))
      normals.push(n.getX(j), n.getY(j), n.getZ(j)); uv.push(t.getX(j), t.getY(j))
    }
  }
  projected.dispose()
  if (!position.length) return null
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(position), 3))
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3))
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2))
  geometry.applyMatrix4(new Matrix4().copy(hit.object.matrixWorld).invert())
  return { target: hit.object, geometry, dispose: () => geometry.dispose() }
}

// One small procedural GPU texture; no external asset downloads.
export function createImpactTexture(size = 64) {
  const pixels = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x + 0.5) / size * 2 - 1, dy = (y + 0.5) / size * 2 - 1
    const r = Math.hypot(dx, dy), angle = Math.atan2(dy, dx)
    const grain = 0.7 + 0.3 * Math.sin(x * 12.9898 + y * 78.233)
    const scratch = Math.pow(Math.max(0, Math.cos(angle * 11 + r * 6)), 14) * Math.max(0, 1 - r)
    const alpha = Math.max(0, 1 - r * 1.4) * 0.75 * grain + scratch * 0.8
    const i = (y * size + x) * 4
    pixels[i] = 32; pixels[i + 1] = 24; pixels[i + 2] = 19
    pixels[i + 3] = Math.round(Math.min(1, alpha) * 255)
  }
  const texture = new DataTexture(pixels, size, size, RGBAFormat)
  texture.needsUpdate = true
  return texture
}
