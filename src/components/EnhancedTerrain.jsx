import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import * as THREE from 'three'

import { WORLD_HALF, SURFACE_Y, createRng, makeWorldData, createRiverGeometry, buildingParts, treeParts, lightParts, rockParts } from '../physics/arena'
import CollisionParts from './CollisionParts'

function StreetLight({ data }) {
  const lightRef = useRef()

  useFrame((state) => {
    if (!lightRef.current) return
    lightRef.current.intensity = 0.6 + Math.sin(state.clock.elapsedTime * 1.4 + data.phase) * 0.08
  })

  return (
    <group position={data.position} userData={{ isCollidable: false }}>
      <CollisionParts parts={lightParts()} />
      <mesh position={[0.84, 4.54, 0]}>
        <sphereGeometry args={[0.16, 16, 10]} />
        <meshStandardMaterial color="#fff2ae" emissive="#ffd36a" emissiveIntensity={0.9} roughness={0.2} />
      </mesh>
      <pointLight ref={lightRef} position={[0.84, 4.5, 0]} intensity={0.42} distance={10} color="#ffe3a1" />
    </group>
  )
}

function AnimatedCar({ data }) {
  const ref = useRef()

  useFrame((state) => {
    if (!ref.current) return
    const z = ((state.clock.elapsedTime * 10 + data.offset) % 640) - 320
    ref.current.position.set(data.lane, 0.45, z)
    ref.current.rotation.y = data.lane < 0 ? 0 : Math.PI
  })

  return (
    <group ref={ref} userData={{ isCollidable: false }}>
      <mesh castShadow receiveShadow position={[0, 0.2, 0]}>
        <boxGeometry args={[1.5, 0.55, 2.6]} />
        <meshStandardMaterial color={data.color} metalness={0.35} roughness={0.42} />
      </mesh>
      <mesh castShadow position={[0, 0.58, -0.2]}>
        <boxGeometry args={[1.2, 0.45, 1.25]} />
        <meshStandardMaterial color="#d7ecff" metalness={0.08} roughness={0.18} />
      </mesh>
      {[-0.62, 0.62].map((x) => [-0.85, 0.85].map((z) => (
        <mesh key={`${x}-${z}`} castShadow position={[x, -0.12, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.18, 18]} />
          <meshStandardMaterial color="#151515" roughness={0.55} />
        </mesh>
      )))}
    </group>
  )
}

function Building({ data }) {
  const floors = Math.max(1, Math.floor(data.size[1] / 4))
  const windowRng = createRng(data.windowSeed)

  return (
    <group position={data.position} rotation={data.rotation}>
      <mesh receiveShadow position={[0, -data.size[1] / 2 + SURFACE_Y * 0.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[data.size[0] + 8, data.size[2] + 8]} />
        <meshStandardMaterial
          color={data.lowHouse ? '#8c956c' : '#666d72'}
          roughness={0.86}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
      <CollisionParts parts={buildingParts(data)} />
      <mesh position={[0, -data.size[1] / 2 + 1.15, data.size[2] / 2 + 0.018]}>
        <boxGeometry args={[Math.min(1.5, data.size[0] * 0.3), 2.25, 0.05]} />
        <meshStandardMaterial color="#26313a" roughness={0.58} metalness={0.05} />
      </mesh>
      {!data.lowHouse && Array.from({ length: floors }).map((_, floor) => (
        <group key={floor} position={[0, -data.size[1] / 2 + 2.1 + floor * 3.6, data.size[2] / 2 + 0.012]}>
          {[-0.28, 0.28].map((x, index) => {
            const lit = windowRng() > 0.42
            return (
              <mesh key={index} position={[x * data.size[0], 0, 0]}>
                <planeGeometry args={[0.82, 1.05]} />
                <meshStandardMaterial
                  color={lit ? '#ffe7a0' : '#182838'}
                  emissive={lit ? '#ffd27a' : '#000000'}
                  emissiveIntensity={lit ? 0.28 : 0}
                  roughness={0.22}
                  metalness={0.04}
                />
              </mesh>
            )
          })}
        </group>
      ))}
    </group>
  )
}

function Tree({ data }) {
  return <group position={data.position}><CollisionParts parts={treeParts(data)} /></group>
}

function EnhancedTerrain({ terrainRef }) {
  const data = useMemo(() => makeWorldData(), [])
  const terrainGeometry = useMemo(() => new THREE.PlaneGeometry(WORLD_HALF * 2, WORLD_HALF * 2, 18, 18), [])
  const riverGeometry = useMemo(() => createRiverGeometry(data.riverPath), [data.riverPath])
  const groundMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#6da84f',
    roughness: 0.92,
    metalness: 0.02
  }), [])

  return (
    <group ref={terrainRef}>
      <RigidBody type="fixed" colliders={false} userData={{ surface: 'ground' }}>
        <CuboidCollider args={[WORLD_HALF, 0.25, WORLD_HALF]} position={[0, -0.25, 0]} friction={0.9} restitution={0.05} />
        <mesh
          receiveShadow
          rotation={[-Math.PI / 2, 0, 0]}
          geometry={terrainGeometry}
          material={groundMaterial}
          userData={{ impactSurface: 'ground' }}
        />
      </RigidBody>

      {data.fields.map((field, index) => (
        <mesh key={`field-${index}`} receiveShadow position={field.position} rotation={field.rotation} userData={{ impactSurface: 'ground' }}>
          <planeGeometry args={field.size} />
          <meshStandardMaterial color={field.color} roughness={0.96} />
        </mesh>
      ))}

      <mesh
        receiveShadow
        position={[0, SURFACE_Y * 0.55, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        geometry={riverGeometry}
        userData={{ isCollidable: true, collisionType: 'water' }}
      >
        <meshStandardMaterial
          color="#238bb5"
          roughness={0.32}
          metalness={0.04}
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-4}
          polygonOffsetUnits={-4}
        />
      </mesh>

      {data.roads.map((road, index) => (
        <mesh key={`road-${index}`} receiveShadow position={road.position} rotation={road.rotation} userData={{ impactSurface: 'ground' }}>
          <planeGeometry args={road.size} />
          <meshStandardMaterial
            color="#30343a"
            roughness={0.68}
            metalness={0.04}
            polygonOffset
            polygonOffsetFactor={-3}
            polygonOffsetUnits={-3}
          />
        </mesh>
      ))}

      <group position={[0, SURFACE_Y, 0]} userData={{ isCollidable: false }}>
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} userData={{ impactSurface: 'ground' }}>
          <planeGeometry args={[22, 390]} />
          <meshStandardMaterial
            color="#202329"
            roughness={0.78}
            metalness={0.04}
            polygonOffset
            polygonOffsetFactor={-5}
            polygonOffsetUnits={-5}
          />
        </mesh>
        {data.markers.map((marker, index) => (
          <mesh key={`runway-marker-${index}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, marker.z]} userData={{ impactSurface: 'ground' }}>
            <planeGeometry args={[0.85, 7.6]} />
            <meshStandardMaterial color="#f2f7ff" roughness={0.5} polygonOffset polygonOffsetFactor={-6} polygonOffsetUnits={-6} />
          </mesh>
        ))}
      </group>

      <group position={[0, SURFACE_Y + 0.002, 0]} userData={{ isCollidable: false }}>
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} userData={{ impactSurface: 'ground' }}>
          <circleGeometry args={[8.6, 72]} />
          <meshStandardMaterial color="#31343a" roughness={0.82} metalness={0.04} polygonOffset polygonOffsetFactor={-6} polygonOffsetUnits={-6} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} userData={{ impactSurface: 'ground' }}>
          <ringGeometry args={[7.75, 8.35, 72]} />
          <meshStandardMaterial color="#f4f7fb" roughness={0.45} polygonOffset polygonOffsetFactor={-7} polygonOffsetUnits={-7} />
        </mesh>
        <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <mesh position={[-1.45, 0, 0]} userData={{ impactSurface: 'ground' }}>
            <boxGeometry args={[0.9, 5.7, 0.1]} />
            <meshStandardMaterial color="#f4f7fb" />
          </mesh>
          <mesh position={[1.45, 0, 0]} userData={{ impactSurface: 'ground' }}>
            <boxGeometry args={[0.9, 5.7, 0.1]} />
            <meshStandardMaterial color="#f4f7fb" />
          </mesh>
          <mesh userData={{ impactSurface: 'ground' }}>
            <boxGeometry args={[4.5, 0.82, 0.1]} />
            <meshStandardMaterial color="#f4f7fb" />
          </mesh>
        </group>
      </group>

      {data.markers.map((marker, index) => (
        <mesh key={`road-marker-${index}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, SURFACE_Y + 0.003, marker.z]} userData={{ impactSurface: 'ground' }}>
          <planeGeometry args={[0.45, 5.6]} />
          <meshStandardMaterial color="#f6d86a" roughness={0.46} polygonOffset polygonOffsetFactor={-7} polygonOffsetUnits={-7} />
        </mesh>
      ))}

      {data.buildings.map((building, index) => <Building key={`building-${index}`} data={building} />)}
      {data.trees.map((tree, index) => <Tree key={`tree-${index}`} data={tree} />)}

      {data.bushes.map((bush, index) => (
        <mesh key={`bush-${index}`} receiveShadow position={bush.position} scale={bush.scale}>
          <sphereGeometry args={[0.72, 12, 8]} />
          <meshStandardMaterial color={bush.color} roughness={0.9} />
        </mesh>
      ))}

      {data.rocks.map((rock, index) => (
        <group key={`rock-${index}`} position={rock.position} rotation={rock.rotation} scale={rock.scale}>
          <CollisionParts parts={rockParts(rock)} />
        </group>
      ))}

      {data.streetLights.map((light, index) => <StreetLight key={`street-light-${index}`} data={light} />)}
      {data.cars.map((car, index) => <AnimatedCar key={`car-${index}`} data={car} />)}

      {[[-185, 62, -145], [150, 78, 210], [-30, 88, -250]].map((position, index) => (
        <group key={`balloon-${index}`} position={position} userData={{ isCollidable: false }}>
          <mesh castShadow>
            <sphereGeometry args={[1.8, 24, 16]} />
            <meshStandardMaterial color={index === 0 ? '#ffb238' : index === 1 ? '#5aa8ff' : '#f06b83'} roughness={0.55} metalness={0.08} />
          </mesh>
          <mesh castShadow position={[0, -2.15, 0]}>
            <boxGeometry args={[0.8, 0.68, 0.8]} />
            <meshStandardMaterial color="#8b5a34" roughness={0.76} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export default EnhancedTerrain
