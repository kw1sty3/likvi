import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useSimulatorStore } from '../store/useSimulatorStore'

function Propeller({ position, direction }) {
  const propellerRef = useRef()
  const bladeRef = useRef(), secondBladeRef = useRef(), blurRef = useRef()
  
  useFrame((_, delta) => {
    const { throttle, isFlying } = useSimulatorStore.getState()
    const speed = isFlying && throttle > 0 ? (throttle * 20 + 5) * direction : 0
    const blurOpacity = Math.min(0.34, Math.max(0, throttle - 0.15) * 0.52)
    const bladeOpacity = throttle > 0.55 ? 0.45 : 0.92
    bladeRef.current.opacity = secondBladeRef.current.opacity = bladeOpacity
    blurRef.current.opacity = blurOpacity
    blurRef.current.visible = blurOpacity > 0
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
            ref={bladeRef}
            color="#d9dde2"
            metalness={0.48}
            roughness={0.28}
            transparent
            opacity={0.92}
          />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]} castShadow>
          <boxGeometry args={[0.96, 0.025, 0.13]} />
          <meshStandardMaterial 
            ref={secondBladeRef}
            color="#d9dde2"
            metalness={0.48}
            roughness={0.28}
            transparent
            opacity={0.92}
          />
        </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.62, 64]} />
            <meshBasicMaterial ref={blurRef} color="#eaf7ff" transparent opacity={0} depthWrite={false} />
          </mesh>
      </group>
    </mesh>
  )
}

export default Propeller
