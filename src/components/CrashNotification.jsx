import React from 'react'
import { useSimulatorStore } from '../store/useSimulatorStore'
import './CrashNotification.css'

function CrashNotification() {
  const isCrash = useSimulatorStore(state => state.isCrash)
  const crashInfo = useSimulatorStore(state => state.crashInfo)
  const resetFlight = useSimulatorStore(state => state.resetFlight)
  const competitionMode = useSimulatorStore(state => state.competitionMode)
  if (!isCrash || !crashInfo) return null
  return (
    <div className="crash-notification" role="alert">
      <div className="crash-content">
        <div className="crash-icon">💥</div>
        <h2 className="crash-title">КРУШЕНИЕ!</h2>
        <p className="crash-message">{crashInfo.reason}</p>
        <div className="crash-stats">
          <p>Скорость при ударе: {Math.round(crashInfo.speed)} км/ч</p>
          {['solo', 'server'].includes(competitionMode) && <p>Попытка завершена. Результат не засчитан.</p>}
        </div>
        <button className="crash-reset-button" onClick={resetFlight}>
          Начать заново
        </button>
      </div>
    </div>
  )
}
export default CrashNotification
