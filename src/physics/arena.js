import * as THREE from 'three'
import { MeshBVH } from 'three-mesh-bvh/src/core/MeshBVH.js'

export const WORLD_HALF = 420
const SAFE_RADIUS = 122
export const SURFACE_Y = 0.006

export function createRng(seed) {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
}

function randomRange(rng, min, max) {
  return min + (max - min) * rng()
}

function randomPointOutsideSafeZone(rng, radius = WORLD_HALF * 0.92) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const x = randomRange(rng, -radius, radius)
    const z = randomRange(rng, -radius, radius)
    if (Math.hypot(x, z) > SAFE_RADIUS) return [x, z]
  }

  return [SAFE_RADIUS + randomRange(rng, 20, radius), randomRange(rng, -radius, radius)]
}

export function makeWorldData() {
  const rng = createRng(20261007)

  const riverPath = []
  for (let x = -WORLD_HALF - 60; x <= WORLD_HALF + 60; x += 36) {
    const z = Math.sin(x * 0.009) * 34 - 112 + Math.cos(x * 0.017) * 11
    riverPath.push({ x, z, width: 24 + Math.sin(x * 0.021) * 4 })
  }

  const roads = [
    { position: [0, SURFACE_Y, 0], rotation: [-Math.PI / 2, 0, 0], size: [14, 700] },
    { position: [0, SURFACE_Y, 155], rotation: [-Math.PI / 2, Math.PI / 2, 0], size: [12, 600] },
    { position: [0, SURFACE_Y, -165], rotation: [-Math.PI / 2, Math.PI / 2, 0], size: [12, 600] },
    { position: [215, SURFACE_Y, 0], rotation: [-Math.PI / 2, 0.16, 0], size: [10, 480] },
    { position: [-225, SURFACE_Y, -20], rotation: [-Math.PI / 2, -0.12, 0], size: [10, 470] }
  ]

  const fields = Array.from({ length: 18 }, (_, index) => {
    const col = index % 6
    const row = Math.floor(index / 6)
    const x = -310 + col * 124 + randomRange(rng, -10, 10)
    const z = 238 + row * 82 + randomRange(rng, -12, 12)
    return {
      position: [x, SURFACE_Y * 0.7, z],
      rotation: [-Math.PI / 2, 0, randomRange(rng, -0.08, 0.08)],
      size: [96 + randomRange(rng, -14, 18), 52 + randomRange(rng, -8, 8)],
      color: new THREE.Color().setHSL(0.21 + randomRange(rng, -0.035, 0.045), 0.48, 0.38 + randomRange(rng, -0.05, 0.05)).getHex()
    }
  })

  const trees = Array.from({ length: 170 }, () => {
    const [x, z] = randomPointOutsideSafeZone(rng)
    const tall = rng() > 0.62
    return {
      position: [x, 0, z],
      trunkHeight: randomRange(rng, tall ? 4.8 : 2.6, tall ? 8.2 : 5.6),
      trunkRadius: randomRange(rng, 0.18, 0.36),
      crownRadius: randomRange(rng, tall ? 1.7 : 1.15, tall ? 2.85 : 2.1),
      crownHeight: randomRange(rng, tall ? 3.4 : 2.2, tall ? 5.2 : 3.7),
      crownColor: new THREE.Color().setHSL(randomRange(rng, 0.26, 0.36), randomRange(rng, 0.42, 0.68), randomRange(rng, 0.24, 0.38)).getHex(),
      trunkColor: new THREE.Color().setHSL(randomRange(rng, 0.06, 0.1), randomRange(rng, 0.36, 0.5), randomRange(rng, 0.22, 0.32)).getHex(),
      kind: rng() > 0.32 ? 'deciduous' : 'pine',
      phase: randomRange(rng, 0, Math.PI * 2)
    }
  })

  const bushes = Array.from({ length: 64 }, () => {
    const [x, z] = randomPointOutsideSafeZone(rng)
    return {
      position: [x, randomRange(rng, 0.18, 0.5), z],
      scale: [randomRange(rng, 0.65, 1.5), randomRange(rng, 0.38, 0.88), randomRange(rng, 0.65, 1.5)],
      color: new THREE.Color().setHSL(randomRange(rng, 0.23, 0.34), randomRange(rng, 0.45, 0.7), randomRange(rng, 0.23, 0.36)).getHex()
    }
  })

  const rocks = Array.from({ length: 30 }, () => {
    const [x, z] = randomPointOutsideSafeZone(rng)
    const size = randomRange(rng, 0.35, 1.35)
    return {
      position: [x, size * 0.45, z],
      rotation: [randomRange(rng, -0.25, 0.25), randomRange(rng, 0, Math.PI * 2), randomRange(rng, -0.2, 0.2)],
      scale: [randomRange(rng, 0.75, 1.55), randomRange(rng, 0.48, 1.05), randomRange(rng, 0.72, 1.48)],
      size,
      color: new THREE.Color().setHSL(randomRange(rng, 0.07, 0.12), randomRange(rng, 0.08, 0.2), randomRange(rng, 0.28, 0.42)).getHex()
    }
  })

  const buildings = Array.from({ length: 82 }, (_, index) => {
    const side = index % 2 === 0 ? 1 : -1
    const block = Math.floor(index / 2)
    const lane = block % 5
    const row = Math.floor(block / 5)
    const baseX = side * (54 + lane * 54 + randomRange(rng, -10, 12))
    const baseZ = -310 + row * 48 + randomRange(rng, -12, 12)
    const x = Math.abs(baseX) < 44 && Math.abs(baseZ) < SAFE_RADIUS ? side * 92 : baseX
    const z = Math.abs(baseX) < 44 && Math.abs(baseZ) < SAFE_RADIUS ? baseZ + 90 : baseZ
    const highRise = rng() > 0.58
    const lowHouse = !highRise && rng() > 0.54
    const width = randomRange(rng, lowHouse ? 7 : 5, highRise ? 10 : 12)
    const depth = randomRange(rng, lowHouse ? 7 : 5, highRise ? 10 : 12)
    const height = randomRange(rng, lowHouse ? 4 : 8, highRise ? 31 : 17)
    return {
      position: [x, height / 2, z],
      rotation: [0, randomRange(rng, -0.1, 0.1), 0],
      size: [width, height, depth],
      lowHouse,
      highRise,
      color: new THREE.Color().setHSL(randomRange(rng, 0.08, 0.16), randomRange(rng, 0.18, 0.34), randomRange(rng, 0.36, 0.56)).getHex(),
      roofColor: new THREE.Color().setHSL(randomRange(rng, 0.02, 0.06), randomRange(rng, 0.48, 0.62), randomRange(rng, 0.24, 0.34)).getHex(),
      windowSeed: Math.floor(rng() * 100000)
    }
  })

  const streetLights = Array.from({ length: 14 }, (_, index) => {
    const z = -300 + index * 46
    const side = index % 2 === 0 ? -1 : 1
    return {
      position: [side * 11.5, 0, z],
      phase: index * 0.71
    }
  })

  const cars = Array.from({ length: 6 }, (_, index) => ({
    offset: index * 73,
    lane: index % 2 === 0 ? -4.2 : 4.2,
    color: new THREE.Color().setHSL(randomRange(rng, 0, 1), 0.68, 0.46).getHex()
  }))

  const markers = Array.from({ length: 38 }, (_, index) => ({
    z: -330 + index * 18
  }))

  return { buildings: placeBuildingsOnLand(buildings, riverPath), bushes, cars, fields, markers, riverPath, roads, rocks, streetLights, trees }
}

export function placeBuildingsOnLand(buildings, riverPath) {
  const geometry = createRiverGeometry(riverPath)
  geometry.rotateX(Math.PI / 2)
  const water = new MeshBVH(geometry)
  const transform = new THREE.Matrix4()
  const lotBox = (building, margin = 0) => {
    const halfWidth = building.size[0] / 2 + 4 + margin
    const halfDepth = building.size[2] / 2 + 4 + margin
    return new THREE.Box3(new THREE.Vector3(-halfWidth, -1, -halfDepth), new THREE.Vector3(halfWidth, 1, halfDepth))
  }
  const setTransform = (building, z = building.position[2]) => transform
    .makeRotationY(building.rotation[1]).setPosition(building.position[0], 0, z)

  try {
    const wet = buildings.map(building => water.intersectsBox(lotBox(building, 3), setTransform(building)))
    const occupied = buildings.filter((_, index) => !wet[index])
      .map(building => lotBox(building).applyMatrix4(setTransform(building)))

    return buildings.map((building, index) => {
      if (!wet[index]) return building
      const clearanceBox = lotBox(building, 3)
      // Проверяем весь участок с отступом от воды; новые участки не должны пересекать соседние.
      for (let distance = 2; distance <= WORLD_HALF * 2; distance += 2) {
        for (const direction of [1, -1]) {
          const z = building.position[2] + distance * direction
          setTransform(building, z)
          const bounds = lotBox(building).applyMatrix4(transform)
          if (bounds.min.x < -WORLD_HALF || bounds.max.x > WORLD_HALF ||
              bounds.min.z < -WORLD_HALF || bounds.max.z > WORLD_HALF ||
              water.intersectsBox(clearanceBox, transform) || occupied.some(other => other.intersectsBox(bounds))) continue
          occupied.push(bounds)
          return { ...building, position: [building.position[0], building.position[1], z] }
        }
      }
      throw new Error('Не удалось разместить дом на свободном сухом участке')
    })
  } finally { geometry.dispose() }
}

export function createRiverGeometry(path) {
  const left = []
  const right = []

  for (let index = 0; index < path.length; index += 1) {
    const current = path[index]
    const previous = path[Math.max(0, index - 1)]
    const next = path[Math.min(path.length - 1, index + 1)]
    const dx = next.x - previous.x
    const dz = next.z - previous.z
    const length = Math.hypot(dx, dz) || 1
    const nx = -dz / length
    const nz = dx / length
    const halfWidth = current.width * 0.5

    left.push(new THREE.Vector2(current.x + nx * halfWidth, current.z + nz * halfWidth))
    right.push(new THREE.Vector2(current.x - nx * halfWidth, current.z - nz * halfWidth))
  }

  const shape = new THREE.Shape([...left, ...right.reverse()])
  return new THREE.ShapeGeometry(shape)
}

export function buildingParts(data) {
  const parts = [{ shape: 'box', args: data.size, color: data.color }]
  if (data.lowHouse) parts.push({ shape: 'cone', args: [Math.max(data.size[0], data.size[2]) * 0.78, 2.2, 4],
    position: [0, data.size[1] / 2 + 0.8, 0], rotation: [0, Math.PI / 4, 0], color: data.roofColor, roughness: 0.74, metalness: 0 })
  return parts
}

export function treeParts(data) {
  const { trunkRadius, trunkHeight, crownRadius, crownHeight } = data
  const parts = [{ shape: 'cylinder', args: [trunkRadius * 0.58, trunkRadius, trunkHeight, 10],
    position: [0, trunkHeight / 2, 0], color: data.trunkColor }]
  if (data.kind === 'pine') {
    for (const level of [0, 1, 2]) parts.push({ shape: 'cone',
      args: [crownRadius * (1 - level * 0.2), crownHeight * 0.48, 12],
      position: [0, trunkHeight + crownHeight * (0.2 + level * 0.22), 0], color: data.crownColor })
  } else {
    for (const [x, y, z, scale] of [[0, 0, 0, 1], [0.42, -0.08, 0.12, 0.72], [-0.38, 0.06, -0.08, 0.68], [0.05, 0.2, -0.36, 0.62], [-0.02, 0.32, 0.28, 0.58]]) {
      parts.push({ shape: 'sphere', args: [1, 14, 10],
        position: [x * crownRadius, trunkHeight + crownHeight * (0.42 + y), z * crownRadius],
        scale: [scale * crownRadius, scale * crownRadius * 0.78, scale * crownRadius], color: data.crownColor })
    }
  }
  return parts.map(part => ({ ...part, castShadow: false, metalness: 0,
    roughness: part.shape === 'cylinder' ? 0.9 : data.kind === 'pine' ? 0.88 : 0.87 }))
}

export function lightParts() {
  return [
    { shape: 'cylinder', args: [0.055, 0.075, 4.7, 10], position: [0, 2.35, 0], color: '#33383d', metalness: 0.65, roughness: 0.26 },
    { shape: 'box', args: [0.78, 0.12, 0.12], position: [0.42, 4.64, 0], color: '#33383d', metalness: 0.75, roughness: 0.22 }
  ]
}
export const rockParts = data => [{ shape: 'dodecahedron', args: [data.size, 0], color: data.color, castShadow: false, roughness: 0.93, metalness: 0.08 }]

const geometryTypes = { box: THREE.BoxGeometry, cone: THREE.ConeGeometry, cylinder: THREE.CylinderGeometry,
  sphere: THREE.SphereGeometry, dodecahedron: THREE.DodecahedronGeometry }

export function createArenaCollisionRoot(data = makeWorldData()) {
  const root = new THREE.Group()
  const material = new THREE.MeshBasicMaterial()
  const transform = (object, spec) => {
    if (spec.position) object.position.set(...spec.position)
    if (spec.rotation) object.rotation.set(...spec.rotation)
    if (spec.scale) object.scale.set(...spec.scale)
  }
  const addParts = (spec, parts) => {
    const group = new THREE.Group()
    transform(group, spec)
    for (const part of parts) {
      const mesh = new THREE.Mesh(new geometryTypes[part.shape](...part.args), material)
      transform(mesh, part)
      mesh.userData.isCollidable = true
      group.add(mesh)
    }
    root.add(group)
  }
  for (const building of data.buildings) addParts(building, buildingParts(building))
  for (const tree of data.trees) addParts(tree, treeParts(tree))
  for (const rock of data.rocks) addParts(rock, rockParts(rock))
  for (const light of data.streetLights) addParts(light, lightParts())
  const water = new THREE.Mesh(createRiverGeometry(data.riverPath), material)
  water.position.y = SURFACE_Y * 0.55
  water.rotation.x = Math.PI / 2
  water.userData = { isCollidable: true, collisionType: 'water' }
  root.add(water)
  return { root, dispose() {
    root.traverse(object => object.geometry?.dispose())
    material.dispose()
  } }
}

