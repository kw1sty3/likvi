import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Line } from '@react-three/drei'
import { BufferAttribute, BufferGeometry, CanvasTexture, CatmullRomCurve3, Color, DoubleSide, Object3D, RepeatWrapping, SRGBColorSpace, Vector3 } from 'three'

function surfaceTexture(kind, repeat = 1) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const context = canvas.getContext('2d'), pixels = context.createImageData(256, 256)
  let seed = 7429
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    const stripe = kind === 'grass' ? (Math.floor(y / 64) % 2) * 24 : 0
    const value = 185 + seed % (kind === 'asphalt' ? 65 : 45) - stripe
    const index = (y * 256 + x) * 4
    pixels.data.set([value, value, value, 255], index)
  }
  context.putImageData(pixels, 0, 0)
  if (kind === 'concrete' || kind === 'metal') {
    context.strokeStyle = kind === 'metal' ? '#728187' : '#9b9f9d'
    context.lineWidth = kind === 'metal' ? 2 : 1
    for (let x = 0; x < 256; x += kind === 'metal' ? 32 : 128) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 256); context.stroke() }
    if (kind === 'concrete') { context.beginPath(); context.moveTo(0, 128); context.lineTo(256, 128); context.stroke() }
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.repeat.set(repeat, repeat)
  texture.anisotropy = 4
  return texture
}

export function useTrackTextures(track) {
  const textures = useMemo(() => ({ ground: surfaceTexture(track.id === 'stadium' ? 'grass' : 'dirt', 45),
    asphalt: surfaceTexture('asphalt'), concrete: surfaceTexture('concrete'), metal: surfaceTexture('metal') }), [track.id])
  useEffect(() => () => Object.values(textures).forEach(texture => texture.dispose()), [textures])
  return textures
}

function InstancedDetails({ items, glow = false }) {
  const ref = useRef()
  useLayoutEffect(() => {
    if (!ref.current) return
    const object = new Object3D(), color = new Color()
    items.forEach((item, index) => {
      object.position.set(...item.position)
      object.rotation.set(...(item.rotation ?? [0, 0, 0]))
      object.scale.set(...item.size)
      object.updateMatrix()
      ref.current.setMatrixAt(index, object.matrix)
      ref.current.setColorAt(index, color.set(item.color))
    })
    ref.current.instanceMatrix.needsUpdate = true
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [items])
  if (!items.length) return null
  return <instancedMesh ref={ref} args={[null, null, items.length]} receiveShadow={!glow} userData={{ isCollidable: false }}>
    <boxGeometry args={[1, 1, 1]} />
    {glow ? <meshBasicMaterial toneMapped={false} /> : <meshStandardMaterial roughness={0.85} metalness={0.1} />}
  </instancedMesh>
}

function Sign({ data }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024; canvas.height = 256
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#122630'; ctx.fillRect(0, 0, 1024, 256)
    ctx.strokeStyle = data.color; ctx.lineWidth = 5; ctx.strokeRect(12, 12, 1000, 232)
    ctx.fillStyle = data.color
    for (let x = -20; x < 1040; x += 42) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 20, 0); ctx.lineTo(x + 8, 15); ctx.lineTo(x - 12, 15); ctx.fill()
    }
    ctx.textAlign = 'center'; ctx.fillStyle = '#eef5ed'
    ctx.font = `bold ${Math.min(88, 1350 / data.text.length)}px sans-serif`
    ctx.fillText(data.text, 512, 135)
    ctx.fillStyle = data.color; ctx.font = '28px sans-serif'; ctx.fillText(data.caption, 512, 199)
    const map = new CanvasTexture(canvas); map.colorSpace = SRGBColorSpace; map.anisotropy = 4
    return map
  }, [data])
  useEffect(() => () => texture.dispose(), [texture])
  return <mesh position={data.position} rotation={data.rotation} userData={{ isCollidable: true }}>
    <boxGeometry args={[data.width, data.height, 0.12]} />
    <meshStandardMaterial map={texture} emissiveMap={texture} emissive="#ffffff" emissiveIntensity={0.2} roughness={0.7} side={DoubleSide} />
  </mesh>
}

function trackRoad(track) {
  const points = track.id === 'construction' ? [[0, -112], [0, -30], [0, 62], [48, 62], [50, 28], [0, 14]] :
    track.gates.map(gate => [gate.position.x, gate.position.z])
  const curve = new CatmullRomCurve3(points.map(([x, z]) => new Vector3(x, 0.04, z)), track.id !== 'construction', 'centripetal')
  const count = 280, width = track.roadWidth, positions = [], uvs = [], indices = [], curbPositions = [[], []], curbColors = [[], []]
  const point = new Vector3(), tangent = new Vector3(), color = new Color()
  for (let i = 0; i <= count; i++) {
    curve.getPoint(i / count, point); curve.getTangent(i / count, tangent)
    const nx = -tangent.z, nz = tangent.x
    for (const side of [-1, 1]) {
      positions.push(point.x + nx * side * width / 2, 0.04, point.z + nz * side * width / 2)
      uvs.push(side === -1 ? 0 : 1, i / 8)
    }
    for (let curb = 0; curb < 2; curb++) {
      const side = curb === 0 ? -1 : 1
      color.set(Math.floor(i / 4) % 2 ? track.accent : '#dce1d5')
      for (const extra of [0, 0.65]) {
        curbPositions[curb].push(point.x + nx * side * (width / 2 + extra), 0.065, point.z + nz * side * (width / 2 + extra))
        curbColors[curb].push(color.r, color.g, color.b)
      }
    }
    if (i < count) { const offset = i * 2; indices.push(offset, offset + 2, offset + 1, offset + 1, offset + 2, offset + 3) }
  }
  const geometry = (vertices, colors) => {
    const result = new BufferGeometry()
    result.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3))
    result.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2)); result.setIndex(indices)
    if (colors) result.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
    result.computeVertexNormals(); return result
  }
  return { road: geometry(positions), curbs: curbPositions.map((vertices, i) => geometry(vertices, curbColors[i])),
    center: curve.getPoints(180).map(p => [p.x, 0.075, p.z]) }
}

export default function TrackEnvironment({ track, textures }) {
  const details = useMemo(() => ({ solid: track.decor.filter(item => !item.glow), glow: track.decor.filter(item => item.glow) }), [track])
  const road = useMemo(() => trackRoad(track), [track])
  useEffect(() => () => { road.road.dispose(); road.curbs.forEach(geometry => geometry.dispose()) }, [road])
  return <group>
    <mesh geometry={road.road} receiveShadow>
      <meshStandardMaterial color={track.roadColor} map={textures.asphalt} roughness={0.95} side={DoubleSide} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
    {road.curbs.map((geometry, i) => <mesh key={i} geometry={geometry} receiveShadow><meshStandardMaterial vertexColors roughness={0.85} side={DoubleSide} /></mesh>)}
    <Line points={road.center} color="#d2d9d2" lineWidth={1.4} dashed dashSize={2.4} gapSize={3} transparent opacity={0.6} />
    <InstancedDetails items={details.solid} /><InstancedDetails items={details.glow} glow />
    {track.signs.map((sign, i) => <Sign key={i} data={sign} />)}
    {track.lights.map((light, i) => <pointLight key={i} {...light} decay={2} />)}
  </group>
}
