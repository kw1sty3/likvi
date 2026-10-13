import React, { memo, useEffect, useState } from 'react'
import { useSimulatorStore } from '../store/useSimulatorStore'

const formatTime = (ms) => {
  const totalSeconds = ms / 1000
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const hundredths = Math.floor((totalSeconds % 1) * 100)

  return `${minutes}:${seconds.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`
}

const statusLabels = {
  offline: 'Оффлайн',
  searching: 'Поиск',
  checking: 'Проверка',
  ready: 'Готов',
  disconnected: 'Отключен'
}

const matchmakingLabels = {
  idle: 'Не запущен',
  searching: 'Поиск соперника',
  checking: 'Проверка соединения',
  stub: 'Сервер не подключен'
}

export const NotificationCenter = memo(function NotificationCenter() {
  const notifications = useSimulatorStore((state) => state.notifications)
  const removeNotification = useSimulatorStore((state) => state.removeNotification)

  useEffect(() => {
    if (notifications.length === 0) return undefined

    const timers = notifications.map((notice) =>
      window.setTimeout(() => removeNotification(notice.id), 4500)
    )

    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [notifications, removeNotification])

  if (notifications.length === 0) return null

  return (
    <div className="notification-stack">
      {notifications.map((notice) => (
        <div className={`notification-item ${notice.type}`} key={notice.id}>
          {notice.message}
        </div>
      ))}
    </div>
  )
})

export function AuthModal() {
  const authModal = useSimulatorStore((state) => state.authModal)
  const closeAuthModal = useSimulatorStore((state) => state.closeAuthModal)

  if (!authModal) return null

  const title = authModal === 'login' ? 'Вход' : 'Регистрация'

  return (
    <div className="olympiad-modal-backdrop">
      <div className="olympiad-modal">
        <div className="olympiad-modal-header">
          <h2>{title}</h2>
          <button type="button" onClick={closeAuthModal}>Закрыть</button>
        </div>
        <p>Заглушка. Подключение реальных пользователей и базы данных будет добавлено позже.</p>
        <div className="placeholder-form">
          <input disabled placeholder="Логин" />
          <input disabled placeholder="Пароль" type="password" />
          <button type="button" disabled>{title}</button>
        </div>
      </div>
    </div>
  )
}

const Leaderboard = memo(function Leaderboard() {
  const leaderboard = useSimulatorStore((state) => state.leaderboard)

  return (
    <section className="dashboard-card leaderboard-card">
      <div className="leaderboard-header">
        <div>
          <span className="card-label">Локальные тренировочные результаты</span>
          <h2>Топ 100</h2>
        </div>
        <span className="leaderboard-count">{leaderboard.length}/100</span>
      </div>

      {leaderboard.length === 0 ? (
        <p className="empty-leaderboard">Пока нет результатов. Первый заезд появится здесь после финиша.</p>
      ) : (
        <ol className="leaderboard-list">
          {leaderboard.map((item, index) => (
            <li key={item.id}>
              <span>{index + 1}</span>
              <strong>{item.player}</strong>
              <em>{item.score ?? 0} оч. · {formatTime(item.timeMs)}</em>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
})

function ServerLeaderboard() {
  const [results, setResults] = useState(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/physics/results', { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Unavailable'); return response.json() })
      .then(data => setResults(data.results))
      .catch(reason => { if (reason.name !== 'AbortError') setError(true) })
    return () => controller.abort()
  }, [])
  return <section className="dashboard-card leaderboard-card">
    <span className="card-label">Подтверждены сервером</span>
    <h2>Серверные результаты</h2>
    {error ? <p>Сервер результатов сейчас недоступен.</p> : !results ? <p>Загрузка…</p> : !results.length ?
      <p>Пока нет завершённых серверных заездов.</p> : <ol className="leaderboard-list">
        {results.map((item, index) => <li key={item.id}><span>{index + 1}</span><strong>{item.player}</strong>
          <em>{item.score} оч. · {formatTime(item.timeMs)}</em></li>)}
      </ol>}
  </section>
}

const TournamentBracket = memo(function TournamentBracket() {
  const bracketRounds = useSimulatorStore((state) => state.bracketRounds)

  return (
    <section className="dashboard-card bracket-card">
      <span className="card-label">Турнирная сетка</span>
      <h2>Квалификация</h2>
      <div className="bracket-grid">
        {bracketRounds.map((round) => (
          <div className="bracket-round" key={round.id}>
            <h3>{round.title}</h3>
            {round.matches.map((match) => (
              <div className={`bracket-match ${match.status}`} key={match.id}>
                <span>{match.top}</span>
                <span>{match.bottom}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
})

const TournamentEvents = memo(function TournamentEvents() {
  const events = useSimulatorStore((state) => state.tournamentEvents)

  return (
    <section className="dashboard-card events-card">
      <span className="card-label">Турнирные события</span>
      <h2>Журнал</h2>
      {events.length === 0 ? (
        <p className="empty-leaderboard">Событий пока нет. Здесь появятся старт, чекпоинты, финиш и сетевые статусы.</p>
      ) : (
        <ul className="event-list">
          {events.map((event) => (
            <li key={event.id}>
              <span>{event.type}</span>
              <p>{event.message}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
})

const TournamentSignup = memo(function TournamentSignup() {
  const tournamentCatalog = useSimulatorStore((state) => state.tournamentCatalog)
  const currentTournamentId = useSimulatorStore((state) => state.currentTournamentId)
  const tournamentEnrollment = useSimulatorStore((state) => state.tournamentEnrollment)
  const tournamentDraft = useSimulatorStore((state) => state.tournamentDraft)
  const tournamentFilters = useSimulatorStore((state) => state.tournamentFilters)
  const updateTournamentDraft = useSimulatorStore((state) => state.updateTournamentDraft)
  const updateTournamentFilters = useSimulatorStore((state) => state.updateTournamentFilters)
  const selectTournament = useSimulatorStore((state) => state.selectTournament)
  const createTournament = useSimulatorStore((state) => state.createTournament)
  const joinTournament = useSimulatorStore((state) => state.joinTournament)
  const leaveTournament = useSimulatorStore((state) => state.leaveTournament)
  const openModeSelect = useSimulatorStore((state) => state.openModeSelect)

  const filteredTournaments = tournamentCatalog.filter((item) => {
    const timeMatches = tournamentFilters.timeLimit === 'any' || item.timeLimit === tournamentFilters.timeLimit || item.timeLimit === 'any'
    const droneMatches = tournamentFilters.droneLimit === 'any' || item.droneLimit === tournamentFilters.droneLimit || item.droneLimit === 'any'
    const mapMatches = tournamentFilters.mapLimit === 'any' || item.mapLimit === tournamentFilters.mapLimit || item.mapLimit === 'any'

    return timeMatches && droneMatches && mapMatches
  })
  const selectedTournament = tournamentCatalog.find((item) => item.id === currentTournamentId) || filteredTournaments[0]
  const selectedTournamentId = selectedTournament?.id || ''

  return (
    <section className="tournament-window">
      <div className="leaderboard-header">
        <div>
          <span className="card-label">Участие в турнире</span>
          <h2>{tournamentEnrollment ? 'Турнир выбран' : 'Выберите или создайте турнир'}</h2>
        </div>
        <span className={`tournament-badge ${tournamentEnrollment ? 'active' : ''}`}>
          {tournamentEnrollment ? 'Активно' : 'Не записан'}
        </span>
      </div>

      <div className="tournament-browser-layout">
        <aside className="tournament-control-panel">
          <div className="tournament-panel-section">
            <span className="card-label">Фильтры</span>
            <label>
              <span>Время</span>
              <select
                value={tournamentFilters.timeLimit}
                onChange={(event) => updateTournamentFilters({ timeLimit: event.target.value })}
              >
                <option value="any">Любое время</option>
                <option value="60">До 1 минуты</option>
                <option value="180">До 3 минут</option>
                <option value="300">До 5 минут</option>
              </select>
            </label>
            <label>
              <span>Дроны</span>
              <select
                value={tournamentFilters.droneLimit}
                onChange={(event) => updateTournamentFilters({ droneLimit: event.target.value })}
              >
                <option value="any">Любые дроны</option>
                <option value="training-drone">Учебный квадрокоптер</option>
              </select>
            </label>
            <label>
              <span>Карты</span>
              <select
                value={tournamentFilters.mapLimit}
                onChange={(event) => updateTournamentFilters({ mapLimit: event.target.value })}
              >
                <option value="any">Любые карты</option>
                <option value="polytech-arena">Арена Московского Политеха</option>
              </select>
            </label>
          </div>

          <div className="tournament-panel-section">
            <span className="card-label">Создать</span>
            <label>
              <span>Название</span>
              <input
                value={tournamentDraft.title}
                onChange={(event) => updateTournamentDraft({ title: event.target.value })}
                placeholder="Название турнира"
              />
            </label>
            <label>
              <span>Ограничение по времени</span>
              <select
                value={tournamentDraft.timeLimit}
                onChange={(event) => updateTournamentDraft({ timeLimit: event.target.value })}
              >
                <option value="any">Любое время</option>
                <option value="60">До 1 минуты</option>
                <option value="180">До 3 минут</option>
                <option value="300">До 5 минут</option>
              </select>
            </label>
            <label>
              <span>Дроны</span>
              <select
                value={tournamentDraft.droneLimit}
                onChange={(event) => updateTournamentDraft({ droneLimit: event.target.value })}
              >
                <option value="any">Любые дроны</option>
                <option value="training-drone">Учебный квадрокоптер</option>
              </select>
            </label>
            <label>
              <span>Карты</span>
              <select
                value={tournamentDraft.mapLimit}
                onChange={(event) => updateTournamentDraft({ mapLimit: event.target.value })}
              >
                <option value="any">Любые карты</option>
                <option value="polytech-arena">Арена Московского Политеха</option>
              </select>
            </label>
            <button type="button" className="primary-action" onClick={createTournament}>Создать турнир</button>
          </div>
        </aside>

        <div className="tournament-list-panel">
          {filteredTournaments.length === 0 ? (
            <div className="tournament-empty-state">
              <h3>Турниров пока нет</h3>
              <p>Создайте первый турнир или измените фильтры. Список не содержит фейковых записей.</p>
            </div>
          ) : (
            <div className="tournament-card-list">
              {filteredTournaments.map((item) => (
                <button
                  type="button"
                  className={item.id === selectedTournamentId ? 'tournament-card selected' : 'tournament-card'}
                  key={item.id}
                  onClick={() => selectTournament(item.id)}
                >
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.participants.length} участник(ов)</span>
                  </div>
                  <dl>
                    <div>
                      <dt>Время</dt>
                      <dd>{item.timeLimit === 'any' ? 'Любое' : `До ${item.timeLimit} сек.`}</dd>
                    </div>
                    <div>
                      <dt>Дроны</dt>
                      <dd>{item.droneLimit === 'any' ? 'Любые' : 'Учебный'}</dd>
                    </div>
                    <div>
                      <dt>Карта</dt>
                      <dd>{item.mapLimit === 'any' ? 'Любая' : 'Арена'}</dd>
                    </div>
                  </dl>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="tournament-create-grid">
        <button
          type="button"
          className="primary-action"
          onClick={() => joinTournament(selectedTournamentId)}
          disabled={!selectedTournamentId || Boolean(tournamentEnrollment)}
        >
          Записаться
        </button>
        <button type="button" onClick={leaveTournament} disabled={!tournamentEnrollment}>
          Отменить запись
        </button>
        <button type="button" onClick={() => openModeSelect('tournaments')} disabled={!tournamentEnrollment}>
          Продолжить
        </button>
      </div>
    </section>
  )
})

export function HomeScreen() {
  const openAuthModal = useSimulatorStore((state) => state.openAuthModal)
  const openTournamentBrowser = useSimulatorStore((state) => state.openTournamentBrowser)
  const openModeSelect = useSimulatorStore((state) => state.openModeSelect)

  return (
    <div className="olympiad-shell">
      <header className="olympiad-topbar">
        <div>
          <p className="eyebrow">Likvi</p>
          <h1>Виртуальная олимпиада</h1>
        </div>
        <div className="auth-actions">
          <button type="button" onClick={() => openAuthModal('login')}>Вход</button>
          <button type="button" onClick={() => openAuthModal('register')}>Регистрация</button>
        </div>
      </header>

      <main className="dashboard-grid">
        <section className="dashboard-card selection-card">
          <span className="card-label">Выбранный дрон</span>
          <h2>Учебный квадрокоптер</h2>
          <p>Единственная доступная модель для текущего прототипа.</p>
          <button type="button" disabled>Выбран</button>
        </section>

        <section className="dashboard-card selection-card">
          <span className="card-label">Выбранная карта</span>
          <h2>Арена Московского Политеха</h2>
          <p>Маршрут с последовательными контрольными кольцами.</p>
          <button type="button" disabled>Выбрана</button>
        </section>

        <section className="dashboard-card competition-card">
          <span className="card-label">Соревнование</span>
          <h2>Турниры</h2>
          <p>Отдельный раздел для создания турниров, записи участников, фильтрации и турнирной сетки.</p>
          <button type="button" className="primary-action" onClick={openTournamentBrowser}>
            Открыть турниры
          </button>
        </section>

        <section className="dashboard-card modes-card">
          <span className="card-label">Режимы</span>
          <h2>Полет и матчмейкинг</h2>
          <p>Старое окно запуска: одиночный полет и соревновательный матчмейкинг.</p>
          <button type="button" className="primary-action" onClick={() => openModeSelect('home')}>
            Открыть режимы
          </button>
        </section>

        <Leaderboard />
        <ServerLeaderboard />
      </main>

      <AuthModal />
      <NotificationCenter />
    </div>
  )
}

export function TournamentBrowserScreen() {
  const returnHome = useSimulatorStore((state) => state.returnHome)
  const tournamentCatalog = useSimulatorStore((state) => state.tournamentCatalog)
  const hasTournament = tournamentCatalog.length > 0

  return (
    <div className="olympiad-shell tournament-browser-shell">
      <header className="olympiad-topbar">
        <div>
          <p className="eyebrow">Турниры</p>
          <h1>Выбор соревнования</h1>
        </div>
        <button type="button" onClick={returnHome}>На главную</button>
      </header>
      <main className="tournament-browser-main">
        <TournamentSignup />
        {hasTournament && (
          <>
            <TournamentBracket />
            <TournamentEvents />
          </>
        )}
      </main>
      <NotificationCenter />
    </div>
  )
}

const MatchmakingPanel = memo(function MatchmakingPanel() {
  const matchmakingStatus = useSimulatorStore((state) => state.matchmakingStatus)
  const opponentStatus = useSimulatorStore((state) => state.opponentStatus)
  const startMatchmaking = useSimulatorStore((state) => state.startMatchmaking)
  const cancelMatchmaking = useSimulatorStore((state) => state.cancelMatchmaking)
  const setMatchmakingStatus = useSimulatorStore((state) => state.setMatchmakingStatus)
  const setOpponentStatus = useSimulatorStore((state) => state.setOpponentStatus)
  const completeMatchmakingStub = useSimulatorStore((state) => state.completeMatchmakingStub)
  const pushNotification = useSimulatorStore((state) => state.pushNotification)

  useEffect(() => {
    if (matchmakingStatus !== 'searching') return undefined

    const checkingTimer = window.setTimeout(() => {
      setMatchmakingStatus('checking')
      setOpponentStatus('checking')
      pushNotification('network', 'Проверка готовности сетевого матча.')
    }, 1600)

    return () => window.clearTimeout(checkingTimer)
  }, [matchmakingStatus, pushNotification, setMatchmakingStatus, setOpponentStatus])

  useEffect(() => {
    if (matchmakingStatus !== 'checking') return undefined

    const stubTimer = window.setTimeout(() => {
      completeMatchmakingStub()
    }, 1900)

    return () => window.clearTimeout(stubTimer)
  }, [completeMatchmakingStub, matchmakingStatus])

  const isSearching = matchmakingStatus === 'searching' || matchmakingStatus === 'checking'

  return (
    <section className="mode-card matchmaking-card">
      <span className="card-label">Соревновательная игра</span>
      <h2>Матчмейкинг</h2>
      <p>Интерфейс готов к сетевому серверу: статусы, события и проверки уже проходят через Zustand.</p>

      <div className="matchmaking-status-grid">
        <div>
          <span>Матчмейкинг</span>
          <strong>{matchmakingLabels[matchmakingStatus]}</strong>
        </div>
        <div>
          <span>Соперник</span>
          <strong>{statusLabels[opponentStatus]}</strong>
        </div>
      </div>

      <div className="matchmaking-actions">
        <button type="button" className="primary-action" onClick={startMatchmaking} disabled={isSearching}>
          Найти матч
        </button>
        <button type="button" onClick={cancelMatchmaking} disabled={matchmakingStatus === 'idle'}>
          Остановить
        </button>
      </div>
    </section>
  )
})

export function ModeSelectScreen() {
  const backFromModeSelect = useSimulatorStore((state) => state.backFromModeSelect)
  const startFreeFlight = useSimulatorStore((state) => state.startFreeFlight)
  const startCountdown = useSimulatorStore((state) => state.startCountdown)
  const startJointDemo = useSimulatorStore((state) => state.startJointDemo)
  const startServerRace = useSimulatorStore((state) => state.startServerRace)

  return (
    <div className="olympiad-shell mode-shell">
      <header className="olympiad-topbar">
        <div>
          <p className="eyebrow">Окно соревнования</p>
          <h1>Выбор режима</h1>
        </div>
        <button type="button" onClick={backFromModeSelect}>Назад</button>
      </header>

      <main className="mode-grid">
        <section className="mode-card free-flight-card">
          <span className="card-label">Без соревнования</span>
          <h2>Свободный полет</h2>
          <p>Обычный режим для тренировки управления дроном без колец, таймера, очков и турнирных условий.</p>
          <button type="button" className="primary-action" onClick={startFreeFlight}>
            Полетать
          </button>
          <button type="button" onClick={startJointDemo}>Испытать подвижные ворота</button>
        </section>

        <section className="mode-card">
          <span className="card-label">Локальная тренировка</span>
          <h2>Одиночный полет</h2>
          <p>Маршрут на время: зеленые кольца появляются по очереди, золотое кольцо завершает попытку.</p>
          <button type="button" className="primary-action" onClick={startCountdown}>
            Запустить
          </button>
        </section>

        <section className="mode-card">
          <span className="card-label">Серверная проверка</span>
          <h2>Зачётный заезд</h2>
          <p>Сервер рассчитывает движение, столкновения, кольца и время. Подтверждённый результат сохраняется отдельно от тренировок.</p>
          <button type="button" className="primary-action" onClick={startServerRace}>Запустить серверный заезд</button>
        </section>
        <MatchmakingPanel />
      </main>

      <NotificationCenter />
    </div>
  )
}

export const FlightOverlay = memo(function FlightOverlay() {
  const competitionMode = useSimulatorStore((state) => state.competitionMode)
  const competitionStatus = useSimulatorStore((state) => state.competitionStatus)
  const countdown = useSimulatorStore((state) => state.countdown)
  const flightRevision = useSimulatorStore((state) => state.flightRevision)
  const raceElapsedMs = useSimulatorStore((state) => state.raceElapsedMs)
  const activeRingIndex = useSimulatorStore((state) => state.activeRingIndex)
  const rings = useSimulatorStore((state) => state.rings)
  const lastResult = useSimulatorStore((state) => state.lastResult)
  const returnHome = useSimulatorStore((state) => state.returnHome)
  const completeResultView = useSimulatorStore((state) => state.completeResultView)

  useEffect(() => {
    if (competitionMode === 'server' || competitionStatus !== 'countdown') return undefined

    const startTime = Date.now()
    const interval = window.setInterval(() => {
      const remaining = Math.max(0, 5 - Math.floor((Date.now() - startTime) / 1000))
      useSimulatorStore.getState().setCountdown(remaining)

      if (remaining === 0) {
        window.clearInterval(interval)
        useSimulatorStore.getState().startRaceRun()
      }
    }, 200)

    return () => window.clearInterval(interval)
  }, [competitionMode, competitionStatus, flightRevision])

  useEffect(() => {
    if (competitionMode === 'server' || competitionStatus !== 'running') return undefined

    const interval = window.setInterval(() => {
      useSimulatorStore.getState().updateRaceElapsed()
    }, 100)

    return () => window.clearInterval(interval)
  }, [competitionMode, competitionStatus])

  useEffect(() => {
    if (competitionStatus !== 'finished') return undefined

    const timeout = window.setTimeout(() => {
      completeResultView()
    }, 10000)

    return () => window.clearTimeout(timeout)
  }, [competitionStatus, completeResultView])

  if (competitionMode === 'free') {
    return (
      <>
        <div className="free-flight-actions">
          <button type="button" onClick={returnHome}>В главное окно</button>
        </div>
        <NotificationCenter />
      </>
    )
  }

  return (
    <>
      <div className="flight-competition-hud">
        <button type="button" onClick={returnHome}>В главное окно</button>
        <div>
          <span>Время</span>
          <strong>{formatTime(raceElapsedMs)}</strong>
        </div>
        <div>
          <span>Кольцо</span>
          <strong>{Math.min(activeRingIndex + 1, rings.length)} / {rings.length}</strong>
        </div>
        <div>
          <span>Очки</span>
          <strong>{lastResult?.score ?? 0}</strong>
        </div>
      </div>

      {competitionStatus === 'countdown' && (
        <div className="countdown-overlay">
          <span>Подготовка</span>
          <strong>{countdown}</strong>
        </div>
      )}

      {competitionMode !== 'server' && competitionStatus === 'running' && (
        <div className="ring-hint">
          {rings[activeRingIndex]?.finish ? 'Финишное золотое кольцо' : 'Пролетите зеленое кольцо'}
        </div>
      )}

      {competitionStatus === 'finished' && (
        <div className="result-overlay">
          <span>{competitionMode === 'server' ? 'Финиш подтверждён сервером' : 'Финиш'}</span>
          <strong>{formatTime(raceElapsedMs)}</strong>
          <p>Начислено {lastResult?.score ?? 0} очков. Возврат в главное окно через 10 секунд.</p>
        </div>
      )}

      <NotificationCenter />
    </>
  )
})
