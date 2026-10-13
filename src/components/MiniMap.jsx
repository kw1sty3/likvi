import React from 'react'
import { useSimulatorStore } from '../store/useSimulatorStore'
import './MiniMap.css'

function MiniMap() {
  const { gps, showHUD } = useSimulatorStore()
  
  if (!showHUD) return null
  
  // Масштаб карты
  const mapScale = 0.1 // 1 единица = 10 метров
  const mapSize = 200 // Размер карты в пикселях
  const quadcopterSize = 8
  
  // Позиция квадрокоптера на карте
  const quadX = (gps.x * mapScale) + mapSize / 2
  const quadZ = (-gps.z * mapScale) + mapSize / 2
  
  // Ограничиваем позицию в пределах карты
  const clampedX = Math.max(0, Math.min(mapSize, quadX))
  const clampedZ = Math.max(0, Math.min(mapSize, quadZ))
  
  return (
    <div className="mini-map">
      <div className="mini-map-header">Карта</div>
      <div className="mini-map-container">
        <svg width={mapSize} height={mapSize} viewBox={`0 0 ${mapSize} ${mapSize}`}>
          {/* Фон карты */}
          <rect width={mapSize} height={mapSize} fill="#2a5a2a" />
          
          {/* Сетка */}
          {Array.from({ length: 10 }).map((_, i) => (
            <React.Fragment key={i}>
              <line
                x1={i * mapSize / 10}
                y1={0}
                x2={i * mapSize / 10}
                y2={mapSize}
                stroke="#3a6a3a"
                strokeWidth={0.5}
              />
              <line
                x1={0}
                y1={i * mapSize / 10}
                x2={mapSize}
                y2={i * mapSize / 10}
                stroke="#3a6a3a"
                strokeWidth={0.5}
              />
            </React.Fragment>
          ))}
          
          {/* Центр (стартовая позиция) */}
          <circle
            cx={mapSize / 2}
            cy={mapSize / 2}
            r={3}
            fill="#4CAF50"
            opacity={0.5}
          />
          
          {/* Квадрокоптер */}
          <circle
            cx={clampedX}
            cy={clampedZ}
            r={quadcopterSize / 2}
            fill="#00ff00"
            stroke="#ffffff"
            strokeWidth={2}
          />
          
          {/* Направление (стрелка) */}
          <line
            x1={clampedX}
            y1={clampedZ}
            x2={clampedX}
            y2={clampedZ - quadcopterSize}
            stroke="#00ff00"
            strokeWidth={2}
            markerEnd="url(#arrowhead)"
          />
          
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="5"
              refY="5"
              orient="auto"
            >
              <polygon points="0 0, 10 5, 0 10" fill="#00ff00" />
            </marker>
          </defs>
        </svg>
        
        {/* Информация */}
        <div className="mini-map-info">
          <div>X: {Math.round(gps.x)}</div>
          <div>Z: {Math.round(gps.z)}</div>
        </div>
      </div>
    </div>
  )
}

export default MiniMap
