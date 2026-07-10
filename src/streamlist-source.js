import { CONFIG } from './config.js'

/**
 * Fetch recent video IDs from an external streamlist API (optional).
 *
 * The uploads playlist misses videos that YouTube removes from public
 * indexes: copyright-blocked, members-only, or index-delayed streams.
 * A PubSub-backed source (e.g. berry-site /api/streamlist) knows those
 * IDs the moment the stream is created, and their comment sections stay
 * readable even when playback is blocked.
 *
 * Expected response: an array (or {data: [...]} / {data:{streams:[...]}})
 * of objects with a streamID / videoId / id field, newest first.
 * Fail-open: any error returns [] so the playlist pipeline is unaffected.
 */
export async function getStreamlistVideoIds(limit) {
  const url = CONFIG.streamlistApiUrl
  if (!url) return []

  try {
    const sep = url.includes('?') ? '&' : '?'
    const res = await fetch(`${url}${sep}limit=${limit}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const rows = json.data?.streams || json.data || json
    if (!Array.isArray(rows)) return []
    return rows
      .map(r => r.streamID || r.videoId || r.id)
      .filter(Boolean)
      .slice(0, limit)
  } catch (err) {
    console.error(`Streamlist source failed (ignored): ${err.message}`)
    return []
  }
}
