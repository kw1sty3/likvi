import { create } from 'zustand'
import { FPV_HOVER_THROTTLE, START_POSITION } from '../physics/dronePhysics.js'
import { JOINT_DEMO_SPAWN } from '../physics/articulatedRig.js'
import { RACE_RINGS, calculateScore } from '../physics/raceRules.js'
import { Euler, Quaternion } from 'three'
import { createImpactEvent } from '../physics/impactEffects.js'
import { DEFAULT_TRACK_ID, FPV_TRACKS, getTrack, isFpvTrack, TRACK_VERSION } from '../physics/fpvTracks.js'

const LEADERBOARD_KEY = 'likvi-leaderboard'
// A new physics model has its own records; the v1 browser data stays intact.
const FPV_RECORDS_KEY = 'likvi-fpv-records-v2'

const loadFpvRecords = () => {
  try {
    const saved = typeof window !== 'undefined' && JSON.parse(window.localStorage.getItem(FPV_RECORDS_KEY) || '[]')
    return Array.isArray(saved) ? saved.filter(item => isFpvTrack(item.trackId) && item.version === TRACK_VERSION &&
      Number.isFinite(item.timeMs) && item.timeMs > 0 && [1, 3, 5].includes(item.laps)).slice(0, 300) : []
  } catch { return [] }
}

const loadLeaderboard = () => {
  if (typeof window === 'undefined') return []

  try {
    const saved = window.localStorage.getItem(LEADERBOARD_KEY)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

const saveLeaderboard = (items) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(items))
}

const getNow = () => {
  if (typeof performance !== 'undefined') return performance.now()
  return Date.now()
}

const createInitialBracket = () => ([
  {
    id: 'quarterfinals',
    title: '1/4 финала',
    matches: [
      { id: 'qf-1', top: 'Ожидание участника', bottom: 'Ожидание участника', status: 'empty' },
      { id: 'qf-2', top: 'Ожидание участника', bottom: 'Ожидание участника', status: 'empty' },
      { id: 'qf-3', top: 'Ожидание участника', bottom: 'Ожидание участника', status: 'empty' },
      { id: 'qf-4', top: 'Ожидание участника', bottom: 'Ожидание участника', status: 'empty' }
    ]
  },
  {
    id: 'semifinals',
    title: '1/2 финала',
    matches: [
      { id: 'sf-1', top: 'Победитель 1/4', bottom: 'Победитель 1/4', status: 'locked' },
      { id: 'sf-2', top: 'Победитель 1/4', bottom: 'Победитель 1/4', status: 'locked' }
    ]
  },
  {
    id: 'final',
    title: 'Финал',
    matches: [
      { id: 'final-1', top: 'Победитель 1/2', bottom: 'Победитель 1/2', status: 'locked' }
    ]
  }
])

const createNotification = (type, message) => ({
  id: `notice-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  type,
  message,
  createdAt: Date.now()
})

const buildBracketFromLeaderboard = (leaderboard) => {
  const bracket = createInitialBracket()
  const seeded = leaderboard.slice(0, 8)

  bracket[0].matches = bracket[0].matches.map((match, index) => {
    const top = seeded[index * 2]
    const bottom = seeded[index * 2 + 1]

    return {
      ...match,
      top: top ? `${top.player} (${top.score ?? 0})` : 'Ожидание участника',
      bottom: bottom ? `${bottom.player} (${bottom.score ?? 0})` : 'Ожидание участника',
      status: top || bottom ? 'seeded' : 'empty'
    }
  })

  return bracket
}

export const useSimulatorStore = create((set, get) => ({
  throttle: 0,
  pitch: 0,
  roll: 0,
  yaw: 0,
  brake: false,
  autopilot: false,

  altitude: START_POSITION.y,
  speed: 0,
  battery: 100,
  gps: { ...START_POSITION },
  rotation: { x: 0, y: 0, z: 0 },
  startPosition: { ...START_POSITION },

  velocity: { x: 0, y: 0, z: 0 },
  angularVelocity: { x: 0, y: 0, z: 0 },
  moveX: 0,
  moveZ: 0,

  cameraMode: 'orbit',
  showHUD: true,
  showTrajectory: false,
  particleEffects: true,
  soundEnabled: true,
  safeMode: true,
  speedMultiplier: 1,

  flightTime: 0,
  maxAltitude: 0,
  distance: 0,
  trajectory: [],

  isFlying: false,
  isCrash: false,
  crashInfo: null,
  flightRevision: 0,
  physicsDebug: false,
  serverTick: -1,
  serverError: null,
  jointDemoEnabled: false,
  jointKick: 0,
  jointGateOpen: false,
  jointTelemetry: { hingeAngle: 0, liftTravel: 0, anchorError: 0, lateralError: 0 },
  awaitingStart: true,

  timeOfDay: 0.5,
  isDay: true,
  sunElevation: 1,

  appScreen: 'home',
  modeSelectBackTarget: 'home',
  authModal: null,
  selectedDroneId: 'training-drone',
  selectedMapId: DEFAULT_TRACK_ID,
  raceLaps: 3,
  currentLap: 1,
  lapTimes: [],
  lapStartedAtMs: 0,
  fpvRecords: loadFpvRecords(),
  showRaceGuide: true,
  competitionMode: null,
  competitionStatus: 'idle',
  countdown: 5,
  raceStartedAt: null,
  raceElapsedMs: 0,
  resultVisibleUntil: null,
  activeRingIndex: 0,
  rings: getTrack(DEFAULT_TRACK_ID).gates,
  leaderboard: loadLeaderboard(),
  lastResult: null,

  tournamentCatalog: [],
  currentTournamentId: null,
  tournamentEnrollment: null,
  tournamentDraft: {
    title: 'Турнир Likvi',
    timeLimit: 'any',
    droneLimit: 'any',
    mapLimit: 'any'
  },
  tournamentFilters: {
    timeLimit: 'any',
    droneLimit: 'any',
    mapLimit: 'any'
  },
  notifications: [],
  opponentStatus: 'offline',
  matchmakingStatus: 'idle',
  tournamentEvents: [],
  bracketRounds: buildBracketFromLeaderboard(loadLeaderboard()),

  setThrottle: (value) => set({ throttle: Math.max(0, Math.min(1, value)) }),
  setPitch: (value) => set({ pitch: Math.max(-1, Math.min(1, value)) }),
  setRoll: (value) => set({ roll: Math.max(-1, Math.min(1, value)) }),
  setYaw: (value) => set({ yaw: Math.max(-1, Math.min(1, value)) }),
  setMoveX: (value) => set({ moveX: Math.max(-1, Math.min(1, value)) }),
  setMoveZ: (value) => set({ moveZ: Math.max(-1, Math.min(1, value)) }),
  setSpeedMultiplier: (value) => set({ speedMultiplier: Math.max(0.2, Math.min(3, value)) }),
  startFlight: () => set({ awaitingStart: false, isFlying: true }),
  setStartPosition: (pos) => set({ startPosition: pos, gps: pos }),
  selectMap: id => {
    if (get().appScreen === 'flight' || ![...FPV_TRACKS.map(track => track.id), 'polytech-arena'].includes(id)) return
    set({ selectedMapId: id, rings: getTrack(id).gates })
  },
  setRaceLaps: laps => { if (get().appScreen !== 'flight' && [1, 3, 5].includes(Number(laps))) set({ raceLaps: Number(laps) }) },
  toggleRaceGuide: () => set(state => ({ showRaceGuide: !state.showRaceGuide })),

  updateState: (state) => set(state),

  registerCrash: (impact) => {
    const state = get()
    if (state.competitionMode === 'server') return
    if (state.isCrash || !state.isFlying) return
    const failedRace = state.competitionStatus === 'running'
    set({
      isCrash: true,
      isFlying: false,
      throttle: 0, pitch: 0, roll: 0, yaw: 0, brake: false,
      crashInfo: createImpactEvent(impact, state.flightRevision),
      competitionStatus: failedRace ? 'crashed' : state.competitionStatus,
      raceElapsedMs: failedRace && state.raceStartedAt !== null ? getNow() - state.raceStartedAt : state.raceElapsedMs
    })
    state.pushNotification('warning', impact.reason)
    state.recordTournamentEvent('crash', impact.reason)
  },

  togglePhysicsDebug: () => set(state => ({ physicsDebug: !state.physicsDebug })),

  resetFlight: () => set((state) => ({
    flightRevision: state.flightRevision + 1,
    currentLap: 1,
    lapTimes: [],
    lapStartedAtMs: 0,
    crashInfo: null,
    serverTick: -1,
    serverError: null,
    jointKick: 0,
    jointGateOpen: false,
    jointTelemetry: { hingeAngle: 0, liftTravel: 0, anchorError: 0, lateralError: 0 },
    ...(['solo', 'demo'].includes(state.competitionMode) ? {
      competitionStatus: 'countdown', countdown: 5, activeRingIndex: 0,
      raceStartedAt: null, raceElapsedMs: 0, lastResult: null, resultVisibleUntil: null
    } : {}),
    ...(state.competitionMode === 'server' ? {
      competitionStatus: 'connecting', countdown: 5, activeRingIndex: 0,
      raceStartedAt: null, raceElapsedMs: 0, lastResult: null, resultVisibleUntil: null
    } : {}),
    throttle: state.competitionMode === 'free' && isFpvTrack(state.selectedMapId) ? FPV_HOVER_THROTTLE : 0,
    brake: false,
    autopilot: false,
    pitch: 0,
    roll: 0,
    yaw: 0,
    altitude: state.startPosition.y,
    speed: 0,
    battery: 100,
    velocity: { x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    flightTime: 0,
    maxAltitude: 0,
    distance: 0,
    trajectory: [],
    isFlying: state.competitionMode === 'free',
    isCrash: false,
    awaitingStart: state.competitionMode !== 'free',
    gps: { x: state.startPosition.x, y: state.startPosition.y, z: state.startPosition.z },
    rotation: { x: 0, y: 0, z: 0 },
    moveX: 0,
    moveZ: 0,
    speedMultiplier: 1
  })),

  setCameraMode: (mode) => set({ cameraMode: mode }),
  toggleHUD: () => set((state) => ({ showHUD: !state.showHUD })),
  toggleTrajectory: () => set((state) => ({ showTrajectory: !state.showTrajectory })),
  toggleParticles: () => set((state) => ({ particleEffects: !state.particleEffects })),
  toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
  toggleSafeMode: () => set((state) => ({ safeMode: !state.safeMode })),

  openAuthModal: (type) => set({ authModal: type }),
  closeAuthModal: () => set({ authModal: null }),
  openTournamentBrowser: () => set({ appScreen: 'tournaments' }),
  backToTournamentBrowser: () => set({
    appScreen: 'tournaments',
    competitionMode: null,
    competitionStatus: 'idle',
    matchmakingStatus: 'idle',
    opponentStatus: 'offline'
  }),
  openModeSelect: (backTarget = 'home') => set({
    appScreen: 'mode-select',
    modeSelectBackTarget: backTarget,
    competitionMode: null,
    competitionStatus: 'idle'
  }),
  backFromModeSelect: () => {
    const state = get()
    set({
      appScreen: state.modeSelectBackTarget === 'tournaments' ? 'tournaments' : 'home',
      competitionMode: null,
      competitionStatus: 'idle',
      matchmakingStatus: 'idle',
      opponentStatus: 'offline'
    })
  },
  returnHome: () => set({
    appScreen: 'home',
    jointDemoEnabled: false,
    modeSelectBackTarget: 'home',
    competitionMode: null,
    competitionStatus: 'idle',
    matchmakingStatus: 'idle',
    opponentStatus: 'offline'
  }),
  selectCompetitionMode: (mode) => set({ competitionMode: mode }),

  startFreeFlight: () => {
    const track = getTrack(get().selectedMapId)
    set({ startPosition: { ...track.spawn }, rings: track.gates, jointDemoEnabled: false,
      ...(isFpvTrack(track.id) ? { cameraMode: 'fps' } : {}) })
    get().resetFlight()
    set({
      appScreen: 'flight',
      competitionMode: 'free',
      competitionStatus: 'idle',
      countdown: 5,
      activeRingIndex: 0,
      raceStartedAt: null,
      raceElapsedMs: 0,
      resultVisibleUntil: null,
      lastResult: null,
      awaitingStart: false,
      isFlying: true,
      throttle: isFpvTrack(track.id) ? FPV_HOVER_THROTTLE : 0
    })
    get().pushNotification('info', 'Свободный полет запущен.')
  },

  startJointDemo: () => {
    set({ selectedMapId: 'polytech-arena', rings: RACE_RINGS })
    get().startFreeFlight()
    set({ jointDemoEnabled: true, startPosition: { ...JOINT_DEMO_SPAWN }, cameraMode: 'follow' })
    get().resetFlight()
  },

  startServerRace: () => {
    set({ appScreen: 'flight', competitionMode: 'server', jointDemoEnabled: false,
      startPosition: { ...START_POSITION }, cameraMode: 'follow', selectedMapId: 'polytech-arena', rings: RACE_RINGS })
    get().resetFlight()
  },
  serverFlightError: message => {
    if (get().competitionMode !== 'server') return
    set({ serverError: message, competitionStatus: 'network-error', isFlying: false,
      awaitingStart: false, throttle: 0, pitch: 0, roll: 0, yaw: 0 })
  },
  applyServerSnapshot: snapshot => {
    const state = get()
    if (state.competitionMode !== 'server' || snapshot.tick < state.serverTick) return
    const angles = new Euler().setFromQuaternion(new Quaternion().copy(snapshot.quaternion), 'YXZ')
    const error = snapshot.abortReason || snapshot.storageError
    const status = error ? 'network-error' : snapshot.status === 'finished' && !snapshot.resultStored ? 'saving' : snapshot.status
    set({ serverTick: snapshot.tick, serverError: error, competitionStatus: status,
      countdown: snapshot.countdown, activeRingIndex: snapshot.activeRingIndex,
      raceElapsedMs: snapshot.raceElapsedMs, gps: snapshot.position, altitude: snapshot.position.y,
      rotation: { x: angles.x, y: angles.y, z: angles.z }, velocity: snapshot.velocity,
      angularVelocity: snapshot.angularVelocity, speed: Math.hypot(snapshot.velocity.x, snapshot.velocity.y, snapshot.velocity.z) * 3.6,
      ...snapshot.controls, isFlying: status === 'running', awaitingStart: status === 'countdown',
      isCrash: status === 'crashed', crashInfo: snapshot.crashInfo
        ? state.crashInfo ?? createImpactEvent(snapshot.crashInfo, state.flightRevision) : null,
      lastResult: snapshot.resultStored ? snapshot.result : null })
    if (snapshot.crashInfo && !state.isCrash) state.pushNotification('warning', snapshot.crashInfo.reason)
    if (status === 'finished' && state.competitionStatus !== 'finished') state.pushNotification('success', 'Результат сохранён на сервере.')
  },
  swingJointGate: () => {
    const state = get()
    if (state.jointDemoEnabled && state.isFlying && !state.isCrash) set({ jointKick: state.jointKick + 1 })
  },
  toggleJointLift: () => {
    const state = get()
    if (state.jointDemoEnabled && state.isFlying && !state.isCrash) set({ jointGateOpen: !state.jointGateOpen })
  },

  updateTournamentDraft: (updates) => set((state) => ({
    tournamentDraft: { ...state.tournamentDraft, ...updates }
  })),

  updateTournamentFilters: (updates) => set((state) => ({
    tournamentFilters: { ...state.tournamentFilters, ...updates }
  })),

  selectTournament: (tournamentId) => set({ currentTournamentId: tournamentId }),

  createTournament: () => {
    const state = get()
    const tournament = {
      id: `tournament-${Date.now()}`,
      title: state.tournamentDraft.title.trim() || 'Турнир Likvi',
      timeLimit: state.tournamentDraft.timeLimit,
      droneLimit: state.tournamentDraft.droneLimit,
      mapLimit: state.tournamentDraft.mapLimit,
      createdAt: new Date().toISOString(),
      participants: []
    }

    set((prev) => ({
      tournamentCatalog: [tournament, ...prev.tournamentCatalog],
      currentTournamentId: tournament.id
    }))
    get().pushNotification('success', 'Турнир создан. Теперь можно записаться.')
    get().recordTournamentEvent('tournament', `Создан турнир: ${tournament.title}.`)
  },

  joinTournament: (tournamentId) => {
    const state = get()
    const tournament = state.tournamentCatalog.find((item) => item.id === tournamentId)

    if (!tournament) {
      state.pushNotification('warning', 'Турнир не найден.')
      return
    }

    const enrollment = {
      tournamentId,
      player: 'Пользователь',
      joinedAt: new Date().toISOString()
    }

    set((prev) => ({
      currentTournamentId: tournamentId,
      tournamentEnrollment: enrollment,
      tournamentCatalog: prev.tournamentCatalog.map((item) => {
        if (item.id !== tournamentId) return item

        const hasParticipant = item.participants.some((participant) => participant.player === enrollment.player)
        return {
          ...item,
          participants: hasParticipant ? item.participants : [...item.participants, enrollment]
        }
      })
    }))
    get().pushNotification('success', 'Вы записаны в турнир.')
    get().recordTournamentEvent('tournament', `Запись в турнир: ${tournament.title}.`)
  },

  leaveTournament: () => {
    const state = get()
    if (!state.tournamentEnrollment) {
      state.pushNotification('warning', 'Вы пока не записаны в турнир.')
      return
    }

    const { tournamentId, player } = state.tournamentEnrollment
    set((prev) => ({
      tournamentEnrollment: null,
      tournamentCatalog: prev.tournamentCatalog.map((item) => item.id === tournamentId
        ? { ...item, participants: item.participants.filter((participant) => participant.player !== player) }
        : item)
    }))
    get().pushNotification('network', 'Запись в турнир отменена.')
  },

  pushNotification: (type, message) => set((state) => ({
    notifications: [createNotification(type, message), ...state.notifications].slice(0, 5)
  })),

  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter((item) => item.id !== id)
  })),

  recordTournamentEvent: (type, message) => set((state) => ({
    tournamentEvents: [
      {
        id: `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type,
        message,
        createdAt: new Date().toISOString()
      },
      ...state.tournamentEvents
    ].slice(0, 12)
  })),

  startMatchmaking: () => {
    const state = get()
    if (state.matchmakingStatus === 'searching' || state.matchmakingStatus === 'checking') {
      state.pushNotification('warning', 'Матчмейкинг уже запущен.')
      return
    }

    set({
      competitionMode: 'competitive',
      matchmakingStatus: 'searching',
      opponentStatus: 'searching'
    })
    get().pushNotification('network', 'Поиск соперника запущен.')
    get().recordTournamentEvent('matchmaking', 'Игрок запустил поиск соревновательного матча.')
  },

  setMatchmakingStatus: (status) => set({ matchmakingStatus: status }),
  setOpponentStatus: (status) => set({ opponentStatus: status }),

  completeMatchmakingStub: () => {
    set({
      matchmakingStatus: 'stub',
      opponentStatus: 'offline'
    })
    get().pushNotification('network', 'Соперник не найден: сетевой сервер пока не подключен.')
    get().recordTournamentEvent('matchmaking', 'Матчмейкинг завершен заглушкой без создания матча.')
  },

  cancelMatchmaking: () => {
    set({
      matchmakingStatus: 'idle',
      opponentStatus: 'offline'
    })
    get().pushNotification('network', 'Поиск соперника остановлен.')
  },

  startCountdown: () => {
    const track = getTrack(get().selectedMapId)
    set({ startPosition: { ...track.spawn }, rings: track.gates, jointDemoEnabled: false,
      ...(isFpvTrack(track.id) ? { cameraMode: 'fps' } : {}) })
    get().resetFlight()
    set({
      appScreen: 'flight',
      competitionMode: 'solo',
      competitionStatus: 'countdown',
      awaitingStart: true,
      isFlying: false,
      countdown: 5,
      activeRingIndex: 0,
      raceStartedAt: null,
      raceElapsedMs: 0,
      resultVisibleUntil: null,
      lastResult: null
    })
    get().pushNotification('info', 'Одиночный заезд: подготовка 5 секунд.')
    get().recordTournamentEvent('solo', 'Запущен одиночный квалификационный заезд.')
  },

  startDemo: () => {
    const track = getTrack(get().selectedMapId)
    if (!isFpvTrack(track.id)) return
    set({ competitionMode: 'demo', startPosition: { ...track.spawn }, rings: track.gates,
      jointDemoEnabled: false, cameraMode: 'follow', appScreen: 'flight' })
    get().resetFlight()
  },

  takeOverDemo: () => {
    const state = get()
    if (state.competitionMode !== 'demo' || state.competitionStatus === 'finished' || state.isCrash) return
    set({ competitionMode: 'free', competitionStatus: 'idle', awaitingStart: false, isFlying: true, cameraMode: 'fps',
      throttle: FPV_HOVER_THROTTLE, pitch: 0, roll: 0, yaw: 0, brake: false, autopilot: false })
  },

  setCountdown: (countdown) => set({ countdown }),

  startRaceRun: () => {
    const state = get()
    if (state.competitionMode === 'server') return
    if (state.competitionStatus !== 'countdown') {
      state.pushNotification('warning', 'Старт отклонен: заезд не находится в состоянии подготовки.')
      return
    }

    set({
      competitionStatus: 'running',
      countdown: 0,
      raceStartedAt: getNow(),
      raceElapsedMs: 0,
      awaitingStart: false,
      isFlying: true,
      ...(isFpvTrack(state.selectedMapId) ? { throttle: FPV_HOVER_THROTTLE } : {})
    })
    if (state.competitionMode === 'demo') return
    get().pushNotification('success', 'Зачет времени начался.')
    get().recordTournamentEvent('solo', 'Зачет времени начался после обратного отсчета.')
  },

  updateRaceElapsed: () => {
    if (get().competitionMode === 'server') return
    const { raceStartedAt, competitionStatus } = get()
    if (!raceStartedAt || competitionStatus !== 'running') return
    set({ raceElapsedMs: getNow() - raceStartedAt })
  },

  passActiveRing: () => {
    const state = get()
    if (state.competitionMode === 'server') return
    if (state.competitionStatus !== 'running') {
      state.pushNotification('warning', 'Кольцо не засчитано: заезд не активен.')
      return
    }

    const nextIndex = state.activeRingIndex + 1
    if (nextIndex >= state.rings.length) {
      if (isFpvTrack(state.selectedMapId) && state.competitionMode !== 'demo' && state.currentLap < state.raceLaps) {
        const elapsed = getNow() - state.raceStartedAt
        set({ currentLap: state.currentLap + 1, activeRingIndex: 0,
          lapTimes: [...state.lapTimes, Math.round(elapsed - state.lapStartedAtMs)], lapStartedAtMs: elapsed })
        state.pushNotification('success', `Круг ${state.currentLap} завершён. Следующий круг!`)
        return
      }
      state.finishRace()
      return
    }

    set({ activeRingIndex: nextIndex })
    if (state.competitionMode === 'demo') return
    get().pushNotification('success', `Кольцо ${nextIndex} пройдено.`)
    get().recordTournamentEvent('checkpoint', `Засчитано кольцо ${nextIndex} из ${state.rings.length}.`)
  },

  finishRace: () => {
    const state = get()
    if (state.competitionMode === 'server') return
    if (state.competitionStatus !== 'running') {
      state.pushNotification('warning', 'Финиш отклонен: заезд не активен.')
      return
    }

    if (state.competitionMode === 'demo') {
      if (state.activeRingIndex !== state.rings.length - 1) return
      const timeMs = Math.max(1, Math.round(getNow() - state.raceStartedAt))
      set({ competitionStatus: 'finished', raceElapsedMs: timeMs, lapTimes: [timeMs],
        lastResult: { demo: true, map: getTrack(state.selectedMapId).name, laps: 1, timeMs },
        throttle: 0, pitch: 0, roll: 0, yaw: 0, brake: false, isFlying: false })
      return
    }
    if (isFpvTrack(state.selectedMapId)) {
      if (state.activeRingIndex !== state.rings.length - 1 || state.currentLap !== state.raceLaps) return
      const timeMs = Math.max(1, Math.round(getNow() - state.raceStartedAt))
      const entry = { id: `fpv-${Date.now()}`, trackId: state.selectedMapId, version: TRACK_VERSION,
        map: getTrack(state.selectedMapId).name, laps: state.raceLaps, timeMs,
        lapTimes: [...state.lapTimes, Math.max(1, Math.round(timeMs - state.lapStartedAtMs))], createdAt: new Date().toISOString() }
      // Cap each comparable category separately so fast stadium runs cannot evict tunnel records.
      const counts = new Map()
      const fpvRecords = [...state.fpvRecords, entry].sort((a, b) => a.timeMs - b.timeMs).filter(item => {
        const key = `${item.trackId}:${item.laps}`
        const count = (counts.get(key) ?? 0) + 1
        counts.set(key, count)
        return count <= 30
      })
      let savedLocally = true
      try {
        if (typeof window !== 'undefined') window.localStorage.setItem(FPV_RECORDS_KEY, JSON.stringify(fpvRecords))
      } catch { savedLocally = false }
      set({ fpvRecords, lastResult: { ...entry, savedLocally }, raceElapsedMs: timeMs, competitionStatus: 'finished',
        lapTimes: entry.lapTimes, throttle: 0, pitch: 0, roll: 0, yaw: 0, brake: false, isFlying: false })
      state.pushNotification('success', 'Все круги пройдены. Финиш!')
      return
    }

    const finalTime = state.raceStartedAt ? getNow() - state.raceStartedAt : state.raceElapsedMs
    const nextNumber = state.leaderboard.length + 1
    const score = calculateScore({
      timeMs: finalTime,
      ringsPassed: state.rings.length,
      totalRings: state.rings.length
    })
    const entry = {
      id: `result-${Date.now()}`,
      player: `Пользователь ${nextNumber}`,
      timeMs: Math.round(finalTime),
      score,
      ringsPassed: state.rings.length,
      totalRings: state.rings.length,
      drone: 'Учебный квадрокоптер',
      map: 'Арена Московского Политеха',
      createdAt: new Date().toISOString()
    }
    const leaderboard = [...state.leaderboard, entry]
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.timeMs - b.timeMs)
      .slice(0, 100)

    saveLeaderboard(leaderboard)
    set({
      leaderboard,
      bracketRounds: buildBracketFromLeaderboard(leaderboard),
      lastResult: entry,
      raceElapsedMs: Math.round(finalTime),
      competitionStatus: 'finished',
      resultVisibleUntil: Date.now() + 10000,
      throttle: 0,
      pitch: 0,
      roll: 0,
      yaw: 0,
      isFlying: false
    })
    get().pushNotification('success', `Финиш засчитан. Очки: ${score}.`)
    get().recordTournamentEvent('finish', `Финиш: ${score} очков, время ${Math.round(finalTime / 1000)} сек.`)
  },

  completeResultView: () => {
    if (get().competitionMode === 'server') { get().returnHome(); return }
    get().resetFlight()
    set({
      appScreen: 'home',
      competitionMode: null,
      competitionStatus: 'idle',
      countdown: 5,
      raceStartedAt: null,
      activeRingIndex: 0,
      resultVisibleUntil: null
    })
  }
}))
