import test from 'node:test'
import assert from 'node:assert/strict'
import RAPIER from '@dimforge/rapier3d-compat'
import { FPV_TRACKS, createFpvCollisionRoot, getTrack } from '../src/physics/fpvTracks.js'
import { createFpvColliders } from '../src/physics/fpvCollisionShapes.js'
import { createStaticCollisionWorld, raycastSurface } from '../src/physics/staticCollisionWorld.js'
import { createDroneBody, PHYSICS_STEP } from '../src/physics/dronePhysics.js'
import { findCrashContact } from '../src/physics/contactEvents.js'

await RAPIER.init()

for (const track of FPV_TRACKS) {
  test(`${track.id}: optimized physical obstacles match visible surfaces around every gate`, () => {
    const arena = createFpvCollisionRoot(track), index = createStaticCollisionWorld(arena.root)
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    createFpvColliders(RAPIER, world, track)
    world.updateSceneQueries()
    try {
      for (const gate of track.gates) {
        for (const direction of [{ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
          { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }]) {
          const visual = raycastSurface(index.solid, gate.position, direction, 300)
          const physical = world.castRay(new RAPIER.Ray(gate.position, direction), 300, true)
          assert.equal(!!physical, !!visual, `gate ${gate.id}, ${JSON.stringify(direction)}`)
          if (visual) assert.ok(Math.abs(physical.timeOfImpact - visual.distance) < 0.001,
            `${physical.timeOfImpact} vs ${visual.distance} at ${gate.id}`)
        }
      }
    } finally { world.free(); index.dispose(); arena.dispose() }
  })
}

test('optimized tunnel walls stop a high-speed drone with CCD and report a crash', () => {
  const track = getTrack('tunnels'), arena = createFpvCollisionRoot(track)
  const index = createStaticCollisionWorld(arena.root), world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  world.timestep = PHYSICS_STEP
  world.integrationParameters.maxCcdSubsteps = 4
  createFpvColliders(RAPIER, world, track)
  const body = createDroneBody(RAPIER, world, { x: 0, y: 9, z: -30 })
  body.setLinvel({ x: 100, y: 0, z: 0 }, true)
  let impact
  try {
    for (let tick = 0; tick < 30 && !impact; tick++) {
      const center = body.worldCom(), velocity = body.linvel(), angular = body.angvel()
      world.step()
      impact = findCrashContact(world, body, center, velocity, angular, index.solid)
    }
    assert.ok(impact, 'a 360 km/h side impact must not pass through the wall')
    assert.equal(impact.surface, 'obstacle')
    assert.ok(impact.normalSpeed > 10)
    assert.ok(body.translation().x < 10)
  } finally { world.free(); index.dispose(); arena.dispose() }
})
