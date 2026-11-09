import { app } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { MongoClient } from 'mongodb'

const PORT = 27028
const REPLICA_SET = 'rs0'
const DIRECT_URI = `mongodb://127.0.0.1:${PORT}/?directConnection=true`

let child: ChildProcess | null = null

async function ping(): Promise<boolean> {
  const client = new MongoClient(DIRECT_URI, { serverSelectionTimeoutMS: 1000 })
  try {
    await client.connect()
    await client.db('admin').command({ ping: 1 })
    return true
  } catch {
    return false
  } finally {
    await client.close().catch(() => undefined)
  }
}

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    if (await ping()) return
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('Bundled MongoDB did not start in time')
}

async function ensureReplicaSet(): Promise<void> {
  const client = new MongoClient(DIRECT_URI, { serverSelectionTimeoutMS: 2000 })
  try {
    await client.connect()
    try {
      await client.db('admin').command({
        replSetInitiate: {
          _id: REPLICA_SET,
          members: [{ _id: 0, host: `127.0.0.1:${PORT}` }]
        }
      })
    } catch (error) {
      if ((error as { codeName?: string }).codeName !== 'AlreadyInitialized') throw error
    }
    const deadline = Date.now() + 30000
    while (Date.now() < deadline) {
      const hello = await client.db('admin').command({ hello: 1 })
      if (hello.isWritablePrimary) return
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    throw new Error('Bundled MongoDB replica set did not become primary')
  } finally {
    await client.close().catch(() => undefined)
  }
}

export async function startBundledMongo(): Promise<void> {
  if (!app.isPackaged) return

  const uri = `mongodb://127.0.0.1:${PORT}/?replicaSet=${REPLICA_SET}`
  process.env['MONGODB_URI'] = uri

  if (await ping()) {
    await ensureReplicaSet()
    return
  }

  const dataDir = join(app.getPath('userData'), 'mongodb-data')
  const logFile = join(app.getPath('userData'), 'mongodb.log')
  await mkdir(dataDir, { recursive: true })

  const executable = join(process.resourcesPath, 'mongodb', 'mongod.exe')
  child = spawn(
    executable,
    [
      '--dbpath', dataDir,
      '--port', String(PORT),
      '--bind_ip', '127.0.0.1',
      '--replSet', REPLICA_SET,
      '--logpath', logFile,
      '--logappend'
    ],
    { windowsHide: true, stdio: 'ignore' }
  )
  child.on('error', (error) => console.error('[mongo] failed to spawn', error))
  child.on('exit', (code) => {
    console.error(`[mongo] exited with code ${code}`)
    child = null
  })

  await waitForServer()
  await ensureReplicaSet()
}

export async function stopBundledMongo(): Promise<void> {
  if (!child) return
  const running = child
  const client = new MongoClient(DIRECT_URI, { serverSelectionTimeoutMS: 2000 })
  try {
    await client.connect()
    await client.db('admin').command({ shutdown: 1, force: true })
  } catch {
    // The server closes the socket while shutting down.
  } finally {
    await client.close().catch(() => undefined)
  }
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    if (running.exitCode !== null || running.killed) return
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  running.kill()
}
