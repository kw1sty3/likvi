import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending } from 'three'
import { animated, useSpring } from '@react-spring/three'
import { useSimulatorStore } from '../store/useSimulatorStore'
import { createImpactParticles, sampleImpactParticles } from '../physics/impactEffects'

function Burst({ impact }) {
  const points = useRef(), startedAt = useRef(null)
  const particles = useMemo(() => createImpactParticles(impact), [impact])
  useFrame(({ clock }) => {
    if (!points.current) return
    startedAt.current ??= clock.elapsedTime
    const age = clock.elapsedTime - startedAt.current
    points.current.visible = sampleImpactParticles(particles, age)
    if (!points.current.visible) return
    points.current.geometry.attributes.position.needsUpdate = true
    points.current.material.opacity = Math.max(0, 1 - age / particles.lifetime)
  })
  return <points ref={points} name="impact-particles" position={[impact.point.x, impact.point.y, impact.point.z]} frustumCulled={false}>
    <bufferGeometry>
      <bufferAttribute attach="attributes-position" args={[particles.positions, 3]} />
      <bufferAttribute attach="attributes-color" args={[particles.colors, 3]} />
    </bufferGeometry>
    <pointsMaterial size={particles.size} vertexColors transparent depthWrite={false} blending={AdditiveBlending} />
  </points>
}

function WaterRipple({ impact }) {
  const [{ radius, opacity }, api] = useSpring(() => ({ radius: 0.2, opacity: 0.65 }))
  useEffect(() => {
    void api.start({ radius: 2.4, opacity: 0, config: { duration: 1600 } })
    return () => api.stop()
  }, [api])
  return <animated.mesh name="water-impact-ripple" position={[impact.point.x, impact.point.y + 0.025, impact.point.z]}
    rotation={[-Math.PI / 2, 0, 0]} scale={radius}>
    <ringGeometry args={[0.86, 1, 48]} />
    <animated.meshBasicMaterial color="#c7f3ff" transparent opacity={opacity} depthWrite={false} />
  </animated.mesh>
}

export default function CrashParticles() {
  const impact = useSimulatorStore(state => state.crashInfo)
  const enabled = useSimulatorStore(state => state.particleEffects)
  const active = useRef({ id: null, enabled: false })
  if (active.current.id !== impact?.id) active.current = { id: impact?.id, enabled }
  // Turning particles off is final for this burst, including a later re-enable.
  if (!enabled) active.current.enabled = false
  if (!impact || impact.kind === 'bounds' || !enabled || !active.current.enabled) return null
  return <React.Fragment key={impact.id}>
    <Burst impact={impact} />
    {impact.kind === 'water' && <WaterRipple impact={impact} />}
  </React.Fragment>
}
