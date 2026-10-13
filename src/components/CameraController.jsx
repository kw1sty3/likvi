import React, { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useSimulatorStore } from '../store/useSimulatorStore'
import * as THREE from 'three'

function CameraController() {
  const { camera, gl } = useThree()
  const orbitControlsRef = useRef()
  const [isShiftLocked, setIsShiftLocked] = useState(false)
  const { cameraMode, gps, rotation } = useSimulatorStore()

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

  useFrame(() => {
    const quadcopterPos = new THREE.Vector3(gps.x, gps.y, gps.z)

    if (quadcopterPos.length() < 0.1) {
      quadcopterPos.set(0, 0.5, 0)
    }

    if (isShiftLocked) {
      const lockedOffset = new THREE.Vector3(0, 7, 16).applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        rotation.y
      )
      const targetPos = quadcopterPos.clone().add(lockedOffset)
      camera.position.lerp(targetPos, 0.35)
      camera.lookAt(quadcopterPos.clone().add(new THREE.Vector3(0, 0.7, 0)))
      return
    }

    switch (cameraMode) {
      case 'fps':
        camera.position.copy(quadcopterPos)
        camera.position.y += 0.3
        camera.rotation.set(rotation.x, rotation.y, rotation.z)
        break

      case 'follow': {
        const offset = new THREE.Vector3(0, 12, 25)
        const targetPos = quadcopterPos.clone().add(offset)
        camera.position.lerp(targetPos, 0.2)
        const lookAtPos = quadcopterPos.clone()
        lookAtPos.y = Math.max(0.5, lookAtPos.y)
        camera.lookAt(lookAtPos)
        break
      }

      case 'orbit':
        if (orbitControlsRef.current) {
          orbitControlsRef.current.target.lerp(quadcopterPos, 0.1)
        }
        break

      case 'free':
        break

      default:
        break
    }
  })

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
