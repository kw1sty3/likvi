import React from 'react'
import { useSimulatorStore } from '../store/useSimulatorStore'
import Propeller from './Propeller'
import PropellerParticles from './PropellerParticles'
import ImpactResponse from './ImpactResponse'

const propellerPositions = [
  { x: 1.2, z: 1.2, rotation: 1 },
  { x: -1.2, z: 1.2, rotation: -1 },
  { x: 1.2, z: -1.2, rotation: -1 },
  { x: -1.2, z: -1.2, rotation: 1 }
]

function Quadcopter() {
  const particleEffects = useSimulatorStore(state => state.particleEffects)
  const throttle = useSimulatorStore(state => state.throttle)
  const isFlying = useSimulatorStore(state => state.isFlying)

  const propellerSpeed = isFlying && throttle > 0 ? throttle * 20 + 5 : 0

  return (
    <group userData={{ isQuadcopter: true }}>
      <ImpactResponse>
      <mesh castShadow receiveShadow position={[0, 0, 0]} scale={[1.1, 0.42, 1.1]}>
        <sphereGeometry args={[0.72, 28, 18]} />
        <meshStandardMaterial color="#d7262f" metalness={0.62} roughness={0.24} />
      </mesh>

      <mesh castShadow receiveShadow position={[0, 0.18, 0]}>
        <boxGeometry args={[0.95, 0.12, 0.95]} />
        <meshStandardMaterial color="#171b22" metalness={0.72} roughness={0.18} />
      </mesh>

      <mesh castShadow receiveShadow position={[0, -0.22, 0]}>
        <boxGeometry args={[0.7, 0.22, 1.0]} />
        <meshStandardMaterial color="#252b34" metalness={0.25} roughness={0.42} />
      </mesh>

      <mesh castShadow receiveShadow position={[0, -0.08, -0.7]}>
        <boxGeometry args={[0.56, 0.18, 0.34]} />
        <meshStandardMaterial color="#20242b" metalness={0.35} roughness={0.32} />
      </mesh>

      <mesh castShadow receiveShadow position={[0, -0.1, 0.68]}>
        <boxGeometry args={[0.28, 0.18, 0.2]} />
        <meshStandardMaterial color="#0d1014" metalness={0.55} roughness={0.18} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, -0.1, 0.82]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.095, 0.095, 0.08, 24]} />
        <meshStandardMaterial color="#050608" metalness={0.72} roughness={0.12} />
      </mesh>
      <mesh position={[0, -0.1, 0.865]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.018, 24]} />
        <meshStandardMaterial color="#5f7f9d" emissive="#0c2038" emissiveIntensity={0.35} metalness={0.25} roughness={0.08} />
      </mesh>

      {[0, Math.PI / 2].map((rotation) => (
        <mesh key={rotation} castShadow receiveShadow rotation={[0, rotation, Math.PI / 2]}>
          <cylinderGeometry args={[0.055, 0.055, 3.45, 20]} />
          <meshStandardMaterial color="#161a20" metalness={0.74} roughness={0.2} />
        </mesh>
      ))}

      {[
        [-0.48, -0.5, 0.48],
        [0.48, -0.5, 0.48],
        [-0.48, -0.5, -0.48],
        [0.48, -0.5, -0.48]
      ].map((position) => (
        <mesh key={position.join('-')} castShadow receiveShadow position={position}>
          <cylinderGeometry args={[0.035, 0.035, 0.58, 12]} />
          <meshStandardMaterial color="#20242a" metalness={0.65} roughness={0.24} />
        </mesh>
      ))}

      {[-0.52, 0.52].map((x) => (
        <mesh key={x} castShadow receiveShadow position={[x, -0.78, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 1.42, 12]} />
          <meshStandardMaterial color="#1d2229" metalness={0.7} roughness={0.28} />
        </mesh>
      ))}

      {propellerPositions.map((pos, index) => (
        <group key={index}>
          <mesh castShadow receiveShadow position={[pos.x, 0.3, pos.z]}>
            <cylinderGeometry args={[0.075, 0.095, 0.72, 18]} />
            <meshStandardMaterial color="#303740" metalness={0.7} roughness={0.26} />
          </mesh>

          <mesh castShadow receiveShadow position={[pos.x, 0.59, pos.z]}>
            <cylinderGeometry args={[0.16, 0.13, 0.18, 24]} />
            <meshStandardMaterial color="#1b2027" metalness={0.82} roughness={0.18} />
          </mesh>

          <mesh castShadow receiveShadow position={[pos.x, 0.71, pos.z]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.63, 0.025, 10, 64]} />
            <meshStandardMaterial color="#202832" metalness={0.42} roughness={0.34} />
          </mesh>

          <Propeller
            position={[pos.x, 0.75, pos.z]}
            speed={propellerSpeed * pos.rotation}
            throttle={throttle}
          />

          {particleEffects && isFlying && (
            <PropellerParticles
              position={[pos.x, 0.75, pos.z]}
              speed={propellerSpeed}
              throttle={throttle}
            />
          )}
        </group>
      ))}

      <mesh position={[0.62, 0.27, 0.42]}>
        <sphereGeometry args={[0.075, 16, 10]} />
        <meshStandardMaterial color="#ff3333" emissive="#ff1f1f" emissiveIntensity={1.25} />
      </mesh>
      <mesh position={[-0.62, 0.27, 0.42]}>
        <sphereGeometry args={[0.075, 16, 10]} />
        <meshStandardMaterial color="#2d6cff" emissive="#245bff" emissiveIntensity={1.25} />
      </mesh>
      <mesh position={[0, 0.46, -0.26]}>
        <sphereGeometry args={[0.06, 16, 8]} />
        <meshStandardMaterial color="#80ffc4" emissive="#62ffb2" emissiveIntensity={0.9} />
      </mesh>
      </ImpactResponse>
    </group>
  )
}

export default Quadcopter
