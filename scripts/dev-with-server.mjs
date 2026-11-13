import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { createPhysicsServer } from '../server/httpServer.js'

const physics = await createPhysicsServer({ resultPath: fileURLToPath(new URL('../server/data/results.json', import.meta.url)) })
let vite
try {
  await physics.listen(3003)
  vite = await createServer({ server: { host: '127.0.0.1', open: false } })
  await vite.listen()
  console.log('Серверная физика запущена на 127.0.0.1:3003')
  vite.printUrls()
} catch (error) {
  await physics.close()
  throw error
}
let stopping = false
async function stop() {
  if (stopping) return
  stopping = true
  await vite.close()
  await physics.close()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
