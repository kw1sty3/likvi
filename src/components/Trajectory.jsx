import React, { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useSimulatorStore } from '../store/useSimulatorStore'
import * as THREE from 'three'

function Trajectory() {
  const lineRef = useRef()
  const { trajectory, showTrajectory } = useSimulatorStore()
  
  useEffect(() => {
    if (!lineRef.current || !showTrajectory) return
    
    if (trajectory.length > 1) {
      const positions = new Float32Array(trajectory.length * 3)
      trajectory.forEach((point, i) => {
        positions[i * 3] = point.x
        positions[i * 3 + 1] = point.y
        positions[i * 3 + 2] = point.z
      })
      
      const geometry = lineRef.current.geometry
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(positions, 3)
      )
      geometry.attributes.position.needsUpdate = true
    }
  }, [trajectory, showTrajectory])
  
  if (!showTrajectory || trajectory.length < 2) {
    return null
  }
  
  return (
    <line ref={lineRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={trajectory.length}
          array={new Float32Array(trajectory.length * 3)}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color={0x00ff00} linewidth={2} />
    </line>
  )
}

export default Trajectory
