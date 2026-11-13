import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, TorusGeometry } from 'three'
import { RACE_RINGS } from './raceRules.js'
import { enhanceTrack } from './fpvScenery.js'

export const DEFAULT_TRACK_ID = 'construction'
export const GATE_TUBE = 0.22
export const TRACK_VERSION = 2

const box = (position, size, color, extra = {}) => ({ shape: 'box', position, size, color, ...extra })
const concrete = '#929b9f'
const steel = '#344753'
const orange = '#ff9c36'

function route(points, radius = 5.4) {
  return points.map(([x, y, z, label, heading], index) => {
    const previous = points[(index + points.length - 1) % points.length]
    const next = points[(index + 1) % points.length]
    const dx = x - previous[0], dz = z - previous[2]
    const incoming = Math.hypot(dx, dz) || 1
    const outgoing = Math.hypot(next[0] - x, next[2] - z) || 1
    const bx = dx / incoming + (next[0] - x) / outgoing
    const bz = dz / incoming + (next[2] - z) / outgoing
    // Bisect the corner so both entry and exit clear the physical gate frame.
    const yaw = heading ?? (Math.hypot(bx, bz) < 0.001 ? Math.atan2(-dx, -dz) : Math.atan2(-bx, -bz))
    return { id: `gate-${index + 1}`, position: { x, y, z }, radius, yaw,
      normal: { x: -Math.sin(yaw), y: 0, z: -Math.cos(yaw) },
      label, color: '#59f6ba', finish: index === points.length - 1 }
  })
}

function constructionParts() {
  const parts = [box([0, -0.18, -28], [46, 0.36, 64], '#727b80')]
  // Two flyable storeys, with solid slabs and pillars instead of a closed box.
  for (const y of [12, 24]) parts.push(box([0, y, -28], [42, 0.65, 52], concrete))
  for (const x of [-19, 19]) for (const z of [-4, -28, -52]) {
    parts.push(box([x, 12, z], [1.25, 24, 1.25], concrete))
    parts.push(box([x, 24.65, z], [0.18, 1.3, 0.18], '#85523e'))
  }
  for (const y of [11.4, 23.4]) for (const x of [-19, 19]) {
    parts.push(box([x, y, -28], [0.65, 1, 49], steel))
  }
  // Tower crane, counterweight and suspended hook, away from the racing line.
  for (let y = 2; y < 38; y += 4) {
    for (const x of [32, 35]) parts.push(box([x, y, -36], [0.35, 4, 0.35], orange))
    parts.push(box([33.5, y, -36], [4.2, 0.22, 0.25], orange, { rotation: [0, 0, Math.PI / 4] }))
  }
  parts.push(box([19, 38, -36], [56, 1.1, 1.3], orange),
    box([41, 36.6, -36], [5, 2.5, 3], '#4d606d'),
    box([-3, 32, -36], [0.12, 11, 0.12], '#333a42'),
    box([-3, 26.5, -36], [1.1, 0.8, 0.6], orange))
  for (const [x, z, color] of [[-40, -12, '#b95b39'], [-40, -32, '#345c70'], [64, -20, '#c58e35']]) {
    parts.push(box([x, 2, z], [10, 4, 16], color))
    for (let offset = -6; offset <= 6; offset += 2) {
      parts.push(box([x + 5.05, 2, z + offset], [0.1, 3.7, 0.12], '#d2d7d2'))
    }
  }
  for (let x = -52; x <= 74; x += 9) {
    parts.push(box([x, 1.1, -104], [7, 2.2, 1.2], x % 2 ? orange : '#e4ddd1'))
  }
  for (const x of [-32, -26, -20]) parts.push(box([x, 1, 32], [4, 2, 6], '#9b8261'))
  return parts
}

// Every tube is hollow: separate wall panels, with matching collision meshes.
function tunnel(parts, center, length, yaw, round = false) {
  const transform = ([x, y, z]) => [center[0] + x * Math.cos(yaw) + z * Math.sin(yaw),
    center[1] + y, center[2] - x * Math.sin(yaw) + z * Math.cos(yaw)]
  const add = (position, size, color, rotation = 0, glow = false) => parts.push(box(transform(position), size, color,
    { rotation: [0, yaw, rotation], glow, collidable: !glow }))
  if (round) {
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI / 8
      add([Math.cos(angle) * 8.7, Math.sin(angle) * 8.7, 0], [0.55, 3.53, length], '#526577', angle)
    }
  } else {
    add([-9.2, 0, 0], [0.65, 18, length], '#4a5968')
    add([9.2, 0, 0], [0.65, 18, length], '#4a5968')
    add([0, 9.1, 0], [19, 0.65, length], '#526273')
    add([0, -8.8, 0], [19, 0.4, length], '#3a4858')
  }
  for (let z = -length / 2; z <= length / 2; z += 8) {
    add([-7.7, 0, z], [0.16, 5, 0.35], '#63dcff', 0, true)
    add([7.7, 0, z], [0.16, 5, 0.35], '#63dcff', 0, true)
    add([0, -7.7, z], [5, 0.12, 0.35], '#63dcff', 0, true)
  }
}

function tunnelParts() {
  const parts = []
  tunnel(parts, [0, 9, -28], 68, 0)
  tunnel(parts, [50, 9, -88], 60, Math.PI / 2, true)
  tunnel(parts, [108, 9, -14], 68, 0, true)
  for (const [x, z] of [[-32, -50], [34, -42], [78, 18], [142, -65]]) {
    parts.push(box([x, 6, z], [12, 12, 16], '#344251'), box([x, 12.5, z], [13, 1, 17], '#5b7180'))
  }
  return parts
}

function stadiumParts() {
  const parts = []
  for (const side of [-1, 1]) {
    const x = side === -1 ? -126 : 35
    for (let row = 0; row < 4; row++) {
      parts.push(box([x + side * row * 3, 1 + row * 1.8, -10], [3, 2 + row * 3.6, 126], row % 2 ? '#637a87' : '#c1cbd0'))
    }
  }
  for (const z of [-112, 85]) for (let x = -112; x < 22; x += 8) {
    parts.push(box([x, 0.8, z], [7.5, 1.6, 1], x % 16 === 0 ? '#ec654b' : '#e9eadf'))
  }
  for (const [x, z] of [[18, -70], [-110, -70], [-110, 52], [18, 52]]) {
    parts.push(box([x, 14, z], [0.7, 28, 0.7], steel), box([x, 28, z], [7, 1, 1.3], '#e0edf0'))
  }
  for (const [x, z] of [[-28, -26], [-59, -49], [-58, 8], [-25, 32]]) {
    parts.push(box([x, 5, z], [0.35, 10, 0.35], '#f3f3e9'))
    parts.push(box([x + 1.5, 8, z], [3, 3.5, 0.12], '#e75d40'))
  }
  return parts
}

export const FPV_TRACKS = [
  { id: 'construction', name: 'Стройка', subtitle: 'CONSTRUCTION YARD', difficulty: 'Сложная',
    description: 'Бетонные этажи, леса, башенный кран и техника среди контейнеров. Наберите высоту за зданием и вернитесь через верхний этаж.',
    tags: ['Пролёты этажей', 'Леса и техника', 'Кран'], accent: '#ffad54', ground: '#817665', sky: '#b5cfda',
    spawn: { x: 0, y: 6, z: 36 }, bounds: [-62, 84, -112, 82],
    gates: route([[0, 6, 18, 'Вход на стройку', 0], [0, 6, -14, 'Нижний этаж'], [0, 6, -64, 'Выход из каркаса'],
      [0, 18, -94, 'Набор высоты'], [0, 18, -44, 'Верхний этаж'], [0, 18, -14, 'Пролёт над плитой'],
      [0, 18, 14, 'Выход со второго этажа'], [50, 10, 28, 'Поворот у контейнеров'],
      [48, 6, 62, 'Низкая связка'], [0, 6, 62, 'Возврат на старт'], [0, 6, 36, 'Старт / финиш', 0]]),
    parts: constructionParts() },
  { id: 'tunnels', name: 'Туннели', subtitle: 'UNDERGROUND CIRCUIT', difficulty: 'Средняя',
    description: 'Промышленный комплекс с резервуарами и трубопроводами. Три сквозных туннеля, световые секции и открытые повороты между ними.',
    tags: ['3 туннеля', 'Промзона', 'Подсветка'], accent: '#68dcff', ground: '#475662', sky: '#778fba',
    spawn: { x: 0, y: 9, z: 36 }, bounds: [-50, 160, -120, 90],
    gates: route([[0, 9, 18, 'Вход в галерею', 0], [0, 9, -20, 'Бетонная галерея'], [0, 9, -52, 'Выход из галереи'],
      [0, 9, -88, 'Правый поворот'], [40, 9, -88, 'Круглый туннель'], [72, 9, -88, 'Выход из трубы'],
      [108, 9, -88, 'Поворот к третьей секции'], [108, 9, -38, 'Обратный туннель'], [108, 9, 8, 'Свет в конце туннеля'],
      [108, 9, 42, 'Выход на прямую'], [52, 9, 62, 'Возвратная дуга'], [0, 9, 62, 'Стартовая прямая'], [0, 9, 36, 'Старт / финиш', 0]], 5.6),
    parts: tunnelParts() },
  { id: 'stadium', name: 'FPV-стадион', subtitle: 'RACE DAY', difficulty: 'Начальная',
    description: 'Арена с болельщиками, крытыми трибунами, стартовой аркой и воздушным мостом. Широкие ворота, слалом и высотная дуга.',
    tags: ['Трибуны', 'Слалом', 'Воздушный мост'], accent: '#a6ed79', ground: '#5c8255', sky: '#a9d6ed',
    spawn: { x: 0, y: 7, z: 38 }, bounds: [-150, 65, -125, 100],
    gates: route([[0, 7, 18, 'Стартовая прямая', 0], [0, 7, -20, 'Разгон'], [-22, 8, -56, 'Вход в слалом'],
      [-54, 9, -80, 'Дальняя дуга'], [-88, 12, -52, 'Высотные ворота'], [-88, 15, 0, 'Спуск к трибунам'],
      [-56, 10, 36, 'Обратный слалом'], [-32, 7, 62, 'Последний поворот'], [0, 7, 62, 'Выход на финиш'], [0, 7, 38, 'Старт / финиш', 0]], 6),
    parts: stadiumParts() }
].map(enhanceTrack)

export const LEGACY_TRACK = { id: 'polytech-arena', name: 'Арена Московского Политеха',
  spawn: { x: 0, y: 0.86, z: 0 }, gates: RACE_RINGS }
export const getTrack = id => FPV_TRACKS.find(track => track.id === id) ?? LEGACY_TRACK
export const isFpvTrack = id => FPV_TRACKS.some(track => track.id === id)
export const trackLength = track => Math.round(track.gates.reduce((length, gate, i) => {
  const previous = track.gates[(i + track.gates.length - 1) % track.gates.length].position
  return length + Math.hypot(gate.position.x - previous.x, gate.position.y - previous.y, gate.position.z - previous.z)
}, 0))

export function createFpvCollisionRoot(track) {
  const root = new Group(), material = new MeshBasicMaterial()
  for (const part of track.parts) {
    if (part.collidable === false) continue
    const Geometry = { box: BoxGeometry, cylinder: CylinderGeometry, cone: ConeGeometry }[part.shape]
    const mesh = new Mesh(new Geometry(...(part.args ?? part.size)), material)
    mesh.position.set(...part.position)
    if (part.rotation) mesh.rotation.set(...part.rotation)
    mesh.userData.isCollidable = true
    root.add(mesh)
  }
  for (const gate of track.gates) {
    const mesh = new Mesh(new TorusGeometry(gate.radius, GATE_TUBE, 8, 48), material)
    mesh.position.copy(gate.position)
    mesh.rotation.y = gate.yaw
    mesh.userData.isCollidable = true
    root.add(mesh)
  }
  for (const sign of track.signs) {
    const mesh = new Mesh(new BoxGeometry(sign.width, sign.height, 0.12), material)
    mesh.position.set(...sign.position); mesh.rotation.set(...sign.rotation)
    mesh.userData.isCollidable = true
    root.add(mesh)
  }
  return { root, dispose() { root.traverse(object => object.geometry?.dispose()); material.dispose() } }
}
