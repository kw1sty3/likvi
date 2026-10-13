import React from 'react'
import './ControlsPanel.css'

function ControlsPanel() {
  return (
    <div className="controls-panel">
      <h3>Управление</h3>
      <div className="controls-grid">
        <div className="control-item">
          <span className="control-key">W</span>
          <span className="control-desc">Наклон вперед</span>
        </div>
        <div className="control-item">
          <span className="control-key">S</span>
          <span className="control-desc">Наклон назад</span>
        </div>
        <div className="control-item">
          <span className="control-key">A</span>
          <span className="control-desc">Наклон влево</span>
        </div>
        <div className="control-item">
          <span className="control-key">D</span>
          <span className="control-desc">Наклон вправо</span>
        </div>
        <div className="control-item">
          <span className="control-key">Q</span>
          <span className="control-desc">Увеличить газ</span>
        </div>
        <div className="control-item">
          <span className="control-key">E</span>
          <span className="control-desc">Уменьшить газ</span>
        </div>
        <div className="control-item">
          <span className="control-key">← →</span>
          <span className="control-desc">Поворот</span>
        </div>
        <div className="control-item">
          <span className="control-key">ПКМ</span>
          <span className="control-desc">Камера</span>
        </div>
        <div className="control-item">
          <span className="control-key">Shift</span>
          <span className="control-desc">Фикс. камера</span>
        </div>
        <div className="control-item">
          <span className="control-key">Колесо</span>
          <span className="control-desc">Приближение</span>
        </div>
      </div>
    </div>
  )
}

export default ControlsPanel
