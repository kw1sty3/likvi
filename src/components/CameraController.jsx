import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useSimulatorStore } from '../store/useSimulatorStore'
import * as THREE from 'three'
import { createDroneCamera } from '../camera/droneCamera'

function CameraController({ droneRef }) {
  const { camera, gl } = useThree()
  const orbitControlsRef = useRef()
  const [isShiftLocked, setIsShiftLocked] = useState(false)
  const cameraMode = useSimulatorStore(state => state.cameraMode)
  const updateCamera = useMemo(createDroneCamera, [])

  useEffect(() => {
    const canvas = gl.domElement
    const handleContextMenu = (event) => event.preventDefault()
    const handleKeyDown = (event) => {
      if (event.repeat || (event.code !== 'ShiftLeft' && event.code !== 'ShiftRight')) {
        return
      }

      const target = event.target
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement

      if (!isTyping) {
        setIsShiftLocked((value) => !value)
      }
    }

    canvas.addEventListener('contextmenu', handleContextMenu)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      canvas.removeEventListener('contextmenu', handleContextMenu)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [gl])

  // Physics/server interpolation runs at -2, then camera tracking, then OrbitControls at -1.
  useFrame(() => {
    updateCamera(camera, droneRef.current, cameraMode, isShiftLocked, orbitControlsRef.current)
  }, -1.5)

  if (cameraMode === 'fps' || cameraMode === 'follow') {
    return null
  }

  return (
    <OrbitControls
      ref={orbitControlsRef}
      enabled={!isShiftLocked}
      enableDamping
      dampingFactor={0.05}
      minDistance={5}
      maxDistance={100}
      enablePan={cameraMode === 'free'}
      enableZoom={true}
      mouseButtons={{
        LEFT: undefined,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE
      }}
    />
  )
}

export default CameraController
