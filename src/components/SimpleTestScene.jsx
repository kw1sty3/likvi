import React from 'react'

// Простой тест для проверки рендеринга - БЕЗ теней для экономии текстур
function SimpleTestScene() {
  return (
    <>
      {/* Тестовый куб на земле - большой и яркий */}
      <mesh position={[10, 2, 10]}>
        <boxGeometry args={[3, 3, 3]} />
        <meshStandardMaterial color="hotpink" />
      </mesh>
      
      {/* Тестовая сфера - большой и яркий */}
      <mesh position={[-10, 2, 10]}>
        <sphereGeometry args={[2, 16, 16]} />
        <meshStandardMaterial color="orange" />
      </mesh>
      
      {/* Тестовая плоскость земли - видимая */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="green" />
      </mesh>
      
      {/* Тестовый столб в центре */}
      <mesh position={[0, 5, 0]}>
        <cylinderGeometry args={[1, 1, 10, 16]} />
        <meshStandardMaterial color="red" />
      </mesh>
      
      {/* Большой яркий куб в центре для проверки */}
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[5, 5, 5]} />
        <meshStandardMaterial color="yellow" />
      </mesh>
    </>
  )
}

export default SimpleTestScene
