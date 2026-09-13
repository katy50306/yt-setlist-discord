import { CONFIG } from './config.js'
import { ytApiFetch } from './youtube-fetch.js'
import { initStateAdapter, loadState, saveState } from './state.js'

const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/

// channels.list?forHandle= — 1 quota unit. Returns null when the handle no
// longer exists (renamed / deleted).
async function lookupHandle(handle) {
  const params = new URLSearchParams({ part: 'id', forHandle: handle })
  const data = await ytApiFetch('channels', params, `Failed to resolve @${handle}`)
  return data.items?.[0]?.id || null
}

/**
 * Map PREFERRED_AUTHORS entries to channel IDs and populate
 * CONFIG.preferredAuthorChannelIds.
 *
 * A comment's authorDisplayName is the author's current @handle, which they
 * can rename at any time (2026-09: @KL-gr1my → @KLバカ silently broke
 * preferred-author matching for days). Channel IDs never change, so:
 *   - "UC…" entries are used as-is
 *   - "@handle" entries are resolved once and cached in state.preferredAuthors,
 *     so a later rename keeps matching without touching the config
 *   - a handle that no longer resolves (renamed before it was ever cached) is
 *     logged and left to the display-name fallback in comment-matcher
 *
 * @param {object} state - loaded state (cache lives in state.preferredAuthors)
 * @param {{ lookup?: (handle: string) => Promise<string|null> }} deps - test injection
 * @returns {{ changed: boolean, unresolved: string[] }}
 */
export async function resolvePreferredAuthors(state, { lookup = lookupHandle } = {}) {
  const cache = state.preferredAuthors || (state.preferredAuthors = {})
  const ids = new Set()
  const unresolved = []
  let changed = false

  for (const entry of CONFIG.preferredAuthors) {
    if (CHANNEL_ID_RE.test(entry)) { ids.add(entry); continue }
    if (!entry.startsWith('@')) continue // plain display name: string match only

    if (cache[entry]?.channelId) { ids.add(cache[entry].channelId); continue }

    try {
      const channelId = await lookup(entry.slice(1))
      if (!channelId) throw new Error('channel not found')
      cache[entry] = { channelId, resolvedAt: new Date().toISOString() }
      ids.add(channelId)
      changed = true
      console.log(`Preferred author ${entry} → ${channelId}`)
    } catch (err) {
      unresolved.push(entry)
      console.warn(`Preferred author ${entry} could not be resolved (${err.message}) — ` +
        'renamed? Matching by display name only; update PREFERRED_AUTHORS')
    }
  }

  CONFIG.preferredAuthorChannelIds = [...ids]
  return { changed, unresolved }
}

let resolved = false

/**
 * Resolve once per process (Lambda container / Worker isolate / CLI run).
 * Pass the caller's loaded state when it will be saved later anyway
 * (checkChannels) so the cache rides along and no second copy of the state
 * overwrites it; without one, loads and saves the state itself.
 * Retries next call while any handle is still unresolved.
 */
export async function ensurePreferredAuthorsResolved(sharedState = null) {
  if (resolved || CONFIG.preferredAuthors.length === 0) return

  let state = sharedState
  let ownState = false
  if (!state) {
    try {
      await initStateAdapter()
      state = await loadState()
      ownState = true
    } catch (err) {
      console.warn(`Preferred-author cache unavailable (${err.message}); resolving without cache`)
      state = {}
    }
  }

  const { changed, unresolved } = await resolvePreferredAuthors(state)
  if (unresolved.length === 0) resolved = true

  if (changed && ownState) {
    try { await saveState(state) } catch (err) {
      console.warn(`Could not persist preferred-author cache: ${err.message}`)
    }
  }
}
