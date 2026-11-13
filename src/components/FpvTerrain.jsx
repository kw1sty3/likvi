import React, { useEffect, useMemo } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { Line } from '@react-three/drei'
import { CanvasTexture, DoubleSide, SRGBColorSpace } from 'three'
import { useSimulatorStore } from '../store/useSimulatorStore'
import { GATE_TUBE } from '../physics/fpvTracks'
import StaticTrackParts from './StaticTrackParts'
import TrackEnvironment, { useTrackTextures } from './TrackEnvironment'

function Gate({ gate, index, active, next, free }) {
  const color = active ? '#63ffbd' : next ? '#ffd079' : free ? '#96cbd3' : '#57717c'
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256; canvas.height = 128
    const context = canvas.getContext('2d')
    context.fillStyle = '#11222d'
    context.fillRect(0, 0, 256, 128)
    context.fillStyle = '#e7fbf5'
    context.font = 'bold 72px sans-serif'
    context.textAlign = 'center'
    context.fillText(String(index + 1).padStart(2, '0'), 128, 78)
    context.font = '18px sans-serif'
    context.fillText(gate.finish ? 'START / FINISH' : 'CHECKPOINT', 128, 111)
    const result = new CanvasTexture(canvas)
    result.colorSpace = SRGBColorSpace
    return result
  }, [index, gate.finish])
  useEffect(() => () => texture.dispose(), [texture])
  return <group position={[gate.position.x, gate.position.y, gate.position.z]} rotation={[0, gate.yaw, 0]}>
    <mesh userData={{ isCollidable: true }} castShadow>
      <torusGeometry args={[gate.radius, GATE_TUBE, 8, 48]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={active ? 1.25 : 0.22} roughness={0.48} />
    </mesh>
    <mesh position={[0, gate.radius + 1.1, 0]}>
      <planeGeometry args={[3.2, 1.6]} />
      <meshBasicMaterial map={texture} side={DoubleSide} toneMapped={false} />
    </mesh>
    {[-1, 1].map(side => <mesh key={side} position={[side * gate.radius, -gate.position.y / 2, 0]}>
      <boxGeometry args={[0.12, gate.position.y, 0.12]} />
      <meshStandardMaterial color="#6e8589" />
    </mesh>)}
    {active && <mesh position={[0, -gate.radius * 0.66, 0]} rotation={[0, 0, Math.PI]}>
      <coneGeometry args={[0.5, 1, 3]} />
      <meshBasicMaterial color="#63ffbd" toneMapped={false} side={DoubleSide} />
    </mesh>}
  </group>
}

export default function FpvTerrain({ terrainRef, track }) {
  const textures = useTrackTextures(track)
  const activeIndex = useSimulatorStore(state => state.activeRingIndex)
  const mode = useSimulatorStore(state => state.competitionMode)
  const guide = useSimulatorStore(state => state.showRaceGuide)
  const points = useMemo(() => [...track.gates, track.gates[0]].map(gate =>
    [gate.position.x, gate.position.y, gate.position.z]), [track])
  return <group ref={terrainRef}>
    <RigidBody type="fixed" colliders={false} userData={{ surface: 'ground' }}>
      <CuboidCollider args={[420, 0.25, 420]} position={[0, -0.25, 0]} friction={0.9} />
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} userData={{ impactSurface: 'ground' }}>
        <planeGeometry args={[840, 840]} />
        <meshStandardMaterial color={track.ground} map={textures.ground} roughness={0.95} />
      </mesh>
    </RigidBody>
    <StaticTrackParts parts={track.parts} textures={textures} />
    <TrackEnvironment track={track} textures={textures} />
    {track.gates.map((gate, index) => <Gate key={gate.id} gate={gate} index={index}
      active={mode !== 'free' && activeIndex === index} next={mode !== 'free' && activeIndex + 1 === index} free={mode === 'free'} />)}
    {guide && <Line points={points} color={track.accent} transparent opacity={0.26} lineWidth={1.5} dashed dashSize={1.2} gapSize={1.8} />}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[track.spawn.x, 0.015, track.spawn.z]}>
      <ringGeometry args={[3.8, 4.1, 48]} />
      <meshStandardMaterial color={track.accent} emissive={track.accent} emissiveIntensity={0.4} />
    </mesh>
    {[-1, 1].map(side => <mesh key={side} position={[track.spawn.x + side * 5.5, 0.03, track.spawn.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[1.4, 12]} />
      <meshBasicMaterial color="#eee8d4" />
    </mesh>)}
  </group>
}
