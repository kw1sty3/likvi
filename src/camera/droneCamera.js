import { Euler, Quaternion, Vector3 } from 'three'

export function createDroneCamera() {
  const position = new Vector3()
  const orientation = new Quaternion()
  const angles = new Euler(0, 0, 0, 'YXZ')
  const offset = new Vector3()
  const lookTarget = new Vector3()
  const displacement = new Vector3()
  const up = new Vector3(0, 1, 0)
  let previousControls = null
  let ready = false

  return (camera, drone, mode, shiftLocked, controls) => {
    if (!drone) return
    // Read the rendered, interpolated pose rather than throttled HUD telemetry.
    drone.getWorldPosition(position)
    drone.getWorldQuaternion(orientation)
    if (controls && controls !== previousControls) {
      controls.target.copy(ready ? lookTarget : position)
    }
    previousControls = controls
    ready = true

    if (shiftLocked) {
      angles.setFromQuaternion(orientation, 'YXZ')
      offset.set(0, 7, 16).applyAxisAngle(up, angles.y)
      camera.position.copy(position).add(offset)
      lookTarget.copy(position).y += 0.7
      camera.up.copy(up)
      camera.lookAt(lookTarget)
      controls?.target.copy(lookTarget)
      return
    }

    switch (mode) {
      case 'fps':
        camera.position.copy(position).y += 0.3
        camera.quaternion.copy(orientation)
        lookTarget.copy(position)
        break
      case 'follow':
        camera.position.copy(position).add(offset.set(0, 12, 25))
        lookTarget.copy(position)
        lookTarget.y = Math.max(0.5, lookTarget.y)
        camera.up.copy(up)
        camera.lookAt(lookTarget)
        break
      case 'orbit':
        if (controls) {
          // Translate both ends of the orbit; rotation and zoom stay user-controlled.
          displacement.subVectors(position, controls.target)
          camera.position.add(displacement)
          controls.target.copy(position)
        }
        lookTarget.copy(position)
        break
      case 'free':
        if (controls) lookTarget.copy(controls.target)
        break
      default:
        break
    }
  }
}
