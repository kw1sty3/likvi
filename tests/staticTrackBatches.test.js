import test from 'node:test'
import assert from 'node:assert/strict'
import { Mesh, MeshBasicMaterial } from 'three'
import { FPV_TRACKS, createFpvCollisionRoot } from '../src/physics/fpvTracks.js'
import { createStaticTrackBatches } from '../src/physics/staticTrackBatches.js'
import { createStaticCollisionWorld, nearestSurface, raycastSurface } from '../src/physics/staticCollisionWorld.js'

for (const track of FPV_TRACKS) {
  test(`${track.id}: render batching preserves collision surfaces and route clearance`, () => {
    const arena = createFpvCollisionRoot(track), expected = createStaticCollisionWorld(arena.root)
    const batches = createStaticTrackBatches(track.parts), material = new MeshBasicMaterial()
    assert.ok(batches.length < track.parts.length / 2, `${batches.length} batches for ${track.parts.length} parts`)
    // Replace the original parts; gates and signs stay in the same scene.
    const originals = arena.root.children.slice(0, track.parts.filter(part => part.collidable !== false).length)
    originals.forEach(mesh => arena.root.remove(mesh))
    for (const batch of batches) {
      const mesh = new Mesh(batch.geometry, material)
      mesh.userData.isCollidable = batch.collidable
      arena.root.add(mesh)
    }
    const actual = createStaticCollisionWorld(arena.root)
    try {
      assert.equal(actual.solid.triangleCount, expected.solid.triangleCount)
      for (const gate of track.gates) {
        for (const direction of [{ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
          { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }]) {
          const before = raycastSurface(expected.solid, gate.position, direction, 300)
          const after = raycastSurface(actual.solid, gate.position, direction, 300)
          assert.equal(!!after, !!before)
          if (before) assert.ok(Math.abs(after.distance - before.distance) < 0.0001)
        }
        const before = nearestSurface(expected.solid, gate.position, 30)
        const after = nearestSurface(actual.solid, gate.position, 30)
        assert.equal(!!after, !!before)
        if (before) assert.ok(Math.abs(after.distance - before.distance) < 0.0001)
      }
    } finally {
      originals.forEach(mesh => mesh.geometry.dispose())
      actual.dispose(); expected.dispose(); arena.dispose(); material.dispose()
    }
  })
}
