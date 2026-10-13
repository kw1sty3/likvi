import React, { useLayoutEffect, useState } from 'react'
import { RigidBody, TrimeshCollider } from '@react-three/rapier'
import { createStaticCollisionWorld } from '../physics/staticCollisionWorld'

// Build static collision geometry and its BVH once per arena mount.
function CollisionDetector({ terrainRef, collisionWorldRef }) {
  const [index, setIndex] = useState(null)
  useLayoutEffect(() => {
    const next = createStaticCollisionWorld(terrainRef.current)
    collisionWorldRef.current = next
    setIndex(next)
    return () => {
      collisionWorldRef.current = null
      next.dispose()
    }
  }, [terrainRef, collisionWorldRef])

  if (!index?.solid) return null
  return (
    <RigidBody type="fixed" colliders={false} userData={{ surface: 'obstacle', staticBvh: true }}>
      <TrimeshCollider
        args={[index.solid.geometry.attributes.position.array, index.solid.geometry.index.array]}
        friction={0.65}
        restitution={0.1}
      />
    </RigidBody>
  )
}
export default CollisionDetector
