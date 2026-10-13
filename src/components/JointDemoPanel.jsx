import React from 'react'
import { useSimulatorStore } from '../store/useSimulatorStore'
import './JointDemoPanel.css'

function JointDemoPanel() {
  const enabled = useSimulatorStore(state => state.jointDemoEnabled)
  const isCrash = useSimulatorStore(state => state.isCrash)
  const open = useSimulatorStore(state => state.jointGateOpen)
  const telemetry = useSimulatorStore(state => state.jointTelemetry)
  const swing = useSimulatorStore(state => state.swingJointGate)
  const toggle = useSimulatorStore(state => state.toggleJointLift)
  const reset = useSimulatorStore(state => state.resetFlight)
  const debug = useSimulatorStore(state => state.physicsDebug)
  if (!enabled) return null
  return (
    <section className="joint-demo-panel" aria-label="Испытание подвижных ворот">
      <h2>Подвижные ворота</h2>
      <div className="joint-demo-controls">
        <div>
          <p><span className="joint-orange">Качающаяся створка</span><br />
            <output aria-label="Угол створки">{telemetry.hingeAngle.toFixed(1)}°</output> / предел ±35°
          </p>
          <button type="button" disabled={isCrash} onClick={swing}>Качнуть створку</button>
        </div>
        <div>
          <p><span className="joint-blue">Подъёмные ворота</span><br />
            <output aria-label="Подъём ворот">{telemetry.liftTravel.toFixed(2)} м</output> / ход 4,8 м
          </p>
          <button type="button" disabled={isCrash} aria-pressed={open} onClick={toggle}>
            {open ? 'Опустить ворота' : 'Поднять ворота'}
          </button>
        </div>
      </div>
      <p className="joint-demo-hint">Q/E — газ, WASD — наклон, ←/→ — поворот. Зависание: газ ≈36%. Пролетите под поднятыми воротами.</p>
      {debug && <p className="joint-demo-hint">Отклонение крепления: {(telemetry.anchorError * 100).toFixed(1)} см</p>}
      <button type="button" className="joint-reset" onClick={reset}>Вернуть всё на старт</button>
    </section>
  )
}
export default JointDemoPanel
