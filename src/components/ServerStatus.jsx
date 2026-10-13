import React from 'react'
import { useSimulatorStore } from '../store/useSimulatorStore'
import './ServerStatus.css'

export default function ServerStatus() {
  const mode = useSimulatorStore(state => state.competitionMode)
  const status = useSimulatorStore(state => state.competitionStatus)
  const error = useSimulatorStore(state => state.serverError)
  const reset = useSimulatorStore(state => state.resetFlight)
  const altitude = useSimulatorStore(state => state.altitude)
  const speed = useSimulatorStore(state => state.speed)
  const throttle = useSimulatorStore(state => state.throttle)
  const finishRing = useSimulatorStore(state => state.rings[state.activeRingIndex]?.finish)
  if (mode !== 'server') return null
  return <aside className={`server-status ${error ? 'server-status-error' : ''}`} aria-live="polite">
    <strong>{error ? 'Заезд остановлен' : status === 'connecting' ? 'Подключение к серверу…' : status === 'saving' ? 'Сохранение результата…' : 'Физику и результат проверяет сервер'}</strong>
    <div className="server-telemetry"><span>Высота {altitude.toFixed(1)} м</span><span>Скорость {Math.round(speed)} км/ч</span><span>Газ {Math.round(throttle * 100)}%</span></div>
    {status === 'running' && <p className="server-ring-hint">{finishRing ? 'Пролетите золотое финишное кольцо' : 'Пролетите зелёное кольцо'}</p>}
    {error && <p>{error}</p>}
    {!error && <p>Q/E — газ, WASD — наклон, ←/→ — поворот.<br />Зависание: газ около 36%.</p>}
    <button type="button" onClick={reset}>{error ? 'Подключиться заново' : 'Новая попытка'}</button>
  </aside>
}
