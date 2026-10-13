import React from 'react'

// Простой куб для отладки - если видите куб, значит 3D работает
function DebugCube() {
  return (
    <mesh position={[5, 5, 5]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="hotpink" />
    </mesh>
  )
}

export default DebugCube
