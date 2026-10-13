import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { dirname } from 'node:path'

// Only server-generated finishes enter this store; there is no submit-score API.
export async function createResultStore(path) {
  let results = []
  try { results = JSON.parse(await readFile(path, 'utf8')) } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  if (!Array.isArray(results) || results.some(item => !item.id || item.verifiedBy !== 'server' || !Number.isFinite(item.score))) {
    throw new Error('Некорректный файл серверных результатов.')
  }
  let pending = Promise.resolve()
  const sort = items => items.sort((a, b) => b.score - a.score || a.timeMs - b.timeMs).slice(0, 100)
  return {
    list: () => results.map(item => ({ ...item })),
    save(result) {
      const write = pending.then(async () => {
        if (results.some(item => item.id === result.id)) return
        const next = sort([...results, result])
        await mkdir(dirname(path), { recursive: true })
        await writeFile(`${path}.tmp`, JSON.stringify(next, null, 2), 'utf8')
        await rename(`${path}.tmp`, path)
        results = next
      })
      pending = write.catch(() => {})
      return write
    },
    flush: () => pending
  }
}
