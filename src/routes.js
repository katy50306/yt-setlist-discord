import { CONFIG } from './config.js'
import { processVideo, checkChannels, searchAndProcess, ensureChannelsResolved } from './core.js'
import { initStateAdapter, loadState, getChannels, addChannels, removeChannel } from './state.js'
import { resolveChannels } from './channel-resolver.js'
import { CHANNELS_HTML } from './channels-page.js'

/**
 * Handle an incoming request. Platform-agnostic.
 */
export async function handleRequest(path, params, context = {}) {
  await initStateAdapter(context.kvNamespace)

  // Channels management HTML page
  if (path === '/channels' && (!params.method || params.method === 'GET')) {
    return { status: 200, body: CHANNELS_HTML, html: true }
  }

  // Channels API
  if (path === '/api/channels') {
    // POST — import
    if (params.method === 'POST' && params.body) {
      const body = params.body.trim()
      let entries
      try {
        // Try JSON format first: [{"name":"@a","id":"UCxxx"},...]
        const parsed = JSON.parse(body)
        if (Array.isArray(parsed) && parsed[0]?.id) {
          // Already resolved format — store directly
          const channels = await addChannels(parsed)
          return { status: 200, body: { channels } }
        }
        // JSON array of strings: ["@a","@b"]
        if (Array.isArray(parsed)) {
          const resolved = await resolveChannels(parsed)
          entries = parsed.map((name, i) => ({ name, id: resolved[i] }))
        }
      } catch {
        // Plain text: one per line
        const lines = body.split('\n').map(s => s.trim()).filter(Boolean)
        const resolved = await resolveChannels(lines)
        entries = lines.map((name, i) => ({ name, id: resolved[i] }))
      }
      if (entries) {
        const channels = await addChannels(entries)
        return { status: 200, body: { channels } }
      }
      return { status: 400, body: { error: 'Invalid import format' } }
    }

    // GET — add
    if (params.add) {
      const raw = params.add.split(',').map(s => s.trim()).filter(Boolean)
      const resolved = await resolveChannels(raw)
      const entries = raw.map((name, i) => ({ name, id: resolved[i] }))
      const channels = await addChannels(entries)
      return { status: 200, body: { channels } }
    }

    // GET — remove
    if (params.remove) {
      const channels = await removeChannel(params.remove)
      return { status: 200, body: { channels } }
    }

    // GET — list
    const channels = await getChannels()
    return { status: 200, body: { channels } }
  }

  if (path === '/check' && params.video) {
    const result = await processVideo(params.video, { dryRun: params.dryRun })
    return { status: 200, body: result }
  }

  if (path === '/check' && params.from) {
    const result = await searchAndProcess(params.from, params.to, { dryRun: params.dryRun })
    return { status: 200, body: result }
  }

  if (path === '/check') {
    const result = await checkChannels({ dryRun: params.dryRun })
    return { status: 200, body: result }
  }

  if (path === '/status') {
    const state = await loadState()
    const count = Object.keys(state.processedVideos).length
    const foundCount = Object.values(state.processedVideos).filter(v => v.found).length
    return {
      status: 200,
      body: {
        status: 'running',
        channels: (state.channels || []).length,
        cronSchedule: CONFIG.cron.schedule,
        processedVideos: count,
        setlistsFound: foundCount,
      },
    }
  }

  return { status: 404, body: { error: 'Not found. Try /channels, /check, or /status' } }
}
