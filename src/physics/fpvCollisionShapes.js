import { ConeGeometry, CylinderGeometry, Euler, Quaternion, TorusGeometry } from 'three'
import { GATE_TUBE } from './fpvTracks.js'

const cache = new WeakMap()

// Give Rapier small broad-phase bounds. A world-sized trimesh makes every drone
// collider/CCD sweep query the entire arena, even when no obstacle is nearby.
export function getFpvCollisionShapes(track) {
  if (cache.has(track)) return cache.get(track)
  const shapes = []
  const add = (part, geometry) => {
    const shape = { position: part.position, rotation: part.rotation ?? [0, 0, 0] }
    if (geometry) {
      if (part.scale) geometry.scale(...part.scale)
      shape.kind = 'trimesh'
      shape.args = [geometry.attributes.position.array, Uint32Array.from(geometry.index.array)]
      geometry.dispose()
    } else {
      shape.kind = 'cuboid'
      shape.args = part.size.map((value, axis) => value * Math.abs(part.scale?.[axis] ?? 1) / 2)
    }
    shapes.push(shape)
  }
  for (const part of track.parts) {
    if (part.collidable === false) continue
    const Geometry = { cylinder: CylinderGeometry, cone: ConeGeometry }[part.shape]
    add(part, Geometry ? new Geometry(...(part.args ?? part.size)) : null)
  }
  for (const gate of track.gates) add({ position: [gate.position.x, gate.position.y, gate.position.z], rotation: [0, gate.yaw, 0] },
    new TorusGeometry(gate.radius, GATE_TUBE, 8, 48))
  for (const sign of track.signs) add({ position: sign.position, rotation: sign.rotation, size: [sign.width, sign.height, 0.12] })
  cache.set(track, shapes)
  return shapes
}

// Headless simulation and the browser consume the same collider descriptors.
export function createFpvColliders(RAPIER, world, track) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  body.userData = { surface: 'obstacle', staticBvh: true }
  for (const shape of getFpvCollisionShapes(track)) {
    const rotation = new Quaternion().setFromEuler(new Euler(...shape.rotation))
    const descriptor = RAPIER.ColliderDesc[shape.kind](...shape.args)
      .setTranslation(...shape.position).setRotation(rotation).setFriction(0.65).setRestitution(0.1)
    world.createCollider(descriptor, body)
  }
  return body
}
