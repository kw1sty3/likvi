import React, { memo } from 'react'
import { useSimulatorStore } from '../store/useSimulatorStore'
import { FPV_TRACKS, getTrack, trackLength } from '../physics/fpvTracks'
import './FpvRacing.css'

export function formatRaceTime(ms) {
  if (!Number.isFinite(ms)) return '—'
  const minutes = Math.floor(ms / 60000)
  return `${minutes}:${(Math.floor(ms / 1000) % 60).toString().padStart(2, '0')}.${Math.floor(ms % 1000 / 10).toString().padStart(2, '0')}`
}

const StaticPlan = memo(function StaticPlan({ track }) {
  const [left, right, top, bottom] = track.bounds
  const width = right - left, height = bottom - top
  const points = [...track.gates, track.gates[0]].map(gate => `${gate.position.x},${gate.position.z}`).join(' ')
  return <>
    <rect x={left} y={top} width={width} height={height} fill="#12232c" />
    {Array.from({ length: 9 }, (_, i) => <line key={i} x1={left} x2={right} y1={top + i * height / 8} y2={top + i * height / 8} stroke="#20363f" strokeWidth="0.5" />)}
    {track.parts.filter(part => part.shape === 'box' && part.collidable !== false && part.size[0] > 2 && part.size[2] > 2).map((part, i) =>
      <rect key={i} x={part.position[0] - part.size[0] / 2} y={part.position[2] - part.size[2] / 2}
        width={part.size[0]} height={part.size[2]} fill={part.color} opacity="0.3"
        transform={`rotate(${-((part.rotation?.[1] || 0) * 180 / Math.PI)} ${part.position[0]} ${part.position[2]})`} />)}
    <polyline points={points} fill="none" stroke={track.accent} opacity="0.75" strokeWidth="1.5" strokeDasharray="3 2" />
    <circle cx={track.spawn.x} cy={track.spawn.z} r="5.5" fill="none" stroke="#eefbf4" strokeWidth="1" />
  </>
})

export const TrackPlan = memo(function TrackPlan({ track, gps, activeIndex = -1, rotation = 0 }) {
  const [left, right, top, bottom] = track.bounds
  return <svg className="track-plan" viewBox={`${left} ${top} ${right - left} ${bottom - top}`} role="img" aria-label={`Схема трассы ${track.name}`}>
    <StaticPlan track={track} />
    {track.gates.map((gate, index) => <g key={gate.id}>
      <circle cx={gate.position.x} cy={gate.position.z} r={index === activeIndex ? 4.8 : 2.5}
        fill={index === activeIndex ? '#fff1a8' : track.accent} stroke="#12232c" strokeWidth="1" />
    </g>)}
    {gps && <g transform={`translate(${Math.max(left + 3, Math.min(right - 3, gps.x))} ${Math.max(top + 3, Math.min(bottom - 3, gps.z))}) rotate(${-rotation * 180 / Math.PI})`}>
      <path d="M 0 -5 L 3.8 4 L 0 2 L -3.8 4 Z" fill="white" stroke="#162d35" strokeWidth="1" />
    </g>}
  </svg>
})

export default function TrackPicker() {
  const selectedId = useSimulatorStore(state => state.selectedMapId)
  const selectMap = useSimulatorStore(state => state.selectMap)
  const laps = useSimulatorStore(state => state.raceLaps)
  const setLaps = useSimulatorStore(state => state.setRaceLaps)
  const records = useSimulatorStore(state => state.fpvRecords)
  const startRace = useSimulatorStore(state => state.startCountdown)
  const startFree = useSimulatorStore(state => state.startFreeFlight)
  const startDemo = useSimulatorStore(state => state.startDemo)
  const selected = getTrack(selectedId)
  return <section className="track-picker" aria-label="Карты для FPV-гонок">
    <div className="track-picker-heading">
      <div><span className="card-label">FPV RACING / ВЫБОР ЛОКАЦИИ</span><h2>Новая трасса. Новый круг.</h2></div>
      <span className="track-local-badge">Одиночные заезды · локальные рекорды</span>
    </div>
    <div className="track-cards">
      {FPV_TRACKS.map((track, index) => {
        const best = records.filter(item => item.trackId === track.id && item.laps === laps)
          .reduce((time, item) => Math.min(time, item.timeMs), Infinity)
        return <button type="button" className={`track-card ${selectedId === track.id ? 'selected' : ''}`}
          style={{ '--track-accent': track.accent }} key={track.id} onClick={() => selectMap(track.id)} aria-pressed={selectedId === track.id}>
          <div className="track-card-visual"><TrackPlan track={track} /><span className="track-card-number">0{index + 1}</span>
            <span className="track-card-difficulty">{track.difficulty}</span></div>
          <div className="track-card-body"><span className="track-subtitle">{track.subtitle}</span><h3>{track.name}</h3>
            <p>{track.description}</p><div className="track-tags">{track.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
            <div className="track-card-meta"><span>{track.gates.length} ворот · {trackLength(track)} м / круг</span><strong>{formatRaceTime(best)}</strong></div>
          </div>
          <span className="track-selected-mark">{selectedId === track.id ? '● Выбрана' : 'Выбрать трассу →'}</span>
        </button>
      })}
    </div>
    <div className="track-launch">
      <div><strong>{selected.name}</strong><p>Зелёные ворота — цель, янтарные — следующие. Пролетайте по порядку.</p></div>
      <label>Круги<select aria-label="Количество кругов" value={laps} onChange={event => setLaps(event.target.value)} disabled={selectedId === 'polytech-arena'}>
        <option value={1}>1 круг</option><option value={3}>3 круга</option><option value={5}>5 кругов</option>
      </select></label>
      <button type="button" className="track-free-button" onClick={startFree}>Свободный полёт</button>
      {selectedId !== 'polytech-arena' && <button type="button" className="track-demo-button" onClick={startDemo}>▶ Демо-прохождение</button>}
      <button type="button" className="track-start-button" onClick={startRace}>Начать гонку ↗</button>
    </div>
    {selectedId !== 'polytech-arena' && <p className="track-demo-description">Демо покажет один полный круг. Наблюдайте за маршрутом и приборами, переключайте камеру или возьмите управление.</p>}
    <div className="track-picker-footer"><span>WASD — наклон · Q/E — газ · ← → — поворот · Пробел — тормоз · H — газ зависания · V — камера · R — рестарт</span>
      <button type="button" onClick={() => selectMap('polytech-arena')} aria-pressed={selectedId === 'polytech-arena'}>Классическая арена{selectedId === 'polytech-arena' ? ' ✓' : ' →'}</button></div>
  </section>
}
