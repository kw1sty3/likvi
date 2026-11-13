import React, { useRef, useMemo, useLayoutEffect } from 'react'
import { useSimulatorStore } from '../store/useSimulatorStore'

function Trajectory() {
  const lineRef = useRef()
  const trajectory = useSimulatorStore(state => state.trajectory)
  const showTrajectory = useSimulatorStore(state => state.showTrajectory)
  const positions = useMemo(() => new Float32Array(1000 * 3), [])
  useLayoutEffect(() => {
    if (!lineRef.current) return
    const count = Math.min(1000, trajectory.length)
    for (let i = 0; i < count; i++) {
      const point = trajectory[trajectory.length - count + i]
      positions[i * 3] = point.x
      positions[i * 3 + 1] = point.y
      positions[i * 3 + 2] = point.z
    }
    const geometry = lineRef.current.geometry
    geometry.setDrawRange(0, count)
    geometry.attributes.position.needsUpdate = true
  }, [trajectory, showTrajectory, positions])

  if (!showTrajectory) return null
  return <line ref={lineRef} frustumCulled={false}>
    <bufferGeometry>
      <bufferAttribute attach="attributes-position" args={[positions, 3]} />
    </bufferGeometry>
    <lineBasicMaterial color={0x00ff00} linewidth={2} />
  </line>
}

export default Trajectory
