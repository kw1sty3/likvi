import React, { memo, useEffect, useMemo } from 'react'
import { createStaticTrackBatches } from '../physics/staticTrackBatches'

function StaticTrackParts({ parts, textures }) {
  const batches = useMemo(() => createStaticTrackBatches(parts), [parts])
  useEffect(() => () => batches.forEach(batch => batch.geometry.dispose()), [batches])
  return batches.map((batch, index) => <mesh key={index} geometry={batch.geometry}
    castShadow={batch.castShadow} receiveShadow userData={{ isCollidable: batch.collidable }}>
    <meshStandardMaterial vertexColors color={batch.glow ? batch.color : '#ffffff'}
      roughness={batch.roughness} metalness={batch.metalness} map={textures?.[batch.material]}
      emissive={batch.glow ? batch.color : '#000000'} emissiveIntensity={batch.glow ? 1.7 : 0} />
  </mesh>)
}

export default memo(StaticTrackParts)
