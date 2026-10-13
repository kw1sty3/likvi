import React from 'react'
import { useSimulatorStore } from '../store/useSimulatorStore'

function ChallengeRings() {
  const rings = useSimulatorStore((state) => state.rings)
  const activeRingIndex = useSimulatorStore((state) => state.activeRingIndex)
  const competitionStatus = useSimulatorStore((state) => state.competitionStatus)
  const activeRing = rings[activeRingIndex]

  if (!['countdown', 'running'].includes(competitionStatus) || !activeRing) {
    return null
  }

  return (
    <group position={[activeRing.position.x, activeRing.position.y, activeRing.position.z]}>
      <mesh>
        <torusGeometry args={[activeRing.radius, 0.18, 20, 96]} />
        <meshStandardMaterial
          color={activeRing.color}
          emissive={activeRing.color}
          emissiveIntensity={activeRing.finish ? 1.1 : 0.8}
          metalness={0.2}
          roughness={0.25}
        />
      </mesh>
      <pointLight color={activeRing.color} intensity={activeRing.finish ? 2.5 : 1.5} distance={18} />
    </group>
  )
}

export default ChallengeRings
