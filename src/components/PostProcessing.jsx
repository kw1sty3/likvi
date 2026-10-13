import React from 'react'
import { EffectComposer, Bloom } from '@react-three/postprocessing'

// Упрощенная постобработка - только Bloom для экономии текстурных юнитов
function PostProcessing() {
  return (
    <EffectComposer>
      <Bloom
        intensity={0.3}
        luminanceThreshold={0.9}
        luminanceSmoothing={0.9}
        height={200}
      />
    </EffectComposer>
  )
}

export default PostProcessing
