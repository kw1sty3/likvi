import { useFrame } from '@react-three/fiber'
import { useSimulatorStore } from '../store/useSimulatorStore'

function FlightStats() {
  useFrame((state, delta) => {
    const { isFlying, altitude, gps, flightTime, maxAltitude, trajectory, showTrajectory } = useSimulatorStore.getState()
    
    // Обновление времени полета
    if (isFlying && altitude > 1) {
      const newFlightTime = flightTime + delta
      const newMaxAltitude = Math.max(maxAltitude, altitude)
      const newDistance = Math.sqrt(gps.x ** 2 + gps.z ** 2)
      
      useSimulatorStore.getState().updateState({
        flightTime: newFlightTime,
        maxAltitude: newMaxAltitude,
        distance: newDistance
      })
      
      // Добавление точек траектории
      if (showTrajectory) {
        const newTrajectory = [...trajectory, { x: gps.x, y: altitude, z: gps.z }]
        // Ограничиваем количество точек
        if (newTrajectory.length > 1000) {
          newTrajectory.shift()
        }
        useSimulatorStore.getState().updateState({ trajectory: newTrajectory })
      }
    }
  })
  
  return null
}

export default FlightStats
