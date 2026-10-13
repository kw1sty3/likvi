import React from 'react'
import { OrbitControls } from '@react-three/drei'

function Camera() {
  return (
    <OrbitControls
      enableDamping
      dampingFactor={0.05}
      minDistance={5}
      maxDistance={50}
      enablePan={false}
      enableZoom={true}
    />
  )
}

export default Camera
