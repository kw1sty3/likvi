import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useSimulatorStore } from '../store/useSimulatorStore'

function FlightStats() {
  const pending = useRef({ revision: -1, elapsed: 0, peak: 0 })
  useFrame((_, delta) => {
    const state = useSimulatorStore.getState(), sample = pending.current
    if (sample.revision !== state.flightRevision) {
      sample.revision = state.flightRevision
      sample.elapsed = 0
      sample.peak = state.maxAltitude
    }
    const flying = state.isFlying && state.altitude > 1
    if (flying) {
      sample.elapsed += delta
      sample.peak = Math.max(sample.peak, state.altitude)
    }
    // Accumulate every frame, publish at 10 Hz and flush on landing/finish.
    if (sample.elapsed === 0 || (flying && sample.elapsed < 0.1)) return
    const update = { flightTime: state.flightTime + sample.elapsed, maxAltitude: sample.peak,
      distance: Math.hypot(state.gps.x, state.gps.z) }
    if (state.showTrajectory) update.trajectory = [...state.trajectory.slice(-999),
      { x: state.gps.x, y: state.altitude, z: state.gps.z }]
    sample.elapsed = 0
    state.updateState(update)
  })
  return null
}

export default FlightStats
