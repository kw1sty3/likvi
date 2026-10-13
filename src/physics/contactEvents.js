import { Vector3 } from 'three'
import { nearestSurface } from './staticCollisionWorld.js'

// Capture before the solver changes velocities at impact. Fixed bodies have no
// contribution; dynamic and kinematic obstacles may strike a stationary drone.
export function snapshotBodyMotions(world, excludedBody) {
  const motions = new Map()
  world.forEachRigidBody(body => {
    if (body.handle === excludedBody?.handle || body.isFixed() || !body.isEnabled()) return
    motions.set(body.handle, {
      center: body.worldCom(), velocity: body.linvel(), angular: body.angvel()
    })
  })
  return motions
}

// Called after every Rapier step, before rendering. Query only current contact
// pairs, not every obstacle in the scene. Gentle resting contacts are allowed.
export function findCrashContact(world, body, previousCenter, previousVelocity, previousAngular, solidIndex, motions) {
  let impact = null
  for (let i = 0; i < body.numColliders(); i++) {
    const collider = body.collider(i)
    world.contactPairsWith(collider, other => {
      if (other.isSensor()) return
      world.contactPair(collider, other, manifold => {
        if (manifold.numSolverContacts() === 0) return
        for (let contact = 0; contact < manifold.numSolverContacts(); contact++) {
          const normal = new Vector3().copy(manifold.normal())
          const point = manifold.solverContactPoint(contact)
          const lever = new Vector3().copy(point).sub(previousCenter)
          // Rapier may flip manifold order. Effects always point out of the
          // obstacle, towards the drone; separating contacts cannot cause a crash.
          if (normal.dot(lever) > 0) normal.negate()
          const pointVelocity = new Vector3().copy(previousAngular).cross(lever).add(previousVelocity)
          const otherBody = other.parent()
          const motion = motions?.get(otherBody?.handle)
          if (motion) {
            const otherLever = new Vector3().copy(point).sub(motion.center)
            const otherVelocity = new Vector3().copy(motion.angular).cross(otherLever).add(motion.velocity)
            pointVelocity.sub(otherVelocity)
          }
          const normalSpeed = Math.max(0, -pointVelocity.dot(normal))
          const ground = otherBody?.userData?.surface === 'ground'
          if (normalSpeed < (ground ? 4 : 3) || normalSpeed <= (impact?.normalSpeed ?? 0)) continue
          const surface = otherBody?.userData?.staticBvh ? nearestSurface(solidIndex, point, 0.5) : null
          impact = {
            reason: ground ? 'Жёсткая посадка' : otherBody?.userData?.surface === 'moving-gate'
              ? 'Удар подвижных ворот' : 'Столкновение с препятствием',
            point: surface?.point ?? other.projectPoint(point, false)?.point ?? point,
            normal,
            surface: ground ? 'ground' : otherBody?.userData?.surface ?? 'obstacle',
            normalSpeed,
            speed: pointVelocity.length() * 3.6
          }
        }
      })
    })
  }
  return impact
}
