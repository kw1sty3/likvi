import test from 'node:test'
import assert from 'node:assert/strict'
import RAPIER from '@dimforge/rapier3d-compat'
import { Euler, Group, Mesh, PlaneGeometry, Quaternion, Vector3 } from 'three'
import { createDroneBody, freezeDrone, PHYSICS_STEP, resetDrone } from '../src/physics/dronePhysics.js'
import { findCrashContact } from '../src/physics/contactEvents.js'
import { createStaticCollisionWorld, waterContact } from '../src/physics/staticCollisionWorld.js'

await RAPIER.init()
function makeWorld(gravity = -9.81) {
  const world = new RAPIER.World({ x: 0, y: gravity, z: 0 })
  world.timestep = PHYSICS_STEP
  world.integrationParameters.numSolverIterations = 8
  world.integrationParameters.maxCcdSubsteps = 4
  return world
}
function ground(world) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.25, 0))
  body.userData = { surface: 'ground' }
  return world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.25, 30), body)
}
function stepContact(world, body) {
  const center = body.worldCom(), velocity = body.linvel(), angular = body.angvel()
  world.step()
  return findCrashContact(world, body, center, velocity, angular)
}

test('CCD blocks 300 m/s approaches from four directions with a rotated drone and a 5 cm wall', () => {
  for (const axis of ['x', 'z']) for (const sign of [-1, 1]) {
    const world = makeWorld(0)
    try {
      const wall = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(axis === 'x' ? sign * 5 : 0, 5, axis === 'z' ? sign * 5 : 0))
      world.createCollider(RAPIER.ColliderDesc.cuboid(axis === 'x' ? 0.025 : 10, 10, axis === 'z' ? 0.025 : 10), wall)
      const drone = createDroneBody(RAPIER, world, { x: 0, y: 5, z: 0 })
      drone.setRotation(new Quaternion().setFromEuler(new Euler(0.2, 0.6, 0.1)), true)
      drone.setLinvel({ x: axis === 'x' ? sign * 300 : 0, y: 0, z: axis === 'z' ? sign * 300 : 0 }, true)
      let impact = null
      for (let i = 0; i < 15; i++) {
        const contact = stepContact(world, drone)
        impact ||= contact
        assert.ok(drone.translation()[axis] * sign < 5, `tunnelling: ${axis}, ${sign}`)
      }
      assert.ok(impact)
      assert.ok(impact.normal[axis] * sign < -0.9)
      assert.ok(impact.normalSpeed > 290)
    } finally { world.free() }
  }
})

test('impact normals and ground points do not depend on rigid-body creation order', () => {
  for (const droneFirst of [true, false]) {
    const world = makeWorld()
    try {
      let drone
      if (droneFirst) drone = createDroneBody(RAPIER, world, { x: 0, y: 8, z: 0 })
      ground(world)
      if (!droneFirst) drone = createDroneBody(RAPIER, world, { x: 0, y: 8, z: 0 })
      let impact = null
      for (let i = 0; i < 180 && !impact; i++) impact = stepContact(world, drone)
      assert.ok(impact)
      assert.ok(impact.normal.y > 0.999)
      assert.ok(Math.abs(impact.point.y) < 1e-5)
      assert.equal(impact.surface, 'ground')
    } finally { world.free() }
  }
})

test('real resting contacts reject fast separation and tangential travel, but detect rotational impact at either end', () => {
  const world = makeWorld()
  try {
    const floor = ground(world)
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 1, 0))
    const collider = world.createCollider(RAPIER.ColliderDesc.cuboid(1, 1, 1), body)
    for (let i = 0; i < 20; i++) world.step()
    let contacts = 0
    world.contactPair(collider, floor, manifold => { contacts += manifold.numSolverContacts() })
    assert.ok(contacts >= 2)
    const center = body.worldCom(), zero = new Vector3()
    assert.equal(findCrashContact(world, body, center, new Vector3(0, 30, 0), zero), null)
    assert.equal(findCrashContact(world, body, center, new Vector3(300, 0, 0), zero), null)
    for (const angular of [new Vector3(5, 0, 0), new Vector3(-5, 0, 0)]) {
      const impact = findCrashContact(world, body, center, zero, angular)
      assert.ok(impact, 'one end of the rotating body approaches the ground')
      assert.ok(impact.normalSpeed > 4.9)
    }
  } finally { world.free() }
})

test('a fast fall crosses the exact water plane even when both rendered positions miss it', () => {
  const root = new Group(), river = new Mesh(new PlaneGeometry(10, 10))
  river.rotation.x = -Math.PI / 2
  river.userData = { isCollidable: true, collisionType: 'water' }; root.add(river)
  const index = createStaticCollisionWorld(root)
  try {
    const hit = waterContact(index.water, { x: 0, y: 20, z: 0 }, { x: 0, y: -10, z: 0 }, new Quaternion())
    assert.ok(hit); assert.ok(Math.abs(hit.y) < 1e-5)
    assert.equal(waterContact(index.water, { x: 30, y: 20, z: 0 }, { x: 30, y: -10, z: 0 }, new Quaternion()), null)
  } finally { index.dispose(); river.geometry.dispose() }
})

test('twenty crash/reset cycles restore finite motion without leaving extra physics objects', () => {
  const world = makeWorld()
  try {
    ground(world)
    const drone = createDroneBody(RAPIER, world, { x: 0, y: 8, z: 0 })
    const colliders = world.colliders.len()
    let firstSpeed
    for (let attempt = 0; attempt < 20; attempt++) {
      resetDrone(drone, { x: 0, y: 8, z: 0 }); drone.setEnabled(true)
      let impact = null
      for (let i = 0; i < 180 && !impact; i++) impact = stepContact(world, drone)
      assert.ok(impact)
      firstSpeed ??= impact.speed
      assert.ok(Math.abs(impact.speed - firstSpeed) < 0.01)
      freezeDrone(drone)
      assert.equal(world.bodies.len(), 2); assert.equal(world.colliders.len(), colliders)
      assert.ok(Object.values(drone.translation()).every(Number.isFinite))
      assert.equal(new Vector3().copy(drone.linvel()).length(), 0)
    }
  } finally { world.free() }
})
