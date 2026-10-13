import React, { useMemo, useRef } from 'react'
import { CuboidCollider, RigidBody, useAfterPhysicsStep, useBeforePhysicsStep, useImpulseJoint, useRapier } from '@react-three/rapier'
import { useSimulatorStore } from '../store/useSimulatorStore'
import { configureRigJoints, driveLift, FRAME_PARTS, HINGE, hingeDescriptor, kickHinge, LIFT, liftDescriptor, measureRig, resetRigBodies } from '../physics/articulatedRig'
import { freezeDrone } from '../physics/dronePhysics'

function PanelMesh({ spec }) {
  return <>
    <mesh castShadow receiveShadow userData={{ impactSurface: 'moving-gate' }}>
      <boxGeometry args={spec.halfExtents.map(value => value * 2)} />
      <meshStandardMaterial color={spec.color} metalness={0.45} roughness={0.42} />
    </mesh>
    {[-1, 1].map(side => (
      <group key={side} position={[0, 0, side * 0.195]}>
        {[-1.6, 0, 1.6].map(y => (
          <mesh key={y} position={[0, y, 0]}>
            <boxGeometry args={[6.7, 0.12, 0.035]} />
            <meshStandardMaterial color="#203543" metalness={0.65} roughness={0.3} />
          </mesh>
        ))}
        {[-2.5, -1.25, 0, 1.25, 2.5].map(x => (
          <mesh key={x} position={[x, -spec.halfExtents[1] + 0.22, 0]} rotation={[0, 0, -0.5]}>
            <boxGeometry args={[0.55, 0.3, 0.04]} />
            <meshStandardMaterial color="#15252e" roughness={0.6} />
          </mesh>
        ))}
      </group>
    ))}
  </>
}

function ArticulatedObstacles() {
  const frameRef = useRef(), hingeRef = useRef(), liftRef = useRef()
  const { rapier } = useRapier()
  const hingeParams = useMemo(() => hingeDescriptor(rapier), [rapier])
  const liftParams = useMemo(() => liftDescriptor(rapier), [rapier])
  const hingeJoint = useImpulseJoint(frameRef, hingeRef, hingeParams)
  const liftJoint = useImpulseJoint(frameRef, liftRef, liftParams)
  const control = useRef({ revision: -1, joint: null, kick: 0, open: false, tick: 0 })

  useBeforePhysicsStep(() => {
    if (!hingeRef.current || !liftRef.current || !hingeJoint.current || !liftJoint.current) return
    const state = useSimulatorStore.getState()
    const last = control.current
    if (last.joint !== hingeJoint.current || last.revision !== state.flightRevision) {
      resetRigBodies(hingeRef.current, liftRef.current)
      configureRigJoints(rapier, hingeJoint.current, liftJoint.current)
      Object.assign(last, { revision: state.flightRevision, joint: hingeJoint.current, kick: state.jointKick, open: false, tick: 0 })
    }
    if (!state.isFlying || state.isCrash) {
      freezeDrone(hingeRef.current)
      freezeDrone(liftRef.current)
      return
    }
    if (!hingeRef.current.isEnabled()) hingeRef.current.setEnabled(true)
    if (!liftRef.current.isEnabled()) liftRef.current.setEnabled(true)
    if (last.kick !== state.jointKick) {
      kickHinge(hingeRef.current)
      last.kick = state.jointKick
    }
    if (last.open !== state.jointGateOpen) {
      driveLift(liftJoint.current, liftRef.current, state.jointGateOpen)
      last.open = state.jointGateOpen
    }
  })

  useAfterPhysicsStep(() => {
    if (!hingeRef.current || !liftRef.current) return
    if (++control.current.tick % 6 === 0) {
      useSimulatorStore.getState().updateState({ jointTelemetry: measureRig(hingeRef.current, liftRef.current) })
    }
  })

  return <>
    <RigidBody ref={frameRef} type="fixed" colliders={false} userData={{ surface: 'rig-frame' }}>
      {FRAME_PARTS.map((part, index) => <React.Fragment key={index}>
        <CuboidCollider args={part.halfExtents} position={part.position} friction={0.7} restitution={0.05} />
        <mesh castShadow receiveShadow position={part.position} userData={{ impactSurface: 'rig-frame' }}>
          <boxGeometry args={part.halfExtents.map(value => value * 2)} />
          <meshStandardMaterial color="#334552" metalness={0.6} roughness={0.35} />
        </mesh>
      </React.Fragment>)}
      <mesh position={HINGE.anchor} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.13, 0.13, 7.7, 16]} />
        <meshStandardMaterial color="#c3d0d7" metalness={0.85} roughness={0.22} />
      </mesh>
    </RigidBody>
    {[[HINGE, hingeRef], [LIFT, liftRef]].map(([spec, ref], index) => (
      <RigidBody key={index} ref={ref} position={spec.position} colliders={false} ccd canSleep={false}
        angularDamping={0.6} linearDamping={0.15} userData={{ surface: 'moving-gate' }}>
        <CuboidCollider args={spec.halfExtents} mass={spec.mass} friction={0.6} restitution={0.05} />
        <PanelMesh spec={spec} />
      </RigidBody>
    ))}
  </>
}
export default ArticulatedObstacles
