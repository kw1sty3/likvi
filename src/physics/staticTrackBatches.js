import { BoxGeometry, BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, Object3D } from 'three'

const geometries = { box: BoxGeometry, cylinder: CylinderGeometry, cone: ConeGeometry }

// Bake static transforms once. Spatial batches retain frustum culling and the
// original triangles, UVs, materials and collision/shadow boundaries.
export function createStaticTrackBatches(parts) {
  const groups = new Map(), transform = new Object3D(), color = new Color()
  for (const part of parts) {
    const castShadow = part.castShadow ?? !part.glow
    const collidable = part.collidable !== false
    const roughness = part.roughness ?? 0.72, metalness = part.metalness ?? 0.12
    const key = JSON.stringify([Math.floor(part.position[0] / 64), Math.floor(part.position[2] / 64),
      part.material, roughness, metalness, castShadow, collidable, part.glow ? part.color : null])
    if (!groups.has(key)) groups.set(key, { chunks: [], castShadow, collidable,
      material: part.material, roughness, metalness, glow: part.glow, color: part.color })
    const Geometry = geometries[part.shape]
    const geometry = new Geometry(...(part.args ?? part.size))
    transform.position.set(...part.position)
    transform.rotation.set(...(part.rotation ?? [0, 0, 0]))
    transform.scale.set(...(part.scale ?? [1, 1, 1]))
    transform.updateMatrix()
    geometry.applyMatrix4(transform.matrix)
    color.set(part.glow ? '#ffffff' : part.color)
    const colors = new Float32Array(geometry.attributes.position.count * 3)
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = color.r; colors[i + 1] = color.g; colors[i + 2] = color.b
    }
    geometry.setAttribute('color', new BufferAttribute(colors, 3))
    groups.get(key).chunks.push(geometry)
  }
  return [...groups.values()].map(({ chunks, ...batch }) => {
    const count = chunks.reduce((sum, geometry) => sum + geometry.attributes.position.count, 0)
    const geometry = new BufferGeometry()
    for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2], ['color', 3]]) {
      const values = new Float32Array(count * size)
      let offset = 0
      for (const chunk of chunks) {
        values.set(chunk.attributes[name].array, offset)
        offset += chunk.attributes[name].array.length
      }
      geometry.setAttribute(name, new BufferAttribute(values, size))
    }
    const indices = new Uint32Array(chunks.reduce((sum, chunk) => sum + chunk.index.count, 0))
    let offset = 0, vertex = 0
    for (const chunk of chunks) {
      for (const index of chunk.index.array) indices[offset++] = vertex + index
      vertex += chunk.attributes.position.count
      chunk.dispose()
    }
    geometry.setIndex(new BufferAttribute(indices, 1))
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    return { ...batch, geometry }
  })
}
