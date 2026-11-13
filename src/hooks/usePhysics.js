import { useMemo, useRef } from 'react'
import { useAfterPhysicsStep, useBeforePhysicsStep } from '@react-three/rapier'
import { Euler, Quaternion, Vector3 } from 'three'
import { useSimulatorStore } from '../store/useSimulatorStore'
import { useKeyboardControls } from './useKeyboardControls'
import { findCrashContact, snapshotBodyMotions } from '../physics/contactEvents'
import { advanceControls, createFlightController, crossesRing, freezeDrone, PHYSICS_STEP, resetDrone, WORLD_HALF, FPV_FLIGHT, TRAINING_FLIGHT } from '../physics/dronePhysics'
import { getTrack, isFpvTrack } from '../physics/fpvTracks'
import { createFpvAutopilot } from '../physics/fpvAutopilot'
import { waterContact } from '../physics/staticCollisionWorld'

export function usePhysics(bodyRef, collisionWorldRef) {
  const fpv = useSimulatorStore(state => isFpvTrack(state.selectedMapId))
  const profile = fpv ? FPV_FLIGHT : TRAINING_FLIGHT
  const keys = useKeyboardControls({ fpv })
  const controller = useMemo(() => createFlightController(profile), [profile])
  const selectedMapId = useSimulatorStore(state => state.selectedMapId)
  const pilot = useMemo(() => fpv ? createFpvAutopilot(getTrack(selectedMapId)) : null, [fpv, selectedMapId])
  const revision = useRef(-1)
  const tick = useRef(0)
  const previous = useRef(new Vector3())
  const preVelocity = useRef(new Vector3())
  const preAngular = useRef(new Vector3())
  const preCenter = useRef(new Vector3())
  const obstacleMotions = useRef(new Map())
  const angles = useMemo(() => new Euler(0, 0, 0, 'YXZ'), [])
  const orientation = useMemo(() => new Quaternion(), [])

  useBeforePhysicsStep(world => {
    const body = bodyRef.current
    if (!body) return
    let state = useSimulatorStore.getState()
    // Preserve a tap shorter than a physics tick (notably the H throttle trim).
    // Read even while frozen so inputs released during countdown cannot linger.
    const input = keys.readWithTaps()
    if (revision.current !== state.flightRevision) {
      resetDrone(body, state.startPosition)
      controller.reset()
      pilot?.reset()
      revision.current = state.flightRevision
      tick.current = 0
    }
    const running = collisionWorldRef.current && state.isFlying && !state.awaitingStart && !state.isCrash
    if (!running) {
      freezeDrone(body)
      return
    }
    if (!body.isEnabled()) body.setEnabled(true)
    const controls = state.competitionMode === 'demo' ? pilot.step({ position: body.translation(), velocity: body.linvel(),
      quaternion: body.rotation(), activeRingIndex: state.activeRingIndex }) : advanceControls(state, input, PHYSICS_STEP, profile)
    if (Object.keys(controls).some(key => controls[key] !== state[key])) state.updateState(controls)
    state = useSimulatorStore.getState()
    previous.current.copy(body.translation())
    preVelocity.current.copy(body.linvel())
    preAngular.current.copy(body.angvel())
    preCenter.current.copy(body.worldCom())
    // Ordinary tracks contain fixed obstacles only. Capture moving obstacles
    // when the articulated rig is enabled, rather than allocating every tick.
    if (state.jointDemoEnabled) obstacleMotions.current = snapshotBodyMotions(world, body)
    else obstacleMotions.current.clear()
    controller.step(body, state, PHYSICS_STEP)
  })

  useAfterPhysicsStep(world => {
    const body = bodyRef.current
    const state = useSimulatorStore.getState()
    if (!body || !body.isEnabled() || !state.isFlying || state.isCrash) return
    const position = body.translation()
    orientation.copy(body.rotation())
    let impact = findCrashContact(world, body, preCenter.current, preVelocity.current,
      preAngular.current, collisionWorldRef.current?.solid, obstacleMotions.current)
    const water = waterContact(collisionWorldRef.current?.water, previous.current, position, orientation)
    if (water) impact = { reason: 'Попадание в воду', point: water, normal: { x: 0, y: 1, z: 0 }, speed: preVelocity.current.length() * 3.6 }
    if (!Number.isFinite(position.x + position.y + position.z) || Math.abs(position.x) > WORLD_HALF || Math.abs(position.z) > WORLD_HALF || position.y < -5 || position.y > 300) {
      impact = { reason: 'Выход за границы полигона', point: previous.current.clone(), normal: { x: 0, y: 1, z: 0 }, speed: preVelocity.current.length() * 3.6 }
    }
    if (impact) {
      state.registerCrash(impact)
      freezeDrone(body)
    } else if (state.competitionStatus === 'running' && crossesRing(previous.current, position, state.rings[state.activeRingIndex])) {
      state.passActiveRing()
      if (!useSimulatorStore.getState().isFlying) freezeDrone(body)
    }
    // Limit React telemetry to 20 Hz; simulation remains at 60 Hz.
    tick.current++
    if (tick.current % 3 === 0 || impact || !useSimulatorStore.getState().isFlying) {
      const velocity = body.linvel()
      angles.setFromQuaternion(orientation, 'YXZ')
      state.updateState({
        gps: { x: position.x, y: position.y, z: position.z },
        altitude: position.y,
        speed: Math.hypot(velocity.x, velocity.y, velocity.z) * 3.6,
        velocity: { x: velocity.x, y: velocity.y, z: velocity.z },
        angularVelocity: { ...body.angvel() },
        rotation: { x: angles.x, y: angles.y, z: angles.z }
      })
    }
  })
}
