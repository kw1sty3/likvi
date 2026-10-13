import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import RAPIER from '@dimforge/rapier3d-compat'
import { createArenaCollisionRoot } from '../src/physics/arena.js'
import { createStaticCollisionWorld } from '../src/physics/staticCollisionWorld.js'
import { ARENA_VERSION } from '../src/physics/raceRules.js'
import { createServerRace, ProtocolError } from './simulation.js'
import { createResultStore } from './resultStore.js'

const STEP_MS = 1000 / 60
const MAX_SESSIONS = 8
const BODY_LIMIT = 2048
async function readJSON(request) {
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') throw new ProtocolError('Нужен application/json.', 415)
  return new Promise((resolve, reject) => {
    const chunks = []
    let length = 0, oversized = false
    request.on('data', chunk => {
      length += chunk.length
      if (length > BODY_LIMIT) {
        oversized = true
        chunks.length = 0
        reject(new ProtocolError('Слишком большой запрос.', 413))
      } else if (!oversized) chunks.push(chunk)
    })
    request.on('end', () => {
      if (oversized) return
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch { reject(new ProtocolError('Некорректный JSON.')) }
    })
    request.on('error', reject)
  })
}
const send = (response, status, data) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  response.end(JSON.stringify(data))
}

export async function createPhysicsServer({ resultPath, clock = () => performance.now(), autoTick = true,
  collisionIndex: suppliedIndex, raceOptions, allowedOrigins = [] } = {}) {
  await RAPIER.init()
  let index = suppliedIndex
  if (!index) {
    const arena = createArenaCollisionRoot()
    try { index = createStaticCollisionWorld(arena.root) } finally { arena.dispose() }
  }
  const resultStore = await createResultStore(resultPath)
  const sessions = new Map()
  let accumulator = 0, previousTime = clock(), closing = false
  const snapshot = session => ({ ...session.race.snapshot(), resultStored: session.resultStored,
    storageError: session.storageError })
  const remove = token => { const session = sessions.get(token); if (session) { session.race.dispose(); sessions.delete(token) } }
  const pump = () => {
    const now = clock(), elapsed = Math.max(0, now - previousTime)
    previousTime = now
    // A stalled process cannot produce a valid competitive result by slowing time.
    if (elapsed > 250) {
      for (const session of sessions.values()) session.race.abort('Сервер не успевает рассчитывать заезд. Повторите попытку.')
      accumulator = 0
    } else accumulator += elapsed
    while (accumulator + 1e-8 >= STEP_MS) {
      for (const session of sessions.values()) session.race.step(now)
      accumulator -= STEP_MS
    }
    for (const [token, session] of sessions) {
      const state = session.race.snapshot()
      if (state.result && !session.saving) {
        session.saving = true
        resultStore.save(state.result).then(() => { session.resultStored = true }, () => {
          session.storageError = 'Не удалось сохранить результат на сервере. Попробуйте позже.'
        })
      }
      if (now - session.lastSeen > 30000) remove(token)
    }
  }
  const http = createServer({ maxHeaderSize: 8192, requestTimeout: 5000, headersTimeout: 5000 }, async (request, response) => {
    try {
      if (closing) throw new ProtocolError('Сервер останавливается.', 503)
      // The Vite/reverse proxy preserves Host. Foreign web origins cannot create sessions.
      const origin = request.headers.origin
      const hostname = new URL(`http://${request.headers.host}`).hostname
      if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname) && !allowedOrigins.includes(origin)) {
        throw new ProtocolError('Недопустимый адрес сервера.', 403)
      }
      if (origin && origin !== `http://${request.headers.host}` && origin !== `https://${request.headers.host}` && !allowedOrigins.includes(origin)) {
        throw new ProtocolError('Недопустимый источник запроса.', 403)
      }
      const path = new URL(request.url, 'http://localhost').pathname
      if (request.method === 'GET' && path === '/api/physics/health') {
        send(response, 200, { protocol: 1, arenaVersion: ARENA_VERSION, status: 'ready' }); return
      }
      if (request.method === 'GET' && path === '/api/physics/results') {
        send(response, 200, { results: resultStore.list() }); return
      }
      if (request.method === 'POST' && path === '/api/physics/session') {
        const body = await readJSON(request)
        if (!body || Object.keys(body).length !== 2 || body.protocol !== 1 || body.arenaVersion !== ARENA_VERSION) {
          throw new ProtocolError('Версия клиента или карты не совпадает с сервером.', 409)
        }
        if (sessions.size >= MAX_SESSIONS) throw new ProtocolError('Все места заняты. Повторите попытку позже.', 503)
        const token = randomBytes(32).toString('hex')
        const now = clock()
        const session = { race: createServerRace(RAPIER, index, { ...raceOptions, now }), lastSeen: now,
          inputBudget: 120, budgetAt: now,
          resultStored: false, saving: false, storageError: null }
        sessions.set(token, session)
        send(response, 201, { token, snapshot: snapshot(session) }); return
      }
      const token = request.headers.authorization?.replace(/^Bearer /, '')
      const session = sessions.get(token)
      if (!session) throw new ProtocolError('Сессия не найдена. Начните новый заезд.', 401)
      if (request.method === 'DELETE' && path === '/api/physics/session') {
        remove(token); send(response, 200, { closed: true }); return
      }
      if (request.method === 'POST' && path === '/api/physics/input') {
        const now = clock()
        session.inputBudget = Math.min(120, session.inputBudget + Math.max(0, now - session.budgetAt) * 0.06)
        session.budgetAt = now
        if (session.inputBudget < 1) throw new ProtocolError('Слишком частые команды.', 429)
        session.inputBudget--
        const input = await readJSON(request)
        if (sessions.get(token) !== session) throw new ProtocolError('Сессия уже закрыта.', 401)
        session.race.acceptInput(input, clock())
        session.lastSeen = clock()
        send(response, 200, snapshot(session)); return
      }
      throw new ProtocolError('Маршрут не найден.', 404)
    } catch (error) {
      if (!response.destroyed && !response.headersSent) send(response, error.status ?? 500,
        { error: error instanceof ProtocolError ? error.message : 'Внутренняя ошибка сервера.' })
    }
  })
  http.maxRequestsPerSocket = 1000
  const timer = autoTick ? setInterval(pump, 8) : null
  return {
    http, pump,
    async listen(port = 3003, host = '127.0.0.1') {
      await new Promise((resolve, reject) => {
        http.once('error', reject)
        http.listen(port, host, () => { http.off('error', reject); resolve() })
      })
      return http.address()
    },
    async close() {
      if (closing) return
      closing = true
      clearInterval(timer)
      await new Promise(resolve => { http.close(resolve); http.closeAllConnections() })
      for (const token of sessions.keys()) remove(token)
      await resultStore.flush()
      if (!suppliedIndex) index.dispose()
    }
  }
}
