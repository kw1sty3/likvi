import { ARENA_VERSION } from '../physics/raceRules.js'

export function createServerFlightClient({ readKeys, onSnapshot, onError, fetchImpl = fetch }) {
  let token = null, seq = 0, stopped = false, timer = null
  async function request(path, method, body, bearer = token) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 1500)
    try {
      const response = await fetchImpl(`/api/physics/${path}`, { method, signal: controller.signal,
        headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}) })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'Сервер физики недоступен. Запустите npm run dev:full.')
      return data
    } finally { clearTimeout(timeout) }
  }
  const release = bearer => request('session', 'DELETE', null, bearer).catch(() => {})
  const accept = snapshot => {
    if (!snapshot || snapshot.protocol !== 1 || snapshot.arenaVersion !== ARENA_VERSION) throw new Error('Несовместимая версия сервера физики.')
    if (!stopped) onSnapshot(snapshot)
  }
  async function poll() {
    if (stopped) return
    const started = Date.now()
    try {
      const pressed = readKeys()
      const snapshot = await request('input', 'POST', { seq: ++seq, keys: Object.keys(pressed).filter(key => pressed[key]) })
      accept(snapshot)
      if (['crashed', 'aborted'].includes(snapshot.status) || snapshot.storageError || (snapshot.status === 'finished' && snapshot.resultStored)) {
        stopped = true
        if (token) void release(token)
        return
      }
      if (!stopped) timer = setTimeout(poll, Math.max(0, 50 - (Date.now() - started)))
    } catch (error) { fail(error) }
  }
  function fail(error) {
    if (stopped) return
    stopped = true
    clearTimeout(timer)
    if (token) void release(token)
    onError(error.name === 'AbortError' ? 'Сервер не отвечает. Начните новый заезд.' :
      error.name === 'TypeError' ? 'Нет связи с сервером. Проверьте подключение и начните новый заезд.' : error.message)
  }
  return {
    async start() {
      try {
        const session = await request('session', 'POST', { protocol: 1, arenaVersion: ARENA_VERSION })
        token = session.token
        if (stopped) { await release(token); return }
        accept(session.snapshot)
        await poll()
      } catch (error) { fail(error) }
    },
    stop() {
      stopped = true
      clearTimeout(timer)
      if (token) void release(token)
    }
  }
}
