import { CONFIG } from './config.js'
import { fs } from './fs-probe.js'

let adapter = null

/**
 * Detect and initialize the appropriate state storage adapter.
 * Priority: Cloudflare KV > DynamoDB > File system > Error
 */
export async function initStateAdapter(kvNamespace) {
  if (adapter) return

  // 1. Cloudflare KV (passed from worker.js)
  if (kvNamespace) {
    const { createCloudflareKVAdapter } = await import('./state-adapters/cloudflare-kv.js')
    adapter = createCloudflareKVAdapter(kvNamespace)
    console.log('State storage: Cloudflare KV')
    return
  }

  // 2. DynamoDB
  if (process.env.DYNAMODB_TABLE) {
    const { createDynamoDBAdapter } = await import('./state-adapters/dynamodb.js')
    adapter = createDynamoDBAdapter(process.env.DYNAMODB_TABLE)
    console.log('State storage: DynamoDB (' + process.env.DYNAMODB_TABLE + ')')
    return
  }

  // 3. File system
  if (fs) {
    const { createFileAdapter } = await import('./state-adapters/file.js')
    adapter = createFileAdapter(CONFIG.state.filePath)
    console.log('State storage: file (' + CONFIG.state.filePath + ')')
    return
  }

  // No adapter available
  throw new Error('No state storage available. Docker: auto (file). Workers: add KV binding. Lambda: set DYNAMODB_TABLE.')
}

/**
 * Load state from storage.
 */
export async function loadState() {
  const state = await adapter.load()
  if (!state.channels) state.channels = []
  if (!state.processedVideos) state.processedVideos = {}
  return state
}

/**
 * Save state to storage.
 */
export async function saveState(state) {
  return adapter.save(state)
}

/**
 * Get channels from state.
 */
export async function getChannels() {
  const state = await loadState()
  return state.channels || []
}

/**
 * Add channels to state. Each entry is { name, id }.
 * Deduplicates by id. Returns the updated list.
 */
export async function addChannels(entries) {
  const state = await loadState()
  const channels = state.channels || []
  const existingIds = new Set(channels.map(ch => ch.id))
  for (const entry of entries) {
    if (entry.id && !existingIds.has(entry.id)) {
      channels.push({ name: entry.name, id: entry.id })
      existingIds.add(entry.id)
    }
  }
  state.channels = channels
  await saveState(state)
  return state.channels
}

/**
 * Remove a channel from state by id or name. Returns the updated list.
 */
export async function removeChannel(channel) {
  const state = await loadState()
  const target = channel.trim()
  state.channels = (state.channels || []).filter(ch =>
    ch.id !== target && ch.name !== target
  )
  await saveState(state)
  return state.channels
}

/**
 * Check if a video should be processed.
 */
export function shouldProcess(state, videoId) {
  const entry = state.processedVideos[videoId]
  if (!entry) return true

  if (!entry.found) {
    const elapsed = Date.now() - new Date(entry.processedAt).getTime()
    return elapsed < CONFIG.state.retryWindowMs
  }

  return false
}

/**
 * Mark a video as processed.
 */
export function markProcessed(state, videoId, found) {
  state.processedVideos[videoId] = {
    processedAt: new Date().toISOString(),
    found,
  }
}

/**
 * Remove old entries to keep state small.
 */
export function pruneState(state) {
  const entries = Object.entries(state.processedVideos)
  if (entries.length <= CONFIG.state.maxEntries) return

  entries.sort((a, b) => new Date(b[1].processedAt) - new Date(a[1].processedAt))
  state.processedVideos = Object.fromEntries(entries.slice(0, CONFIG.state.maxEntries))
}
