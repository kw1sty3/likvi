import React from 'react'
import { useSimulatorStore } from '../store/useSimulatorStore'
import { FPV_FLIGHT, FPV_HOVER_THROTTLE } from '../physics/dronePhysics'

const percent = value => Math.round(Math.abs(value) * 100)
const degrees = value => Math.round(value * 180 / Math.PI)

function InputAxis({ label, value, negative, positive, keys }) {
  const amount = percent(value)
  return <div className="fpv-input-axis">
    <div><span>{label}</span><strong>{amount < 2 ? '0%' : `${value > 0 ? positive : negative} ${amount}%`}</strong></div>
    <div className="fpv-axis-track"><i style={{ left: `${50 + Math.min(0, value) * 50}%`, width: `${Math.abs(value) * 50}%` }} /><b /></div>
    <span className="fpv-axis-keys">{keys}</span>
  </div>
}

function FpvInstruments() {
  const throttle = useSimulatorStore(state => state.throttle)
  const pitch = useSimulatorStore(state => state.pitch)
  const roll = useSimulatorStore(state => state.roll)
  const yaw = useSimulatorStore(state => state.yaw)
  const brake = useSimulatorStore(state => state.brake)
  const rotation = useSimulatorStore(state => state.rotation)
  const speed = useSimulatorStore(state => state.speed)
  const altitude = useSimulatorStore(state => state.altitude)
  const verticalSpeed = useSimulatorStore(state => state.velocity.y)
  const demo = useSimulatorStore(state => state.competitionMode === 'demo')
  const resetHover = () => useSimulatorStore.getState().setThrottle(FPV_HOVER_THROTTLE)
  return <aside className="fpv-instruments" aria-label="Приборы и сила управления">
    <div className="fpv-flight-readouts">
      <div><strong>{Math.round(speed)}<small> км/ч</small></strong><span>Скорость</span></div>
      <div><strong>{altitude.toFixed(1)}<small> м</small></strong><span>Высота</span></div>
      <div><strong>{verticalSpeed >= 0 ? '↑' : '↓'} {Math.abs(verticalSpeed).toFixed(1)}</strong><span>м/с по высоте</span></div>
    </div>
    <div className="fpv-throttle-instrument" role="meter" aria-label="Газ" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(throttle * 100)}>
      <div className="fpv-throttle-title"><span>ГАЗ <kbd>Q ↑</kbd><kbd>E ↓</kbd></span><strong>{Math.round(throttle * 100)}<small>%</small></strong></div>
      <div className="fpv-throttle-track"><i style={{ width: `${throttle * 100}%` }} /><b style={{ left: `${FPV_HOVER_THROTTLE * 100}%` }} /></div>
      <div className="fpv-throttle-caption"><span>Зависание ≈ {Math.round(FPV_HOVER_THROTTLE * 100)}%</span>
        <button type="button" onClick={resetHover} disabled={demo} title="Установить газ для зависания">{demo ? 'Газ регулирует бот' : <>Выровнять газ <kbd>H</kbd></>}</button></div>
    </div>
    <div className="fpv-control-instruments">
      <div className="fpv-stick" role="img" aria-label={`Команда наклона: ${pitch <= 0 ? 'вперёд' : 'назад'} ${percent(pitch)}%, ${roll >= 0 ? 'влево' : 'вправо'} ${percent(roll)}%`}>
        <svg viewBox="0 0 100 100" aria-hidden="true"><rect x="10" y="10" width="80" height="80" rx="10" fill="#132c37" stroke="#4c6772" />
          <path d="M50 13V87M13 50H87" stroke="#45616b" strokeDasharray="3 3" />
          <circle cx="50" cy="50" r="25" fill="none" stroke="#38535f" />
          <line x1="50" y1="50" x2={50 - roll * 33} y2={50 + pitch * 33} stroke="#a9ef87" strokeWidth="2" />
          <circle cx={50 - roll * 33} cy={50 + pitch * 33} r="6" fill="#b6f794" />
          <text x="50" y="8" textAnchor="middle">W</text><text x="50" y="99" textAnchor="middle">S</text>
          <text x="5" y="53" textAnchor="middle">A</text><text x="96" y="53" textAnchor="middle">D</text></svg>
        <span>НАКЛОН WASD</span>
      </div>
      <div className="fpv-input-axes">
        <InputAxis label="Вперёд / назад" value={pitch} negative="вперёд" positive="назад" keys={`тангаж ${degrees(rotation.x)}°`} />
        <InputAxis label="Влево / вправо" value={-roll} negative="влево" positive="вправо" keys={`крен ${degrees(rotation.z)}°`} />
        <InputAxis label="ПОВОРОТ ← →" value={-yaw} negative="влево" positive="вправо" keys={`до ${Math.round(FPV_FLIGHT.yawRate * 180 / Math.PI)}°/с`} />
      </div>
    </div>
    <div className={`fpv-brake-status ${brake ? 'active' : ''}`}><span>{brake ? '● ТОРМОЖЕНИЕ' : 'Помощь газу в наклоне'}</span><span><kbd>Пробел</kbd> тормоз</span></div>
  </aside>
}

export default React.memo(FpvInstruments)
