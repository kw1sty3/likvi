import { Quaternion, Vector3 } from 'three'

export const JOINT_DEMO_SPAWN = { x: 24, y: 0.86, z: 7 }
export const HINGE = {
  position: [18, 3.6, -16], anchor: [18, 6.4, -16], localAnchor: [0, 2.8, 0],
  halfExtents: [3.5, 2.8, 0.18], mass: 6, limit: 35 * Math.PI / 180,
  axis: [1, 0, 0], color: '#f5a623'
}
export const LIFT = {
  position: [30, 2.9, -16], anchor: [30, 2.9, -16], localAnchor: [0, 0, 0],
  halfExtents: [3.5, 2.5, 0.18], mass: 5, travel: 4.8,
  axis: [0, 1, 0], color: '#28c6d8'
}
export const FRAME_PARTS = [
  ...[13.9, 22.1].map(x => ({ position: [x, 3.35, -16], halfExtents: [0.25, 3.35, 0.5] })),
  { position: [18, 6.75, -16], halfExtents: [4.35, 0.25, 0.5] },
  ...[25.9, 34.1].map(x => ({ position: [x, 5.35, -16], halfExtents: [0.25, 5.35, 0.5] })),
  { position: [30, 10.7, -16], halfExtents: [4.35, 0.25, 0.5] },
  ...[18, 30].map(x => ({ position: [x, 0.15, -16], halfExtents: [4.6, 0.15, 1.3] }))
]

const vector = ([x, y, z]) => ({ x, y, z })
const identity = { x: 0, y: 0, z: 0, w: 1 }

export function hingeDescriptor(rapier) {
  return rapier.JointData.revolute(vector(HINGE.anchor), vector(HINGE.localAnchor), vector(HINGE.axis))
}

export function liftDescriptor(rapier) {
  return rapier.JointData.prismatic(vector(LIFT.anchor), vector(LIFT.localAnchor), vector(LIFT.axis))
}

export function configureRigJoints(rapier, hingeJoint, liftJoint) {
  hingeJoint.setLimits(-HINGE.limit, HINGE.limit)
  liftJoint.setLimits(0, LIFT.travel)
  // Adjacent parts must not fight the joint at their shared attachment.
  // Other bodies, including the drone, still collide with all rig parts.
  hingeJoint.setContactsEnabled(false)
  liftJoint.setContactsEnabled(false)
  liftJoint.configureMotorModel(rapier.MotorModel.AccelerationBased)
  liftJoint.configureMotorPosition(0, 120, 22)
}

export function resetRigBodies(hingeBody, liftBody) {
  for (const [body, spec] of [[hingeBody, HINGE], [liftBody, LIFT]]) {
    body.setEnabled(true)
    body.setTranslation(vector(spec.position), true)
    body.setRotation(identity, true)
    body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    body.resetForces(true)
    body.resetTorques(true)
  }
}

export function kickHinge(body) {
  // A bounded impulse starts a physical swing; there is no scripted rotation.
  if (Math.abs(body.angvel().x) < 2) body.applyTorqueImpulse({ x: 80, y: 0, z: 0 }, true)
}

export function driveLift(joint, body, open) {
  joint.configureMotorPosition(open ? LIFT.travel : 0, 120, 22)
  body.wakeUp()
}

export function measureRig(hingeBody, liftBody) {
  const q = hingeBody.rotation()
  const angle = Math.atan2(2 * (q.w * q.x + q.y * q.z), 1 - 2 * (q.x * q.x + q.y * q.y))
  const anchor = new Vector3(...HINGE.localAnchor).applyQuaternion(new Quaternion().copy(q))
    .add(hingeBody.translation())
  const slider = liftBody.translation()
  return {
    hingeAngle: angle * 180 / Math.PI,
    liftTravel: slider.y - LIFT.position[1],
    anchorError: anchor.distanceTo(new Vector3(...HINGE.anchor)),
    lateralError: Math.hypot(slider.x - LIFT.position[0], slider.z - LIFT.position[2])
  }
}

// Headless construction uses the same dimensions, masses, descriptors and
// constraints as the React scene. No browser is needed to test the mechanics.
export function createArticulatedRig(rapier, world) {
  const frame = world.createRigidBody(rapier.RigidBodyDesc.fixed())
  frame.userData = { surface: 'rig-frame' }
  for (const part of FRAME_PARTS) {
    world.createCollider(rapier.ColliderDesc.cuboid(...part.halfExtents)
      .setTranslation(...part.position).setFriction(0.7).setRestitution(0.05), frame)
  }
  const makePanel = spec => {
    const body = world.createRigidBody(rapier.RigidBodyDesc.dynamic()
      .setTranslation(...spec.position).setCcdEnabled(true).setCanSleep(false)
      .setAngularDamping(0.6).setLinearDamping(0.15))
    body.userData = { surface: 'moving-gate' }
    world.createCollider(rapier.ColliderDesc.cuboid(...spec.halfExtents)
      .setMass(spec.mass).setFriction(0.6).setRestitution(0.05), body)
    return body
  }
  const hinge = makePanel(HINGE), lift = makePanel(LIFT)
  const hingeJoint = world.createImpulseJoint(hingeDescriptor(rapier), frame, hinge, true)
  const liftJoint = world.createImpulseJoint(liftDescriptor(rapier), frame, lift, true)
  configureRigJoints(rapier, hingeJoint, liftJoint)
  return {
    frame, hinge, lift, hingeJoint, liftJoint,
    reset() {
      resetRigBodies(hinge, lift)
      configureRigJoints(rapier, hingeJoint, liftJoint)
    },
    dispose() {
      world.removeImpulseJoint(hingeJoint, true)
      world.removeImpulseJoint(liftJoint, true)
      world.removeRigidBody(hinge)
      world.removeRigidBody(lift)
      world.removeRigidBody(frame)
    }
  }
}
