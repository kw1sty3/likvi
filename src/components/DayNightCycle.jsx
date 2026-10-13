import React, { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useSimulatorStore } from '../store/useSimulatorStore'
import * as THREE from 'three'

function DayNightCycle() {
  const sunRef = useRef()
  const { scene } = useThree()
  
  useFrame((state) => {
    // Дневной/ночной цикл (24 часа = 5 минут реального времени)
    const dayLength = 300 // секунд
    const timeOfDay = (state.clock.elapsedTime % dayLength) / dayLength
    
    // Позиция солнца (0 = полночь, 0.5 = полдень, 1 = полночь)
    const sunAngle = timeOfDay * Math.PI * 2
    const sunElevation = Math.sin(timeOfDay * Math.PI) // Высота солнца
    const sunDistance = 200
    
    // Обновляем позицию солнца если есть ref
    if (sunRef.current) {
      sunRef.current.position.x = Math.cos(sunAngle) * sunDistance
      sunRef.current.position.y = sunElevation * sunDistance
      sunRef.current.position.z = Math.sin(sunAngle) * sunDistance
      
      // Интенсивность света зависит от времени суток
      const lightIntensity = Math.max(0.5, sunElevation)
      sunRef.current.intensity = lightIntensity * 1.5
    }
    
    // Цвет неба меняется
    const skyColor = new THREE.Color()
    if (sunElevation > 0) {
      // День
      skyColor.setHSL(0.6, 0.3, 0.7 + sunElevation * 0.3)
    } else {
      // Ночь
      skyColor.setHSL(0.6, 0.3, 0.1)
    }
    
    // Обновляем цвет фона сцены
    scene.background = skyColor
    
    // Обновляем store с информацией о времени суток
    useSimulatorStore.getState().updateState({
      timeOfDay: timeOfDay,
      isDay: sunElevation > 0.1,
      sunElevation: sunElevation
    })
  })
  
  return (
    <directionalLight
      ref={sunRef}
      position={[100, 100, 100]}
      intensity={1.5}
      castShadow
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-camera-far={1000}
      shadow-camera-left={-200}
      shadow-camera-right={200}
      shadow-camera-top={200}
      shadow-camera-bottom={-200}
      shadow-bias={-0.0001}
    />
  )
}

export default DayNightCycle
