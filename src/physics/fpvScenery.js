// Deterministic scene descriptions shared by the renderer and collision tests.
const box = (position, size, color, extra = {}) => ({ shape: 'box', position, size, color, ...extra })
const cylinder = (position, radius, height, color, extra = {}) => ({ shape: 'cylinder', position, args: [radius, radius, height, 16], color, ...extra })

function addCity(parts, decor, industrial = false) {
  for (let i = 0; i < 13; i++) {
    const x = -180 + i * 30, z = -174 - (i % 3) * 18
    const height = 22 + (i * 17 % 43)
    parts.push(box([x, height / 2, z], [20, height, 22], industrial ? '#394759' : '#6e7d87', { material: 'concrete', castShadow: false }))
    for (let floor = 0; floor < height / 5 - 1; floor++) for (let col = -1; col <= 1; col++) {
      decor.push(box([x + col * 5.5, 4 + floor * 5, z + 11.03], [2.4, 1.8, 0.08], industrial ? '#7fd4ee' : '#c1dbe3', { glow: industrial }))
    }
    parts.push(box([x, height + 0.4, z], [21, 0.8, 23], '#38434e', { castShadow: false }))
  }
}

function addFence(parts, decor, left, right, near, far, color) {
  for (const x of [left, right]) {
    parts.push(box([x, 2.1, (near + far) / 2], [0.22, 4.2, near - far], color, { material: 'metal' }))
    for (let z = far; z <= near; z += 12) decor.push(box([x, 4.35, z], [0.45, 0.3, 0.45], '#e6cf92'))
  }
  parts.push(box([(left + right) / 2, 2.1, far], [right - left, 4.2, 0.22], color, { material: 'metal' }))
}

function construction(track) {
  const parts = [], decor = [], signs = [], lights = []
  addCity(parts, decor)
  addFence(parts, decor, -74, 98, 94, -126, '#526571')
  // Scaffolding and safety rails leave both flying storeys open.
  for (const side of [-1, 1]) {
    for (const z of [-54, -42, -30, -18, -4]) {
      parts.push(cylinder([side * 23, 12.5, z], 0.14, 25, '#d6ba69'))
      for (const y of [4, 8, 12, 16, 20, 24]) {
        decor.push(box([side * 23, y, z + (z === -4 ? -4 : 4)], [0.15, 0.15, 8], '#d6ba69'))
        decor.push(box([side * 23, y + 1.5, z], [0.15, 5, 0.15], '#d6ba69', { rotation: [Math.PI / 4, 0, 0] }))
      }
    }
    for (const y of [12.55, 24.55]) {
      parts.push(box([side * 23, y, -29], [2.8, 0.16, 50], '#7f8381', { material: 'metal' }))
      decor.push(box([side * 24, y + 1.2, -29], [0.13, 0.13, 50], '#e8c967'))
    }
  }
  for (let z = -48; z < -4; z += 8) for (const side of [-1, 1]) {
    decor.push(box([side * 18.2, 11.1, z], [0.2, 0.18, 3], '#ffd180', { glow: true }))
  }
  lights.push({ position: [0, 9, -28], color: '#ffdb9d', intensity: 45, distance: 45 })
  // Excavator: tracks, glazed cab, articulated boom and steel bucket.
  parts.push(box([-41, 1, 37], [9, 2, 7], '#282c2d'), box([-41, 3.3, 37], [6, 2.6, 5], '#e5a53a'),
    box([-39, 5.6, 37], [3, 2.4, 3.5], '#536d77'), box([-38, 8, 33], [1.3, 9, 1.5], '#e5a53a', { rotation: [-0.55, 0, 0] }),
    box([-38, 9.5, 28], [1.1, 6.5, 1.3], '#d2922e', { rotation: [0.7, 0, 0] }), box([-38, 6.5, 25], [3.8, 2, 2.5], '#3d4449'))
  for (const x of [-45, -37]) for (const z of [34.5, 36, 37.5, 39]) decor.push(box([x, 0.8, z], [1.4, 0.25, 1], '#84908e'))
  // Materials yard, pipe stacks and concrete sections.
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4 - row; col++) {
    parts.push(cylinder([-49, 0.9 + row * 1.45, 8 + col * 1.9 + row], 0.85, 11, '#757f87', { rotation: [0, 0, Math.PI / 2], material: 'concrete' }))
  }
  for (let i = 0; i < 6; i++) {
    parts.push(box([72, 1 + (i % 2) * 2, 5 + Math.floor(i / 2) * 8], [9, 2, 6], '#b39266'))
    decor.push(box([72, 2.1 + (i % 2) * 2, 5 + Math.floor(i / 2) * 8], [8.5, 0.13, 5.5], '#d1b48a'))
  }
  const gate = track.gates[7], yaw = gate.yaw
  for (const side of [-1, 1]) parts.push(box([gate.position.x + Math.cos(yaw) * side * 8.5, 11, gate.position.z - Math.sin(yaw) * side * 8.5], [1, 22, 1], '#d1a755'))
  parts.push(box([gate.position.x, 22, gate.position.z], [19, 1.2, 1.3], '#d1a755', { rotation: [0, yaw, 0] }))
  signs.push({ position: [-12, 26.5, -1.5], rotation: [0, 0, 0], width: 18, height: 3.5, text: 'CONSTRUCTION / 01', caption: 'LOWER DECK  →  CLIMB  →  UPPER DECK', color: '#ffb357' },
    { position: [50, 20, 28], rotation: [0, yaw, 0], width: 13, height: 2.2, text: 'CONTAINER RUN', caption: 'KEEP YOUR LINE', color: '#ffb357' },
    { position: [-40, 6, -3.8], rotation: [0, 0, 0], width: 9, height: 2, text: 'HARD HAT ZONE', caption: 'FPV TRAINING YARD', color: '#ffb357' })
  for (const [x, z] of [[-30, 14], [28, 60], [69, 55], [-20, -92]]) {
    parts.push({ shape: 'cone', position: [x, 1, z], args: [0.65, 2, 10], color: '#f9a650' })
    decor.push(box([x, 0.08, z], [1.5, 0.16, 1.5], '#232c31'))
  }
  return { parts, decor, signs, lights, roadColor: '#5b5a51', roadWidth: 12,
    atmosphere: { sun: [85, 38, 25], sunColor: '#ffddb4', intensity: 2.2, ambient: 0.85, fogNear: 150 } }
}

function tunnels() {
  const parts = [], decor = [], signs = [], lights = []
  addCity(parts, decor, true)
  addFence(parts, decor, -62, 171, 90, -132, '#304655')
  for (const [x, z, height] of [[-37, -10, 28], [-38, -90, 34], [50, -145, 40], [144, -110, 27]]) {
    parts.push(cylinder([x, height / 2, z], 7, height, '#768c99', { material: 'metal' }),
      cylinder([x, height + 0.5, z], 7.6, 1, '#273d49'))
    for (const y of [4, height / 2, height - 3]) {
      decor.push(box([x, y, z + 7.05], [7, 0.25, 0.08], '#e3b15e'))
    }
    for (let y = 2; y < height; y += 2) decor.push(box([x + 7.1, y, z], [0.2, 0.12, 1.5], '#bccad0'))
    lights.push({ position: [x, height + 2, z], color: '#ff824b', intensity: 15, distance: 20 })
  }
  for (const x of [28, 34, 40]) {
    parts.push(cylinder([x, 24, -43], 1.3, 62, '#6d8e9c', { rotation: [Math.PI / 2, 0, 0], material: 'metal' }))
    for (const z of [-65, -25]) parts.push(box([x, 11, z], [0.5, 22, 0.5], '#4b6170'))
  }
  // Entrance portal ribs, lit sector panels, and industrial turn plazas.
  for (const z of [6, -62]) {
    parts.push(box([-9.9, 9, z], [1.1, 19.5, 1.5], '#8ba5ad'), box([9.9, 9, z], [1.1, 19.5, 1.5], '#8ba5ad'),
      box([0, 18.5, z], [21, 1.2, 1.5], '#8ba5ad'))
  }
  for (const z of [-28, -4]) {
    decor.push(box([0, 17.5, z], [10, 0.12, 0.4], '#b4edff', { glow: true }))
  }
  lights.push({ position: [0, 12, -25], color: '#63dcff', intensity: 95, distance: 40 },
    { position: [50, 12, -88], color: '#62d1ff', intensity: 90, distance: 40 },
    { position: [108, 12, -14], color: '#83dcff', intensity: 95, distance: 40 })
  for (const [x, z] of [[0, -88], [108, -88], [108, 42]]) {
    decor.push(box([x, 0.025, z], [25, 0.05, 25], '#526c7a'))
    for (const side of [x === 0 ? -1 : 1]) {
      parts.push(box([x + side * 13, 2, z], [0.7, 4, 21], '#e7b366'))
      decor.push(box([x + side * 12.9, 4.1, z], [0.3, 0.2, 21], '#ffda8a', { glow: true }))
    }
  }
  signs.push({ position: [0, 23.5, 6.5], rotation: [0, 0, 0], width: 21, height: 3.2, text: 'TUNNEL CIRCUIT', caption: 'SECTOR A  /  ENTRY', color: '#71e4ff' },
    { position: [19.7, 20, -88], rotation: [0, Math.PI / 2, 0], width: 15, height: 2.7, text: '02 / THE PIPE', caption: 'FOLLOW THE LIGHT', color: '#71e4ff' },
    { position: [108, 20, -48.7], rotation: [0, Math.PI, 0], width: 16, height: 2.7, text: '03 / RETURN', caption: 'FINAL TUNNEL', color: '#ffc27a' })
  // Bands around the round tubes add depth, without intruding into their bores.
  for (const x of [22, 38, 54, 70, 78]) for (let i = 0; i < 16; i++) {
    const angle = i * Math.PI / 8
    decor.push(box([x, 9 + Math.sin(angle) * 9.1, -88 + Math.cos(angle) * 9.1], [0.55, 3.7, 0.6], '#b8c9ce', { rotation: [angle, 0, 0] }))
  }
  return { parts, decor, signs, lights, roadColor: '#263d4c', roadWidth: 13,
    atmosphere: { sun: [-65, 12, -40], sunColor: '#a3b4e4', intensity: 1.1, ambient: 0.85, fogNear: 105 } }
}

function stadium() {
  const parts = [], decor = [], signs = [], lights = []
  // Seats are instanced visual detail on top of the solid grandstand steps.
  for (const side of [-1, 1]) {
    const x = side < 0 ? -126 : 35
    parts.push(box([x + side * 5, 24, -10], [24, 1, 138], '#e0e6df', { material: 'metal' }))
    for (const z of [-70, -10, 50]) {
      parts.push(box([x + side * 10, 12, z], [0.7, 24, 0.7], '#556d79'))
      decor.push(box([x + side * 4, 21, z], [14, 0.25, 0.25], '#a6ed79', { rotation: [0, 0, side * 0.4] }))
    }
    for (let row = 0; row < 4; row++) for (let seat = 0; seat < 52; seat++) {
      const z = -72 + seat * 2.4, sx = x + side * row * 3, y = 2.3 + row * 3.6
      const color = (seat + row) % 7 < 3 ? '#a6d87b' : '#e0e6df'
      decor.push(box([sx, y, z], [1.6, 0.3, 1.5], color), box([sx + side * 0.6, y + 0.65, z], [0.2, 1.1, 1.5], color))
      if ((seat * 7 + row * 11) % 9 < 5) {
        decor.push(box([sx, y + 0.65, z], [0.65, 0.9, 0.65], ['#6e9cb4', '#bba16e', '#dbe4d4'][(seat + row) % 3]),
          box([sx, y + 1.35, z], [0.45, 0.5, 0.45], '#bda792'))
      }
    }
  }
  for (const side of [-1, 1]) parts.push(box([side * 9, 9, 38], [1.2, 18, 1.2], '#d9e2db'))
  parts.push(box([0, 18, 38], [21, 1.6, 2], '#283f49'),
    box([-88, 24.5, 0], [25, 1, 9], '#536b79'),
    box([-100, 12, 0], [1, 24, 1], '#899da5'), box([-76, 12, 0], [1, 24, 1], '#899da5'))
  signs.push({ position: [0, 18.2, 39.1], rotation: [0, 0, 0], width: 20, height: 3.3, text: 'LIKVI / FPV CUP', caption: 'START  •  FINISH', color: '#b2f38a' },
    { position: [-48, 18, -112], rotation: [0, 0, 0], width: 55, height: 8, text: 'FPV CHAMPIONSHIP', caption: 'FIND YOUR LINE.  OWN THE LAP.', color: '#b2f38a' },
    { position: [-88, 26.2, 5], rotation: [0, 0, 0], width: 24, height: 3, text: 'SKY BRIDGE', caption: 'KEEP IT SMOOTH', color: '#b2f38a' })
  // Sponsor boards, race paddock, and flags bring the perimeter to life.
  for (let i = 0; i < 11; i++) {
    parts.push(box([-110 + i * 12, 1.5, 85], [10, 3, 0.4], i % 2 ? '#dce4de' : '#273e49'))
    decor.push(box([-110 + i * 12, 1.7, 85.25], [7, 0.5, 0.1], '#a6ed79'))
  }
  for (let i = 0; i < 6; i++) {
    const x = -103 + i * 18
    parts.push(box([x, 2, 106], [12, 4, 9], '#617a83'), box([x, 4.7, 106], [14, 1.4, 11], i % 2 ? '#b1dd89' : '#e0e6df'))
  }
  for (const [x, z] of [[-114, -90], [18, -90], [-114, 70], [18, 70]]) {
    parts.push(cylinder([x, 10, z], 0.1, 20, '#dce6dd'))
    decor.push(box([x + 1.8, 17.5, z], [3.6, 4, 0.08], '#a6ed79'))
  }
  for (let i = 0; i < 25; i++) {
    const x = -195 + i * 15, z = i % 2 ? -155 : 145
    parts.push(cylinder([x, 3, z], 0.45, 6, '#5b5347'), { shape: 'cone', position: [x, 9, z], args: [4.5, 12, 10], color: '#42674a', castShadow: false })
  }
  return { parts, decor, signs, lights, roadColor: '#34444a', roadWidth: 11,
    atmosphere: { sun: [65, 70, 35], sunColor: '#fff5da', intensity: 2.2, ambient: 0.9, fogNear: 200 } }
}

export function enhanceTrack(track) {
  const extra = ({ construction, tunnels, stadium })[track.id](track)
  return { ...track, ...extra, parts: [...track.parts.map(part => ({ ...part, material: part.glow ? undefined : track.id === 'tunnels' ? 'metal' : 'concrete' })), ...extra.parts] }
}
