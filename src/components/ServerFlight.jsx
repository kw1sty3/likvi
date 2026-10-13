import React, { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Quaternion, Vector3 } from 'three'
import Quadcopter from './Quadcopter'
import { useKeyboardControls } from '../hooks/useKeyboardControls'
import { useSimulatorStore } from '../store/useSimulatorStore'
import { createServerFlightClient } from '../network/serverFlightClient'
import { START_POSITION } from '../physics/dronePhysics'

export default function ServerFlight() {
  const keys = useKeyboardControls()
  const group = useRef()
  const revision = useSimulatorStore(state => state.flightRevision)
  const display = useRef({ from: new Vector3(), to: new Vector3(), fromQ: new Quaternion(), toQ: new Quaternion(), at: 0, ready: false })
  useEffect(() => {
    display.current.ready = false
    const current = () => useSimulatorStore.getState().competitionMode === 'server' && useSimulatorStore.getState().flightRevision === revision
    const connection = createServerFlightClient({
      readKeys: () => keys.readWithTaps(),
      onSnapshot(snapshot) {
        if (!current()) return
        useSimulatorStore.getState().applyServerSnapshot(snapshot)
        const d = display.current
        d.from.copy(d.ready && group.current ? group.current.position : snapshot.position)
        d.fromQ.copy(d.ready && group.current ? group.current.quaternion : snapshot.quaternion)
        d.to.copy(snapshot.position); d.toQ.copy(snapshot.quaternion)
        if (snapshot.crashInfo) {
          d.from.copy(d.to); d.fromQ.copy(d.toQ)
          group.current?.position.copy(d.to)
          group.current?.quaternion.copy(d.toQ)
        }
        d.at = performance.now(); d.ready = true
      },
      onError(message) { if (current()) useSimulatorStore.getState().serverFlightError(message) }
    })
    void connection.start()
    return () => connection.stop()
  }, [revision, keys])
  useFrame(() => {
    const d = display.current
    if (!group.current || !d.ready) return
    const alpha = Math.min(1, (performance.now() - d.at) / 50)
    group.current.position.lerpVectors(d.from, d.to, alpha)
    group.current.quaternion.slerpQuaternions(d.fromQ, d.toQ, alpha)
  })
  return <group ref={group} position={[START_POSITION.x, START_POSITION.y, START_POSITION.z]}><Quadcopter /></group>
}
