import { resolve } from 'node:path'
import { createPhysicsServer } from './httpServer.js'

const port = Number(process.env.PHYSICS_PORT || 3003)
const app = await createPhysicsServer({ resultPath: resolve(process.env.PHYSICS_RESULTS || 'server/data/results.json') })
const address = await app.listen(port)
console.log(`Likvi physics: http://${address.address}:${address.port} (60 Hz)`)
let stopping = false
async function stop() {
  if (stopping) return
  stopping = true
  await app.close()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
