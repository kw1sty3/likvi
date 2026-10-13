import { randomUUID } from 'node:crypto'
import { Quaternion, Vector3 } from 'three'
import { advanceControls, createDroneBody, createFlightController, crossesRing, freezeDrone, PHYSICS_STEP, WORLD_HALF } from '../src/physics/dronePhysics.js'
import { findCrashContact } from '../src/physics/contactEvents.js'
import { waterContact } from '../src/physics/staticCollisionWorld.js'
import { ARENA_VERSION, calculateScore, RACE_RINGS } from '../src/physics/raceRules.js'

export const INPUT_KEYS = new Set(['KeyQ', 'KeyE', 'KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight'])
export const INPUT_TIMEOUT_MS = 2000
export const COUNTDOWN_TICKS = 300
export class ProtocolError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}
export function validateInput(message) {
  if (!message || Object.getPrototypeOf(message) !== Object.prototype ||
      Object.keys(message).some(key => !['seq', 'keys'].includes(key)) ||
      !Number.isSafeInteger(message.seq) || message.seq < 1 || message.seq > 2147483647 ||
      !Array.isArray(message.keys) || message.keys.length > 8 ||
      message.keys.some(key => !INPUT_KEYS.has(key)) || new Set(message.keys).size !== message.keys.length) {
    throw new ProtocolError('Ожидаются только seq и список допустимых клавиш.')
  }
}

export function createServerRace(rapier, collisionIndex, { rings = RACE_RINGS, countdownTicks = COUNTDOWN_TICKS, now = 0 } = {}) {
  const world = new rapier.World({ x: 0, y: -9.81, z: 0 })
  world.timestep = PHYSICS_STEP
  world.integrationParameters.numSolverIterations = 8
  world.integrationParameters.maxCcdSubsteps = 4
  const ground = world.createRigidBody(rapier.RigidBodyDesc.fixed())
  ground.userData = { surface: 'ground' }
  world.createCollider(rapier.ColliderDesc.cuboid(WORLD_HALF, 0.25, WORLD_HALF)
    .setTranslation(0, -0.25, 0).setFriction(0.9).setRestitution(0.05), ground)
  if (collisionIndex?.solid) {
    const obstacle = world.createRigidBody(rapier.RigidBodyDesc.fixed())
    obstacle.userData = { surface: 'obstacle', staticBvh: true }
    const geometry = collisionIndex.solid.geometry
    world.createCollider(rapier.ColliderDesc.trimesh(geometry.attributes.position.array, geometry.index.array)
      .setFriction(0.65).setRestitution(0.1), obstacle)
  }
  const body = createDroneBody(rapier, world)
  const controller = createFlightController()
  const previous = new Vector3(), orientation = new Quaternion()
  let tick = 0, raceTicks = 0, activeRingIndex = 0, status = 'countdown'
  let keys = {}, controls = { throttle: 0, pitch: 0, roll: 0, yaw: 0 }
  let ack = 0, lastInputAt = now, crashInfo = null, result = null, abortReason = null
  freezeDrone(body)
  const terminal = () => ['finished', 'crashed', 'aborted'].includes(status)
  const abort = reason => { if (!terminal()) { status = 'aborted'; abortReason = reason; keys = {}; freezeDrone(body) } }
  return {
    // These objects are available to server tests, never through the HTTP API.
    world, body,
    acceptInput(message, receivedAt) {
      validateInput(message)
      if (message.seq <= ack) throw new ProtocolError('Устаревший или повторный пакет управления.', 409)
      ack = message.seq
      lastInputAt = receivedAt
      keys = Object.fromEntries(message.keys.map(key => [key, true]))
      return ack
    },
    step(serverNow) {
      if (terminal()) return
      if (serverNow - lastInputAt > INPUT_TIMEOUT_MS) { abort('Связь прервана. Начните новый заезд.'); return }
      tick++
      if (tick <= countdownTicks) return
      status = 'running'
      if (!body.isEnabled()) body.setEnabled(true)
      // A delayed key-release packet must not keep changing the controls forever.
      controls = advanceControls(controls, serverNow - lastInputAt <= 300 ? keys : {}, PHYSICS_STEP)
      previous.copy(body.translation())
      const center = body.worldCom(), velocity = body.linvel(), angular = body.angvel()
      controller.step(body, controls, PHYSICS_STEP)
      world.step()
      raceTicks++
      const position = body.translation()
      orientation.copy(body.rotation())
      let impact = findCrashContact(world, body, center, velocity, angular, collisionIndex?.solid)
      const water = waterContact(collisionIndex?.water, previous, position, orientation)
      if (water) impact = { reason: 'Попадание в воду', point: water, normal: { x: 0, y: 1, z: 0 }, speed: Math.hypot(velocity.x, velocity.y, velocity.z) * 3.6 }
      if (!Number.isFinite(position.x + position.y + position.z) || Math.abs(position.x) > WORLD_HALF || Math.abs(position.z) > WORLD_HALF || position.y < -5 || position.y > 300) {
        impact = { reason: 'Выход за границы полигона', point: previous.clone(), normal: { x: 0, y: 1, z: 0 }, speed: Math.hypot(velocity.x, velocity.y, velocity.z) * 3.6 }
      }
      if (impact) {
        crashInfo = { ...impact, point: { ...impact.point }, normal: { ...impact.normal } }
        status = 'crashed'
        freezeDrone(body)
      } else if (crossesRing(previous, position, rings[activeRingIndex])) {
        activeRingIndex++
        if (activeRingIndex === rings.length) {
          status = 'finished'
          const timeMs = Math.round(raceTicks * PHYSICS_STEP * 1000)
          result = { id: randomUUID(), player: 'Гость', timeMs, ringsPassed: rings.length,
            totalRings: rings.length, score: calculateScore({ timeMs, ringsPassed: rings.length, totalRings: rings.length }),
            arenaVersion: ARENA_VERSION, verifiedBy: 'server', createdAt: new Date().toISOString() }
          freezeDrone(body)
        }
      }
      if (raceTicks >= 60 * 600) abort('Истекло время попытки — 10 минут.')
    },
    abort,
    snapshot() {
      return { protocol: 1, arenaVersion: ARENA_VERSION, tick, ack, status,
        countdown: Math.max(0, Math.ceil((countdownTicks - tick) / 60)),
        raceElapsedMs: Math.round(raceTicks * PHYSICS_STEP * 1000), activeRingIndex,
        position: { ...body.translation() }, quaternion: { ...body.rotation() },
        velocity: { ...body.linvel() }, angularVelocity: { ...body.angvel() },
        controls: terminal() ? { throttle: 0, pitch: 0, roll: 0, yaw: 0 } : { ...controls },
        crashInfo, result, abortReason }
    },
    dispose() { world.free() }
  }
}
