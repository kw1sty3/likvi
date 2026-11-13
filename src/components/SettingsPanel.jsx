import React, { useState } from 'react'
import { useSimulatorStore } from '../store/useSimulatorStore'
import { shallow } from 'zustand/shallow'
import './SettingsPanel.css'
import { FPV_HOVER_THROTTLE, HOVER_THROTTLE } from '../physics/dronePhysics'
import { isFpvTrack } from '../physics/fpvTracks'

function SettingsPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const {
    cameraMode,
    selectedMapId,
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
  } = useSimulatorStore(state => ({ cameraMode: state.cameraMode, selectedMapId: state.selectedMapId,
    showHUD: state.showHUD, showTrajectory: state.showTrajectory, particleEffects: state.particleEffects,
    soundEnabled: state.soundEnabled, physicsDebug: state.physicsDebug, setCameraMode: state.setCameraMode,
    toggleHUD: state.toggleHUD, toggleTrajectory: state.toggleTrajectory, toggleParticles: state.toggleParticles,
    toggleSound: state.toggleSound, togglePhysicsDebug: state.togglePhysicsDebug, resetFlight: state.resetFlight }), shallow)
  
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
          <div style={{ fontSize: 12, opacity: 0.7 }}>Газ для зависания: около {Math.round((isFpvTrack(selectedMapId) ? FPV_HOVER_THROTTLE : HOVER_THROTTLE) * 100)}%.
            {isFpvTrack(selectedMapId) && ' H — выставить этот газ; пробел — тормоз. В наклоне включена помощь газу.'}</div>
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
