import React, { useLayoutEffect, useMemo, useState } from 'react'
import { CuboidCollider, RigidBody, TrimeshCollider } from '@react-three/rapier'
import { createStaticCollisionWorld } from '../physics/staticCollisionWorld'
import { getFpvCollisionShapes } from '../physics/fpvCollisionShapes'

// Build static collision geometry and its BVH once per arena mount.
function CollisionDetector({ terrainRef, collisionWorldRef, track }) {
  const [index, setIndex] = useState(null)
  const shapes = useMemo(() => track ? getFpvCollisionShapes(track) : null, [track])
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
      {shapes ? shapes.map((shape, key) => {
        const Collider = shape.kind === 'cuboid' ? CuboidCollider : TrimeshCollider
        return <Collider key={key} args={shape.args} position={shape.position} rotation={shape.rotation}
          friction={0.65} restitution={0.1} />
      }) : <TrimeshCollider
        args={[index.solid.geometry.attributes.position.array, index.solid.geometry.index.array]}
        friction={0.65}
        restitution={0.1}
      />}
    </RigidBody>
  )
}
export default CollisionDetector
