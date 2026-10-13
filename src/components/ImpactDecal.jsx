import React, { useEffect, useState } from 'react'
import { createPortal, useThree } from '@react-three/fiber'
import { animated, useSpring } from '@react-spring/three'
import { useSimulatorStore } from '../store/useSimulatorStore'
import { createImpactDecal, createImpactTexture } from '../physics/impactDecal'

function Mark({ impact }) {
  const scene = useThree(state => state.scene)
  const [decal, setDecal] = useState(null)
  const [{ opacity }, api] = useSpring(() => ({ opacity: 0 }))
  useEffect(() => {
    const mark = createImpactDecal(scene, impact)
    if (!mark) return
    mark.texture = createImpactTexture()
    setDecal(mark)
    void api.start({ opacity: 0.85, config: { duration: 120 } })
    return () => { api.stop(); mark.dispose(); mark.texture.dispose() }
  }, [scene, impact, api])
  if (!decal) return null
  return createPortal(<mesh name="impact-decal" geometry={decal.geometry} renderOrder={2}>
    <animated.meshBasicMaterial map={decal.texture} transparent opacity={opacity}
      depthWrite={false} polygonOffset polygonOffsetFactor={-10} polygonOffsetUnits={-10} />
  </mesh>, decal.target)
}

export default function ImpactDecal() {
  const impact = useSimulatorStore(state => state.crashInfo)
  return impact?.kind === 'solid' ? <Mark key={impact.id} impact={impact} /> : null
}
