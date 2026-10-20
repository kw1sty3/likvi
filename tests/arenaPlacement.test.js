import test from 'node:test'
import assert from 'node:assert/strict'
import { BoxGeometry, Matrix4 } from 'three'
import { MeshBVH } from 'three-mesh-bvh/src/core/MeshBVH.js'
import { createRiverGeometry, makeWorldData, placeBuildingsOnLand } from '../src/physics/arena.js'

function waterIndex(path) {
  const geometry = createRiverGeometry(path)
  geometry.rotateX(Math.PI / 2)
  return { geometry, bvh: new MeshBVH(geometry) }
}

function wetLots(buildings, water, margin = 0) {
  return buildings.flatMap((building, index) => {
    const lot = new BoxGeometry(building.size[0] + 8 + margin * 2, 2, building.size[2] + 8 + margin * 2)
    const transform = new Matrix4().makeRotationY(building.rotation[1])
      .setPosition(building.position[0], 0, building.position[2])
    try {
      return water.bvh.intersectsGeometry(lot, transform) ? [index] : []
    } finally { lot.dispose() }
  })
}

test('all 82 buildings and their rotated lots stay on land with a three-metre bank clearance', () => {
  const data = makeWorldData()
  const water = waterIndex(data.riverPath)
  try {
    assert.equal(data.buildings.length, 82)
    assert.deepEqual(wetLots(data.buildings, water, 2.99), [])
    assert.deepEqual(makeWorldData(), data)
  } finally { water.geometry.dispose() }
})

test('shoreline corners and rotated lots are moved while dry buildings and input data are preserved', () => {
  const riverPath = [-100, 0, 100].map(x => ({ x, z: 0, width: 20 }))
  const buildings = [[0, 40, 0], [0, 0, 0], [40, 18, 0], [-40, 22, Math.PI / 4]].map(([x, z, yaw]) => ({
    position: [x, 5, z], rotation: [0, yaw, 0], size: [10, 10, 10]
  }))
  const original = structuredClone(buildings), water = waterIndex(riverPath)
  try {
    assert.deepEqual(wetLots(buildings, water), [1, 2, 3])
    const placed = placeBuildingsOnLand(buildings, riverPath)
    assert.equal(placed.length, buildings.length)
    assert.equal(placed[0], buildings[0])
    assert.deepEqual(buildings, original)
    assert.deepEqual(wetLots(placed, water, 2.99), [])
    for (let i = 1; i < placed.length; i++) assert.notDeepEqual(placed[i].position, buildings[i].position)
    assert.ok(placed[1].position[2] < 0, 'the nearest occupied bank must be skipped')
  } finally { water.geometry.dispose() }
})
