import React, { useRef } from 'react'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import Quadcopter from './Quadcopter'
import { usePhysics } from '../hooks/usePhysics'
import { DRONE_COLLIDERS, START_POSITION } from '../physics/dronePhysics'
import { useSimulatorStore } from '../store/useSimulatorStore'

function QuadcopterWithCollision({ collisionWorldRef, droneRef }) {
  const cameraMode = useSimulatorStore(state => state.cameraMode)
  const bodyRef = useRef()
  usePhysics(bodyRef, collisionWorldRef)
  return (
    <RigidBody ref={bodyRef} colliders={false} ccd canSleep={false}
      angularDamping={0.15} position={[START_POSITION.x, START_POSITION.y, START_POSITION.z]}
      userData={{ isQuadcopter: true }}>
      {DRONE_COLLIDERS.map((collider, index) => {
        const Collider = collider.shape === 'cylinder' ? CylinderCollider : CuboidCollider
        return <Collider key={index} args={collider.args} position={collider.position}
          mass={collider.mass} friction={0.7} restitution={0.05} />
      })}
      <group ref={droneRef} name="drone-camera-anchor"><group visible={cameraMode !== 'fps'}><Quadcopter /></group></group>
    </RigidBody>
  )
}
export default QuadcopterWithCollision
