import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'

function PropellerParticles({ position, speed, throttle }) {
  const particlesRef = useRef()
  
  const particles = useMemo(() => {
    const count = 50
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      // Случайное положение в круге
      const angle = Math.random() * Math.PI * 2
      const radius = Math.random() * 0.2
      
      positions[i3] = Math.cos(angle) * radius
      positions[i3 + 1] = Math.random() * 0.1 - 0.05
      positions[i3 + 2] = Math.sin(angle) * radius
      
      velocities[i3] = Math.cos(angle) * 0.01
      velocities[i3 + 1] = -0.02 - Math.random() * 0.02
      velocities[i3 + 2] = Math.sin(angle) * 0.01
    }
    
    return { positions, velocities }
  }, [])
  
  useFrame((state, delta) => {
    if (!particlesRef.current || throttle < 0.3) return
    
    const positions = particlesRef.current.geometry.attributes.position.array
    const velocities = particles.velocities
    
    for (let i = 0; i < positions.length; i += 3) {
      // Обновление позиции
      positions[i] += velocities[i] * speed * delta * 10
      positions[i + 1] += velocities[i + 1] * speed * delta * 10
      positions[i + 2] += velocities[i + 2] * speed * delta * 10
      
      // Сброс при выходе за границы
      if (positions[i + 1] < -0.5 || Math.abs(positions[i]) > 0.5 || Math.abs(positions[i + 2]) > 0.5) {
        const angle = Math.random() * Math.PI * 2
        const radius = Math.random() * 0.2
        positions[i] = Math.cos(angle) * radius
        positions[i + 1] = 0
        positions[i + 2] = Math.sin(angle) * radius
      }
    }
    
    particlesRef.current.geometry.attributes.position.needsUpdate = true
  })
  
  if (throttle < 0.3) return null
  
  return (
    <points ref={particlesRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particles.positions.length / 3}
          array={particles.positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.02}
        color={0xffffff}
        transparent
        opacity={0.6}
        sizeAttenuation={true}
      />
    </points>
  )
}

export default PropellerParticles
