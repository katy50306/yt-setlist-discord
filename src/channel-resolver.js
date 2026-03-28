import { CONFIG } from './config.js'
import { fs, dirname } from './fs-probe.js'
import { ytApiFetch } from './youtube-fetch.js'

const CACHE_FILENAME = 'channel-cache.json'

function getCachePath() {
  if (!dirname) return CACHE_FILENAME
  return dirname(CONFIG.state.filePath) + '/' + CACHE_FILENAME
}

function loadCache() {
  if (!fs) return {}
  try {
    return JSON.parse(fs.readFileSync(getCachePath(), 'utf-8'))
  } catch {
    return {}
  }
}

function saveCache(cache) {
  if (!fs) return
  try {
    fs.mkdirSync(dirname(getCachePath()), { recursive: true })
    fs.writeFileSync(getCachePath(), JSON.stringify(cache, null, 2))
  } catch {
    // Lambda has read-only filesystem outside /tmp — skip cache write
  }
}

/**
 * Extract @handle from various input formats:
 *   "@QuonTama" → "QuonTama"
 *   "https://www.youtube.com/@QuonTama" → "QuonTama"
 *   "https://youtube.com/@QuonTama" → "QuonTama"
 * Returns null if input is not a handle format.
 */
function extractHandle(input) {
  const urlMatch = input.match(/youtube\.com\/@([^/?]+)/)
  if (urlMatch) return urlMatch[1]

  if (input.startsWith('@')) return input.substring(1)

  return null
}

/**
 * Resolve a YouTube @handle to a channel ID via the API.
 * Costs 1 quota unit.
 */
async function resolveHandle(handle) {
  const params = new URLSearchParams({
    part: 'id',
    forHandle: handle,
  })

  const data = await ytApiFetch('channels', params, `Failed to resolve @${handle}`)

  const channelId = data.items?.[0]?.id
  if (!channelId) {
    throw new Error(`Channel not found for @${handle}`)
  }

  return channelId
}

/**
 * Resolve all channel inputs to channel IDs.
 * Supports: @handle, YouTube URL, UCxxx, PLxxx
 * Results are cached (file-based or in-memory).
 */
export async function resolveChannels(inputs) {
  const cache = loadCache()
  let cacheUpdated = false

  const resolved = await Promise.all(inputs.map(async (input) => {
    const handle = extractHandle(input)
    if (!handle) return input

    const cacheKey = `@${handle}`
    if (cache[cacheKey]) {
      console.log(`  ${cacheKey} → ${cache[cacheKey].channelId} (cached)`)
      return cache[cacheKey].channelId
    }

    console.log(`  Resolving ${cacheKey}...`)
    const channelId = await resolveHandle(handle)
    console.log(`  ${cacheKey} → ${channelId}`)

    cache[cacheKey] = { channelId, resolvedAt: new Date().toISOString() }
    cacheUpdated = true
    return channelId
  }))

  if (cacheUpdated) saveCache(cache)

  return resolved
}
