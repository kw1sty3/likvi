import React, { useEffect } from 'react'
import { animated, useSpring } from '@react-spring/three'
import { useSimulatorStore } from '../store/useSimulatorStore'
import { impactSpring } from '../physics/impactEffects'

export default function ImpactResponse({ children }) {
  const impact = useSimulatorStore(state => state.crashInfo)
  const [{ flex }, api] = useSpring(() => ({ flex: 0 }))
  useEffect(() => {
    api.stop()
    if (!impact) { api.set({ flex: 0 }); return }
    const { kick, config } = impactSpring(impact)
    api.set({ flex: kick })
    void api.start({ flex: 0, config })
    return () => api.stop()
  }, [impact, api])
  return <animated.group name="impact-response" scale={flex.to(value => [1 + value * 0.2, 1 - value, 1 + value * 0.2])}>
    {children}
  </animated.group>
}
