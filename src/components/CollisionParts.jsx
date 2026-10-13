import React from 'react'

// These descriptors also construct the trusted server collision map.
export default function CollisionParts({ parts }) {
  return parts.map((part, index) => {
    const Geometry = `${part.shape}Geometry`
    return <mesh key={index} position={part.position} rotation={part.rotation} scale={part.scale}
      castShadow={part.castShadow ?? true} receiveShadow userData={{ isCollidable: true }}>
      <Geometry args={part.args} />
      <meshStandardMaterial color={part.color} roughness={part.roughness ?? 0.72} metalness={part.metalness ?? 0.12} />
    </mesh>
  })
}
