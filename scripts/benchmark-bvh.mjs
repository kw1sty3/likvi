import { performance } from 'node:perf_hooks'
import { BoxGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, Raycaster, SphereGeometry, Vector3 } from 'three'
import { createStaticCollisionWorld, raycastSurface } from '../src/physics/staticCollisionWorld.js'

// Repeatable synthetic static arena. Reports query cost, not browser FPS.
const root = new Group()
const box = new BoxGeometry(6, 12, 6)
const crown = new SphereGeometry(3, 14, 10)
for (let z = 0; z < 20; z++) {
  for (let x = 0; x < 20; x++) {
    const mesh = new Mesh((x + z) % 2 ? box : crown)
    mesh.position.set(x * 12, 6, z * 12)
    mesh.rotation.y = (x + z) * 0.1
    mesh.userData.isCollidable = true
    root.add(mesh)
  }
}
const started = performance.now()
const index = createStaticCollisionWorld(root)
const buildMs = performance.now() - started
const material = new MeshBasicMaterial({ side: DoubleSide })
const mesh = new Mesh(index.solid.geometry, material)
mesh.updateMatrixWorld()
const direction = new Vector3(0, -1, 0)
const origins = Array.from({ length: 1000 }, (_, i) => new Vector3((i * 37) % 240, 40, (i * 71) % 240))
const raycaster = new Raycaster()
function benchmark(bvh) {
  let hits = 0
  const start = performance.now()
  for (const origin of origins) {
    if (bvh) {
      if (raycastSurface(index.solid, origin, direction, 100)) hits++
    } else {
      raycaster.set(origin, direction)
      raycaster.far = 100
      if (raycaster.intersectObject(mesh, false).length) hits++
    }
  }
  return { ms: +(performance.now() - start).toFixed(2), hits }
}
benchmark(true)
const regular = benchmark(false)
const bvh = benchmark(true)
if (regular.hits !== bvh.hits) throw new Error('BVH and ordinary geometry queries disagree')
console.log(JSON.stringify({ triangles: index.solid.triangleCount, queries: origins.length,
  buildMs: +buildMs.toFixed(2), regular, bvh, querySpeedup: +(regular.ms / bvh.ms).toFixed(1) }, null, 2))
index.dispose(); box.dispose(); crown.dispose(); material.dispose()
