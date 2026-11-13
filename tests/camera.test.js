import test from 'node:test'
import assert from 'node:assert/strict'
import { Euler, Group, PerspectiveCamera, Quaternion, Vector3 } from 'three'
import { OrbitControls } from 'three-stdlib'
import { createDroneCamera } from '../src/camera/droneCamera.js'

const close = (actual, expected) => assert.ok(actual.distanceTo(expected) < 1e-8,
  `Expected ${actual.toArray()} to match ${expected.toArray()}`)

test('Shift tracking stays anchored to the rendered drone at 30, 60 and 120 FPS', () => {
  for (const fps of [30, 60, 120]) {
    const update = createDroneCamera(), camera = new PerspectiveCamera(), drone = new Group()
    const projected = new Vector3()
    let firstProjection
    for (let frame = 0; frame <= fps * 2; frame++) {
      const time = frame / fps
      drone.position.set(25 * time, 8 + 12 * time, -35 * time)
      drone.rotation.set(0.3 * Math.sin(time), time, 0.4 * Math.cos(time), 'YXZ')
      update(camera, drone, 'orbit', true)
      const expectedOffset = new Vector3(0, 7, 16).applyAxisAngle(new Vector3(0, 1, 0), time)
      close(camera.position.clone().sub(drone.position), expectedOffset)
      close(camera.up, new Vector3(0, 1, 0))
      camera.updateMatrixWorld()
      projected.copy(drone.position).project(camera)
      firstProjection ??= projected.clone()
      close(projected, firstProjection)
    }
  }
})

test('orbit translates the camera and target together, preserving rotation and zoom', () => {
  const update = createDroneCamera(), camera = new PerspectiveCamera(), drone = new Group()
  camera.position.set(0, 20, 30)
  const controls = new OrbitControls(camera)
  try {
    drone.position.set(0, 8, 0)
    update(camera, drone, 'orbit', false, controls)
    controls.update()
    for (const offset of [new Vector3(0, 12, 30), new Vector3(18, 9, -12), new Vector3(-5, 3, 4)]) {
      camera.position.copy(drone.position).add(offset)
      controls.update()
      for (let frame = 0; frame < 120; frame++) {
        drone.position.add(new Vector3(0.5, 0.1, -0.3))
        update(camera, drone, 'orbit', false, controls)
        controls.update()
        close(controls.target, drone.position)
        close(camera.position.clone().sub(drone.position), offset)
      }
    }
  } finally { controls.dispose() }
})

test('releasing Shift keeps the latest view instead of jumping to the old orbit target', () => {
  const update = createDroneCamera(), camera = new PerspectiveCamera(), drone = new Group()
  camera.position.set(0, 20, 30)
  const controls = new OrbitControls(camera)
  try {
    update(camera, drone, 'orbit', false, controls)
    drone.position.set(110, 35, -90)
    drone.rotation.y = 2
    update(camera, drone, 'orbit', true, controls)
    const offset = camera.position.clone().sub(controls.target)
    update(camera, drone, 'orbit', false, controls)
    controls.update()
    close(controls.target, drone.position)
    close(camera.position.clone().sub(drone.position), offset)
  } finally { controls.dispose() }
})

test('follow and FPS read world transforms, including an interpolated parent', () => {
  const update = createDroneCamera(), camera = new PerspectiveCamera()
  const body = new Group(), anchor = new Group()
  body.add(anchor)
  for (let frame = 0; frame < 100; frame++) {
    body.position.set(frame * 0.45, 10 + frame * 0.2, -frame * 0.7)
    body.quaternion.setFromEuler(new Euler(0.2, frame * 0.03, -0.1, 'YXZ'))
    update(camera, anchor, 'follow', false)
    close(camera.position, body.position.clone().add(new Vector3(0, 12, 25)))
    update(camera, anchor, 'fps', false)
    close(camera.position, body.position.clone().add(new Vector3(0, 0.3, 0)))
    assert.ok(camera.quaternion.angleTo(body.quaternion) < 1e-7)
  }
})

test('free camera stays stationary and missing anchors are harmless', () => {
  const update = createDroneCamera(), camera = new PerspectiveCamera(), drone = new Group()
  camera.position.set(20, 30, 40)
  camera.quaternion.setFromEuler(new Euler(0.3, 0.5, 0.1))
  const position = camera.position.clone(), orientation = new Quaternion().copy(camera.quaternion)
  drone.position.set(110, 35, -90)
  update(camera, drone, 'free', false)
  update(camera, null, 'orbit', true)
  close(camera.position, position)
  assert.ok(camera.quaternion.angleTo(orientation) < 1e-7)
})

test('assisted FPV keeps the course visible in a 60-degree bank and stays aligned with the rendered drone', () => {
  for (const fps of [30, 60, 120]) {
    const update = createDroneCamera({ stabilizeFpv: true }), camera = new PerspectiveCamera(), drone = new Group()
    for (let frame = 0; frame <= fps; frame++) {
      const pitch = -Math.PI / 3 * frame / fps
      drone.position.set(12, 6, -frame)
      drone.rotation.set(pitch, 0.7, 0, 'YXZ')
      update(camera, drone, 'fps', false)
      const actual = new Euler().setFromQuaternion(camera.quaternion, 'YXZ')
      close(camera.position, drone.position.clone().add(new Vector3(0, 0.3, 0)))
      assert.ok(Math.abs(actual.x) <= 0.41, 'camera must not point sixty degrees into the ground')
      assert.ok(Math.abs(actual.y - 0.7) < 1e-8)
    }
  }
})
