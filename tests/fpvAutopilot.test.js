import test from 'node:test'
import assert from 'node:assert/strict'
import RAPIER from '@dimforge/rapier3d-compat'
import { createFpvAutopilot } from '../src/physics/fpvAutopilot.js'
import { FPV_TRACKS, createFpvCollisionRoot } from '../src/physics/fpvTracks.js'
import { createDroneBody, createFlightController, crossesRing, FPV_FLIGHT, PHYSICS_STEP } from '../src/physics/dronePhysics.js'
import { createStaticCollisionWorld } from '../src/physics/staticCollisionWorld.js'
import { createFpvColliders } from '../src/physics/fpvCollisionShapes.js'
import { findCrashContact } from '../src/physics/contactEvents.js'
import { useSimulatorStore } from '../src/store/useSimulatorStore.js'

await RAPIER.init()

for (const track of FPV_TRACKS) test(`${track.id}: demo pilot flies every gate with real forces, yaw and collisions`, () => {
  const scene = createFpvCollisionRoot(track), index = createStaticCollisionWorld(scene.root)
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  world.timestep = PHYSICS_STEP
  world.integrationParameters.numSolverIterations = 8
  world.integrationParameters.maxCcdSubsteps = 4
  const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  ground.userData = { surface: 'ground' }
  world.createCollider(RAPIER.ColliderDesc.cuboid(420, 0.25, 420).setTranslation(0, -0.25, 0), ground)
  createFpvColliders(RAPIER, world, track)
  const body = createDroneBody(RAPIER, world, track.spawn), controller = createFlightController(FPV_FLIGHT), pilot = createFpvAutopilot(track)
  let gate = 0, ticks = 0, topSpeed = 0
  try {
    while (gate < track.gates.length && ticks++ < 60 * 180) {
      const previous = body.translation(), velocity = body.linvel(), angular = body.angvel(), center = body.worldCom()
      const controls = pilot.step({ position: previous, velocity, quaternion: body.rotation(), activeRingIndex: gate })
      assert.ok(Object.values(controls).every(value => typeof value === 'boolean' || Number.isFinite(value)))
      controller.step(body, controls)
      world.step()
      const impact = findCrashContact(world, body, center, velocity, angular, index.solid)
      assert.equal(impact, null, `gate ${gate + 1}, position ${JSON.stringify(body.translation())}, ${impact?.reason}`)
      if (crossesRing(previous, body.translation(), track.gates[gate])) gate++
      topSpeed = Math.max(topSpeed, Math.hypot(velocity.x, velocity.y, velocity.z) * 3.6)
    }
    assert.equal(gate, track.gates.length, `stalled at ${gate + 1} at ${JSON.stringify(body.translation())}`)
    assert.ok(topSpeed > 15 && topSpeed < 65, 'demo should show the route at an understandable pace')
    console.log(`${track.id}: demo ${Math.round(ticks / 60)} s, peak ${Math.round(topSpeed)} km/h`)
  } finally { world.free(); index.dispose(); scene.dispose() }
})

test('demo is one lap and cannot create a race record or a tournament result', () => {
  useSimulatorStore.setState(useSimulatorStore.getInitialState(), true)
  const actions = useSimulatorStore.getState()
  actions.setRaceLaps(5); actions.startDemo()
  assert.equal(useSimulatorStore.getState().competitionMode, 'demo')
  assert.equal(useSimulatorStore.getState().competitionStatus, 'countdown')
  actions.startRaceRun(); actions.finishRace()
  assert.equal(useSimulatorStore.getState().competitionStatus, 'running')
  const count = useSimulatorStore.getState().rings.length
  for (let i = 0; i < count; i++) actions.passActiveRing()
  const finished = useSimulatorStore.getState()
  assert.equal(finished.competitionStatus, 'finished')
  assert.equal(finished.lastResult.demo, true)
  assert.equal(finished.fpvRecords.length, 0)
  assert.equal(finished.leaderboard.length, 0)
  assert.equal(finished.tournamentEvents.length, 0)
  assert.equal(finished.raceLaps, 5, 'the user choice must survive watching a demo')
  actions.resetFlight()
  assert.equal(useSimulatorStore.getState().competitionMode, 'demo')
  assert.equal(useSimulatorStore.getState().competitionStatus, 'countdown')
})

test('taking over a demo keeps the current position and starts unscored manual flight', () => {
  useSimulatorStore.setState(useSimulatorStore.getInitialState(), true)
  const actions = useSimulatorStore.getState()
  actions.startDemo(); actions.startRaceRun()
  const position = { x: 12, y: 9, z: -20 }
  actions.updateState({ gps: position })
  const revision = useSimulatorStore.getState().flightRevision
  actions.takeOverDemo()
  const state = useSimulatorStore.getState()
  assert.equal(state.competitionMode, 'free')
  assert.equal(state.isFlying, true)
  assert.deepEqual(state.gps, position)
  assert.equal(state.flightRevision, revision)
  assert.equal(state.fpvRecords.length, 0)
  actions.returnHome(); actions.startCountdown()
  assert.equal(useSimulatorStore.getState().competitionMode, 'solo')
})
