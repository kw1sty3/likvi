import React from 'react'

// These descriptors also construct the trusted server collision map.
export default function CollisionParts({ parts, textures }) {
  return parts.map((part, index) => {
    const Geometry = `${part.shape}Geometry`
    return <mesh key={index} position={part.position} rotation={part.rotation} scale={part.scale}
      castShadow={part.castShadow ?? !part.glow} receiveShadow userData={{ isCollidable: part.collidable !== false }}>
      <Geometry args={part.args ?? part.size} />
      <meshStandardMaterial color={part.color} roughness={part.roughness ?? 0.72} metalness={part.metalness ?? 0.12}
        map={textures?.[part.material]}
        emissive={part.glow ? part.color : '#000000'} emissiveIntensity={part.glow ? 1.7 : 0} />
    </mesh>
  })
}
