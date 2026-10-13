import React, { useState } from 'react'
import { useSimulatorStore } from '../store/useSimulatorStore'
import './SettingsPanel.css'

function SettingsPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const {
    cameraMode,
    showHUD,
    showTrajectory,
    particleEffects,
    soundEnabled,
    physicsDebug,
    setCameraMode,
    toggleHUD,
    toggleTrajectory,
    toggleParticles,
    toggleSound,
    togglePhysicsDebug,
    resetFlight
  } = useSimulatorStore()
  
  if (!isOpen) {
    return (
      <button 
        className="settings-toggle"
        onClick={() => setIsOpen(true)}
      >
        ⚙️
      </button>
    )
  }
  
  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>Настройки</h2>
        <button onClick={() => setIsOpen(false)}>✕</button>
      </div>
      
      <div className="settings-content">
        <div className="setting-group">
          <label>Режим камеры</label>
          <select 
            value={cameraMode}
            onChange={(e) => setCameraMode(e.target.value)}
          >
            <option value="follow">Следящая</option>
            <option value="fps">От первого лица</option>
            <option value="orbit">Орбитальная</option>
            <option value="free">Свободная</option>
          </select>
        </div>
        
        <div className="setting-group">
          <label>
            <input
              type="checkbox"
              checked={showHUD}
              onChange={toggleHUD}
            />
            Показать HUD
          </label>
        </div>
        
        <div className="setting-group">
          <label>
            <input
              type="checkbox"
              checked={showTrajectory}
              onChange={toggleTrajectory}
            />
            Показать траекторию
          </label>
        </div>
        
        <div className="setting-group">
          <label>
            <input
              type="checkbox"
              checked={particleEffects}
              onChange={toggleParticles}
            />
            Эффекты частиц
          </label>
        </div>
        
        <div className="setting-group">
          <label>
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={toggleSound}
            />
            Звук
          </label>
        </div>
        
        <div className="setting-group">
          <label>
            <input type="checkbox" checked={physicsDebug} onChange={togglePhysicsDebug} />
            Показать физические коллайдеры
          </label>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Зависание без наклона: газ около 36%.</div>
        </div>

        <div className="setting-group">
          <button onClick={resetFlight} className="reset-button">
            Сбросить полет
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsPanel
