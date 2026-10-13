import React from 'react'
import { useSimulatorStore } from '../store/useSimulatorStore'
import './HUD.css'

function HUD() {
  const {
    altitude,
    speed,
    battery,
    throttle,
    pitch,
    roll,
    yaw,
    gps,
    flightTime,
    maxAltitude,
    distance,
    showHUD
  } = useSimulatorStore()
  
  if (!showHUD) return null
  
  // Форматирование времени
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  
  return (
    <div className="hud">
      {/* Левая панель */}
      <div className="hud-panel left">
        <div className="hud-item">
          <span className="hud-label">Высота</span>
          <span className="hud-value">{Math.round(altitude * 10) / 10} м</span>
        </div>
        <div className="hud-item">
          <span className="hud-label">Скорость</span>
          <span className="hud-value">{Math.round(speed)} км/ч</span>
        </div>
        <div className="hud-item">
          <span className="hud-label">Батарея</span>
          <span className="hud-value">
            <span className={battery > 20 ? 'battery-ok' : 'battery-low'}>
              {Math.round(battery)}%
            </span>
          </span>
        </div>
        <div className="hud-item">
          <span className="hud-label">Газ</span>
          <div className="hud-bar">
            <div 
              className="hud-bar-fill"
              style={{ width: `${throttle * 100}%` }}
            ></div>
          </div>
        </div>
      </div>
      
      {/* Правая панель */}
      <div className="hud-panel right">
        <div className="hud-item">
          <span className="hud-label">Время полета</span>
          <span className="hud-value">{formatTime(flightTime)}</span>
        </div>
        <div className="hud-item">
          <span className="hud-label">Макс. высота</span>
          <span className="hud-value">{Math.round(maxAltitude * 10) / 10} м</span>
        </div>
        <div className="hud-item">
          <span className="hud-label">Дистанция</span>
          <span className="hud-value">{Math.round(distance)} м</span>
        </div>
        <div className="hud-item">
          <span className="hud-label">GPS</span>
          <span className="hud-value">
            {Math.round(gps.x)}, {Math.round(gps.z)}
          </span>
        </div>
      </div>
      
    </div>
  )
}

export default HUD
