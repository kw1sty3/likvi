import React, { useEffect } from 'react'
import { useSimulatorStore } from '../store/useSimulatorStore'
import { getTrack } from '../physics/fpvTracks'
import { formatRaceTime, TrackPlan } from './TrackPicker'
import FpvInstruments from './FpvInstruments'

export default function FpvRaceHUD() {
  const mapId = useSimulatorStore(state => state.selectedMapId)
  const status = useSimulatorStore(state => state.competitionStatus)
  const mode = useSimulatorStore(state => state.competitionMode)
  const countdown = useSimulatorStore(state => state.countdown)
  const revision = useSimulatorStore(state => state.flightRevision)
  const time = useSimulatorStore(state => state.raceElapsedMs)
  const index = useSimulatorStore(state => state.activeRingIndex)
  const lap = useSimulatorStore(state => state.currentLap)
  const chosenLaps = useSimulatorStore(state => state.raceLaps)
  const lapTimes = useSimulatorStore(state => state.lapTimes)
  const gps = useSimulatorStore(state => state.gps)
  const rotation = useSimulatorStore(state => state.rotation)
  const camera = useSimulatorStore(state => state.cameraMode)
  const guide = useSimulatorStore(state => state.showRaceGuide)
  const records = useSimulatorStore(state => state.fpvRecords)
  const result = useSimulatorStore(state => state.lastResult)
  const reset = useSimulatorStore(state => state.resetFlight)
  const home = useSimulatorStore(state => state.returnHome)
  const toggleGuide = useSimulatorStore(state => state.toggleRaceGuide)
  const setCamera = useSimulatorStore(state => state.setCameraMode)
  const takeOver = useSimulatorStore(state => state.takeOverDemo)
  const startRace = useSimulatorStore(state => state.startCountdown)
  const demo = mode === 'demo'
  const laps = demo ? 1 : chosenLaps
  const track = getTrack(mapId)
  const gate = track.gates[index]
  const free = mode === 'free'
  const distance = gate ? Math.round(Math.hypot(gate.position.x - gps.x, gate.position.y - gps.y, gate.position.z - gps.z)) : 0
  const heading = gate ? Math.atan2(-(gate.position.x - gps.x), -(gate.position.z - gps.z)) - rotation.y : 0
  const bearing = Math.atan2(Math.sin(heading), Math.cos(heading))
  const direction = Math.abs(bearing) > 2.4 ? 'Разворот' : bearing > 0.45 ? 'Левее' : bearing < -0.45 ? 'Правее' : 'Прямо'
  const best = records.filter(item => item.trackId === mapId && item.laps === laps)
    .reduce((value, item) => Math.min(value, item.timeMs), Infinity)

  useEffect(() => {
    if (status !== 'countdown') return
    const start = performance.now()
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, 5 - Math.floor((performance.now() - start) / 1000))
      useSimulatorStore.getState().setCountdown(remaining)
      if (remaining === 0) { window.clearInterval(timer); useSimulatorStore.getState().startRaceRun() }
    }, 100)
    return () => window.clearInterval(timer)
  }, [status, revision])
  useEffect(() => {
    if (status !== 'running') return
    const timer = window.setInterval(() => useSimulatorStore.getState().updateRaceElapsed(), 50)
    return () => window.clearInterval(timer)
  }, [status])
  useEffect(() => {
    const keydown = event => {
      if (event.repeat || event.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return
      if (event.code === 'KeyR') { event.preventDefault(); useSimulatorStore.getState().resetFlight() }
      if (event.code === 'KeyV') {
        event.preventDefault()
        const state = useSimulatorStore.getState()
        state.setCameraMode(state.cameraMode === 'fps' ? 'follow' : 'fps')
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [])

  return <div className={`fpv-hud${demo ? ' is-demo' : ''}`} style={{ '--track-accent': track.accent }}>
    <header className="fpv-topbar"><button type="button" onClick={home}>← Карты <kbd>Esc</kbd></button>
      <div className="fpv-track-title"><span>{demo ? 'DEMO / АВТОПИЛОТ' : free ? 'FREE FLIGHT' : 'TIME ATTACK'}</span><strong>{track.name}</strong></div>
      <button type="button" onClick={reset}>Заново <kbd>R</kbd></button>
    </header>
    {demo && status !== 'finished' && <div className="fpv-demo-banner"><div><strong>▶ Демо-прохождение</strong><span>Бот показывает маршрут. Приборы показывают его команды.</span></div>
      <button type="button" onClick={takeOver}>Взять управление</button></div>}
    {!free && <div className="fpv-race-status"><div><span>КРУГ</span><strong>{lap}<small> / {laps}</small></strong></div>
      <div className="fpv-main-time"><span>ВРЕМЯ ЗАЕЗДА</span><strong>{formatRaceTime(time)}</strong></div>
      <div><span>ВОРОТА</span><strong>{index + 1}<small> / {track.gates.length}</small></strong></div></div>}
    {!free && status === 'running' && <div className="fpv-target"><i style={{ transform: `rotate(${-bearing * 180 / Math.PI}deg)` }}>↑</i><span>{gate.label}</span><strong>{direction} · {distance} м</strong></div>}
    <div className="fpv-reticle" aria-hidden="true"><i /><i /></div>
    <FpvInstruments />
    <aside className="fpv-map"><TrackPlan track={track} gps={gps} activeIndex={free ? -1 : index} rotation={rotation.y} />
      <span>{demo ? 'Учебный круг · без рекорда' : free ? 'Исследуйте трассу' : `Рекорд · ${formatRaceTime(best)}`}</span></aside>
    <footer className="fpv-bottom-bar"><span>WASD наклон · Q/E газ · ←/→ поворот · Пробел тормоз · H газ зависания</span><div>
      <button type="button" onClick={() => setCamera(camera === 'fps' ? 'follow' : 'fps')}>{camera === 'fps' ? 'FPV' : 'Снаружи'} <kbd>V</kbd></button>
      <button type="button" onClick={toggleGuide} aria-pressed={guide}>Маршрут {guide ? '●' : '○'}</button></div></footer>
    {lapTimes.length > 0 && status !== 'finished' && <div className="fpv-last-lap">Последний круг · {formatRaceTime(lapTimes[lapTimes.length - 1])}</div>}
    {status === 'countdown' && <div className="fpv-countdown" aria-live="polite"><span>ПРИГОТОВЬТЕСЬ</span><strong>{countdown}</strong>
      <p>{demo ? <>Бот пролетит все ворота и покажет повороты.<br />V — вид из дрона или внешняя камера.</> : <>Газ для зависания настроен. WASD — наклон, ← → — поворот.<br />Отпустите WASD, чтобы замедлиться. Пробел — сильный тормоз.</>}</p></div>}
    {status === 'finished' && <div className="fpv-finish"><div><span className="card-label">{demo ? 'ДЕМО ЗАВЕРШЕНО' : 'ЗАЕЗД ЗАВЕРШЁН'}</span><h2>{demo ? 'Теперь твоя очередь.' : 'Чистый финиш.'}</h2>
      <strong className="fpv-finish-time">{formatRaceTime(time)}</strong><p>{track.name} · {laps} {laps === 1 ? 'круг' : laps === 5 ? 'кругов' : 'круга'}</p>
      <ol>{lapTimes.map((value, i) => <li key={i}><span>Круг {i + 1}</span><strong>{formatRaceTime(value)}</strong></li>)}</ol>
      <p className="fpv-record-note">{demo ? 'Бот показал полный маршрут. Демо не записывается в рекорды. Попробуйте повторить круг самостоятельно.' : 'Рекорды хранятся в этом браузере отдельно для каждой карты и числа кругов.'}</p>
      {result?.savedLocally === false && <p role="alert">Рекорд не сохранён: браузер запретил доступ к хранилищу.</p>}
      <div className="fpv-finish-actions"><button type="button" onClick={home}>Выбрать карту</button><button type="button" className="track-start-button" onClick={demo ? startRace : reset}>{demo ? 'Попробовать самому' : 'Ещё заезд'}</button></div>
      {demo && <button type="button" className="fpv-replay-demo" onClick={reset}>↻ Посмотреть ещё раз</button>}
    </div></div>}
  </div>
}
