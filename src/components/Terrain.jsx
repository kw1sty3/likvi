import React, { useMemo } from 'react'
import { RigidBody } from '@react-three/rapier'
import * as THREE from 'three'

function Terrain() {
  // Создание ландшафта с высотными изменениями
  const terrainGeometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(1000, 1000, 100, 100)
    const vertices = geometry.attributes.position.array
    
    // Генерация реалистичного рельефа (используем шум Перлина)
    for (let i = 2; i < vertices.length; i += 3) {
      const x = vertices[i - 2]
      const z = vertices[i - 1]
      const height = Math.sin(x * 0.01) * Math.cos(z * 0.01) * 5 +
                     Math.sin(x * 0.05) * Math.cos(z * 0.05) * 2 +
                     Math.random() * 1 - 0.5
      vertices[i] = height
    }
    
    geometry.attributes.position.needsUpdate = true
    geometry.computeVertexNormals()
    return geometry
  }, [])

  // Текстура земли
  const groundMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: 0x90EE90,
      roughness: 0.8,
      metalness: 0.1
    })
  }, [])

  return (
    <>
      {/* Земля с физикой */}
      <RigidBody type="fixed" colliders="trimesh">
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
          receiveShadow
          geometry={terrainGeometry}
          material={groundMaterial}
        />
      </RigidBody>

      {/* Деревья */}
      {Array.from({ length: 200 }).map((_, i) => {
        const x = (Math.random() - 0.5) * 800
        const z = (Math.random() - 0.5) * 800
        const height = Math.random() * 2 + 3
        
        return (
          <group key={`tree-${i}`} position={[x, height / 2, z]}>
            {/* Ствол */}
            <mesh 
              position={[0, height / 2, 0]} 
              castShadow
              userData={{ isCollidable: true }}
            >
              <cylinderGeometry args={[0.3, 0.4, height, 8]} />
              <meshStandardMaterial 
                color={0x8B4513}
                roughness={0.9}
              />
            </mesh>
            {/* Крона */}
            <mesh 
              position={[0, height + 1, 0]} 
              castShadow
              userData={{ isCollidable: true }}
            >
              <coneGeometry args={[2, 4, 8]} />
              <meshStandardMaterial 
                color={0x228B22}
                roughness={0.8}
              />
            </mesh>
          </group>
        )
      })}

      {/* Здания */}
      {Array.from({ length: 50 }).map((_, i) => {
        const x = (Math.random() - 0.5) * 600
        const z = (Math.random() - 0.5) * 600
        const height = 5 + Math.random() * 20
        const width = 3 + Math.random() * 5
        const depth = 3 + Math.random() * 5
        
        return (
          <group key={`building-${i}`} position={[x, height / 2, z]}>
            <mesh 
              castShadow 
              receiveShadow
              userData={{ isCollidable: true }}
            >
              <boxGeometry args={[width, height, depth]} />
              <meshStandardMaterial
                color={new THREE.Color().setHSL(Math.random(), 0.3, 0.5)}
                roughness={0.7}
                metalness={0.2}
              />
            </mesh>
            {/* Окна */}
            {Array.from({ length: Math.floor(height / 3) }).map((_, j) =>
              Array.from({ length: 3 }).map((_, k) => (
                <mesh
                  key={`window-${j}-${k}`}
                  position={[
                    (k - 1) * 1.2,
                    (j - Math.floor(height / 6)) * 3 + height / 2,
                    width / 2 + 0.01
                  ]}
                >
                  <planeGeometry args={[0.5, 0.5]} />
                  <meshStandardMaterial
                    color={0xffff00}
                    emissive={0xffff00}
                    emissiveIntensity={Math.random() * 0.5 + 0.2}
                  />
                </mesh>
              ))
            )}
          </group>
        )
      })}

      {/* Дороги */}
      {Array.from({ length: 10 }).map((_, i) => {
        const angle = (i / 10) * Math.PI * 2
        const x = Math.cos(angle) * 200
        const z = Math.sin(angle) * 200
        
        return (
          <mesh
            key={`road-${i}`}
            rotation={[-Math.PI / 2, angle, 0]}
            position={[x, 0.01, z]}
            receiveShadow
          >
            <planeGeometry args={[10, 200]} />
            <meshStandardMaterial 
              color={0x444444}
              roughness={0.6}
            />
          </mesh>
        )
      })}
    </>
  )
}

export default Terrain