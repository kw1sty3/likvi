import React, { useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import * as THREE from 'three'
import { useSimulatorStore } from './store/useSimulatorStore'
import QuadcopterWithCollision from './components/QuadcopterWithCollision'
import EnhancedTerrain from './components/EnhancedTerrain'
import CollisionDetector from './components/CollisionDetector'
import { PHYSICS_STEP } from './physics/dronePhysics'
import CameraController from './components/CameraController'
import Trajectory from './components/Trajectory'
import FlightStats from './components/FlightStats'
import CrashNotification from './components/CrashNotification'
import CrashParticles from './components/CrashParticles'
import ImpactDecal from './components/ImpactDecal'
import SoundSystem from './components/SoundSystem'
import MiniMap from './components/MiniMap'
import Achievements from './components/Achievements'
import HUD from './components/HUD'
import SettingsPanel from './components/SettingsPanel'
import ControlsPanel from './components/ControlsPanel'
import ChallengeRings from './components/ChallengeRings'
import ArticulatedObstacles from './components/ArticulatedObstacles'
import JointDemoPanel from './components/JointDemoPanel'
import ServerFlight from './components/ServerFlight'
import ServerStatus from './components/ServerStatus'
import FpvTerrain from './components/FpvTerrain'
import FpvRaceHUD from './components/FpvRaceHUD'
import { getTrack, isFpvTrack } from './physics/fpvTracks'
import { FlightOverlay, HomeScreen, ModeSelectScreen, TournamentBrowserScreen } from './components/OlympiadUI'
import './App.css'

function SceneAtmosphere({ atmosphere }) {
  return (
    <>
      <Sky
        distance={450000}
        sunPosition={atmosphere?.sun ?? [80, 55, 30]}
        inclination={0.48}
        azimuth={0.24}
        turbidity={5}
        rayleigh={1.6}
        mieCoefficient={0.006}
        mieDirectionalG={0.78}
      />
      <hemisphereLight args={['#dff4ff', '#6c8c5a', atmosphere?.ambient ?? 0.75]} />
      {atmosphere && <ambientLight intensity={0.16} color="#d4e3ed" />}
      <directionalLight
        castShadow
        position={[70, 120, 45]}
        intensity={atmosphere?.intensity ?? 2.25}
        color={atmosphere?.sunColor ?? '#fff2d0'}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={260}
        shadow-camera-left={-110}
        shadow-camera-right={110}
        shadow-camera-top={110}
        shadow-camera-bottom={-110}
      />
      <directionalLight position={[-60, 45, -70]} intensity={0.45} color="#9fd0ff" />
    </>
  )
}

function PhysicsWorld({ droneRef }) {
  const selectedMapId = useSimulatorStore(state => state.selectedMapId)
  const jointDemoEnabled = useSimulatorStore(state => state.jointDemoEnabled)
  const serverMode = useSimulatorStore(state => state.competitionMode === 'server')
  const terrainRef = useRef()
  const collisionWorldRef = useRef()
  return <>
    {isFpvTrack(selectedMapId) ? <FpvTerrain terrainRef={terrainRef} track={getTrack(selectedMapId)} /> : <EnhancedTerrain terrainRef={terrainRef} />}
    {!serverMode && <CollisionDetector terrainRef={terrainRef} collisionWorldRef={collisionWorldRef}
      track={isFpvTrack(selectedMapId) ? getTrack(selectedMapId) : null} />}
    {jointDemoEnabled && <ArticulatedObstacles />}
    {serverMode ? <ServerFlight droneRef={droneRef} /> : <QuadcopterWithCollision droneRef={droneRef} collisionWorldRef={collisionWorldRef} />}
  </>
}

function SimulatorScene() {
  const selectedMapId = useSimulatorStore(state => state.selectedMapId)
  const fpvMode = isFpvTrack(selectedMapId)
  const track = getTrack(selectedMapId)
  const droneRef = useRef()
  const physicsDebug = useSimulatorStore(state => state.physicsDebug)
  const jointDemoEnabled = useSimulatorStore(state => state.jointDemoEnabled)
  const serverMode = useSimulatorStore(state => state.competitionMode === 'server')
  return (
    <div className={`app${serverMode ? ' server-flight' : ''}${fpvMode ? ' fpv-flight' : ''}`}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, 20, 30], fov: 75 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false
        }}
        onCreated={({ gl, camera }) => {
          gl.setClearColor('#9fd8ff')
          gl.outputColorSpace = THREE.SRGBColorSpace
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.05
          gl.shadowMap.enabled = true
          gl.shadowMap.type = THREE.PCFSoftShadowMap
          camera.lookAt(0, 0, 0)
        }}
      >
        <color attach="background" args={[track.sky ?? '#9fd8ff']} />
        <fog attach="fog" args={[track.sky ?? '#bfe7ff', track.atmosphere?.fogNear ?? 130, 620]} />

        <SceneAtmosphere atmosphere={track.atmosphere} />

        <Physics gravity={[0, -9.81, 0]} timeStep={PHYSICS_STEP} interpolate paused={serverMode}
          updatePriority={-2} maxCcdSubsteps={4} numSolverIterations={8} debug={physicsDebug}>
          <PhysicsWorld key={selectedMapId} droneRef={droneRef} />
        </Physics>

        {!fpvMode && <ChallengeRings />}
        <CameraController droneRef={droneRef} />
        <Trajectory />
        <FlightStats />
        <SoundSystem />
        <CrashParticles />
        <ImpactDecal />
      </Canvas>

      {!serverMode && !fpvMode && <HUD />}
      <SettingsPanel />
      {!jointDemoEnabled && !serverMode && !fpvMode && <ControlsPanel />}
      {!jointDemoEnabled && !serverMode && !fpvMode && <MiniMap />}
      <CrashNotification />
      {!fpvMode && <Achievements />}
      {fpvMode ? <FpvRaceHUD /> : <FlightOverlay />}
      <JointDemoPanel />
      <ServerStatus />
    </div>
  )
}

function App() {
  const appScreen = useSimulatorStore((state) => state.appScreen)

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && appScreen === 'flight') {
        useSimulatorStore.getState().returnHome()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [appScreen])

  if (appScreen === 'home') {
    return <HomeScreen />
  }

  if (appScreen === 'mode-select') {
    return <ModeSelectScreen />
  }

  if (appScreen === 'tournaments') {
    return <TournamentBrowserScreen />
  }

  return <SimulatorScene />
}

export default App
