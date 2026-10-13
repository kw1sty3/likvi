import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

function Propeller({ position, speed, throttle }) {
  const propellerRef = useRef()
  const blurOpacity = Math.min(0.34, Math.max(0, throttle - 0.15) * 0.52)
  const bladeOpacity = throttle > 0.55 ? 0.45 : 0.92
  
  useFrame((_, delta) => {
    if (propellerRef.current) {
      propellerRef.current.rotation.y = (propellerRef.current.rotation.y + speed * 6 * delta) % (Math.PI * 2)
    }
  })
  
  return (
    <mesh ref={propellerRef} position={position}>
      <group>
        <mesh rotation={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.96, 0.025, 0.13]} />
          <meshStandardMaterial 
            color="#d9dde2"
            metalness={0.48}
            roughness={0.28}
            transparent
            opacity={bladeOpacity}
          />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]} castShadow>
          <boxGeometry args={[0.96, 0.025, 0.13]} />
          <meshStandardMaterial 
            color="#d9dde2"
            metalness={0.48}
            roughness={0.28}
            transparent
            opacity={bladeOpacity}
          />
        </mesh>
        {blurOpacity > 0 && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.62, 64]} />
            <meshBasicMaterial color="#eaf7ff" transparent opacity={blurOpacity} depthWrite={false} />
          </mesh>
        )}
      </group>
    </mesh>
  )
}

export default Propeller
