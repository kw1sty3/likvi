import { BufferAttribute, BufferGeometry, DoubleSide, Ray, Vector3 } from 'three'
import { MeshBVH } from 'three-mesh-bvh/src/core/MeshBVH.js'
import { SAH } from 'three-mesh-bvh/src/core/Constants.js'

function buildIndex(meshes) {
  if (meshes.length === 0) return null
  const positions = [], indices = [], point = new Vector3()
  for (const mesh of meshes) {
    const attribute = mesh.geometry.getAttribute('position')
    const offset = positions.length / 3
    for (let i = 0; i < attribute.count; i++) {
      point.fromBufferAttribute(attribute, i).applyMatrix4(mesh.matrixWorld)
      positions.push(point.x, point.y, point.z)
    }
    const index = mesh.geometry.index
    for (let i = 0; i < (index?.count ?? attribute.count); i++) {
      indices.push(offset + (index ? index.getX(i) : i))
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setIndex(new BufferAttribute(new Uint32Array(indices), 1))
  // Build once in world coordinates. The same triangles become the Rapier mesh.
  const bvh = new MeshBVH(geometry, { strategy: SAH, maxLeafTris: 10 })
  return { geometry, bvh, triangleCount: geometry.index.count / 3 }
}

export function createStaticCollisionWorld(root) {
  root.updateWorldMatrix(true, true)
  const solids = [], water = []
  root.traverse(object => {
    if (!object.isMesh || !object.geometry?.getAttribute('position') || !object.userData.isCollidable) return
    const target = object.userData.collisionType === 'water' ? water : solids
    target.push(object)
  })
  const result = { solid: buildIndex(solids), water: buildIndex(water) }
  result.dispose = () => {
    result.solid?.geometry.dispose()
    result.water?.geometry.dispose()
  }
  return result
}

export function nearestSurface(index, position, maxDistance = 4) {
  if (!index) return null
  return index.bvh.closestPointToPoint(new Vector3(position.x, position.y, position.z), {}, 0, maxDistance)
}

export function raycastSurface(index, origin, direction, maxDistance = Infinity) {
  if (!index) return null
  return index.bvh.raycastFirst(new Ray(new Vector3().copy(origin), new Vector3().copy(direction).normalize()), DoubleSide, 0, maxDistance)
}

// Exact river outline, including banks and bends. Sweep skid tips to catch
// fast crossings; bounding rectangles would falsely include nearby land.
export function waterContact(index, previous, current, rotation) {
  if (!index || Math.min(previous.y, current.y) > 2) return null
  const point = new Vector3()
  for (const x of [-0.52, 0.52]) {
    for (const z of [-0.7, 0.7]) {
      const offset = new Vector3(x, -0.82, z).applyQuaternion(rotation)
      const from = new Vector3().copy(previous).add(offset)
      point.copy(current).add(offset)
      const direction = point.clone().sub(from), distance = direction.length()
      if (distance > 0.00001) {
        const swept = raycastSurface(index, from, direction, distance)
        if (swept) return swept.point
      }
      if (point.y <= 0.06) {
        const hit = raycastSurface(index, { x: point.x, y: 0.2, z: point.z }, { x: 0, y: -1, z: 0 }, 0.25)
        if (hit) return hit.point
      }
    }
  }
  return null
}
