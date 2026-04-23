import { CONFIG } from './config.js'
import { getVideoComments } from './youtube-comments.js'
import { findSetlistComment } from './comment-matcher.js'
import { sendSetlistComment } from './discord-sender.js'
import { getRecentVideos, getVideoDetails, getVideoDetailsBatch } from './youtube-channel.js'
import { searchVideos } from './youtube-search.js'
import { initStateAdapter, loadState, saveState, shouldProcess, markProcessed, pruneState, getChannels } from './state.js'
import { resolveChannels } from './channel-resolver.js'

/**
 * Load channels from state and populate CONFIG.channelIds.
 * Accepts an optional pre-loaded state to avoid redundant reads.
 */
export function resolveChannelsFromState(state) {
  const channels = state.channels || []
  if (channels.length === 0) {
    console.log('No channels configured. Use /channels to add channels.')
    CONFIG.channelIds = []
    return
  }
  CONFIG.channelIds = channels.map(ch => ch.id)
  console.log(`Loaded ${CONFIG.channelIds.length} channel(s)`)
}

/**
 * Ensure channels are resolved (reads state if needed).
 */
export async function ensureChannelsResolved() {
  const state = await loadState()
  resolveChannelsFromState(state)
}

/**
 * Process a single video: fetch comments → detect setlist → send to Discord.
 *
 * @param {string|{id: string, title?: string, time?: string}} videoOrId
 * @param {{ dryRun?: boolean }} options
 * @returns {{ videoId: string, found: boolean, text?: string, author?: string }}
 */
export async function processVideo(videoOrId, options = {}) {
  // Accept either a video object or a plain video ID
  let video
  if (typeof videoOrId === 'string') {
    video = await getVideoDetails(videoOrId)
  } else {
    video = videoOrId
  }

  console.log(`Processing: ${video.title || video.id}`)

  const comments = await getVideoComments(video.id)
  console.log(`  Fetched ${comments.length} comments`)

  // Preferred-author cooldown: if author list set, within N hours of stream end
  // (or stream hasn't ended), only match preferred authors. Gives them time to
  // post the setlist before falling back to other comments.
  let onlyPreferred = false
  if (CONFIG.preferredAuthors.length > 0) {
    const cooldownMs = CONFIG.commentFilter.preferredAuthorCooldownHours * 3600_000
    if (!video.actualEndTime) {
      onlyPreferred = true
    } else {
      const elapsed = Date.now() - new Date(video.actualEndTime).getTime()
      if (elapsed < cooldownMs) onlyPreferred = true
    }
  }

  const result = findSetlistComment(comments, { onlyPreferred })

  if (!result) {
    if (onlyPreferred) console.log('  No preferred-author setlist yet (in cooldown)')
    else console.log('  No setlist comment found')
    return { videoId: video.id, found: false }
  }

  console.log(`  Found setlist by ${result.author} [${result.matchedBy}] (${result.text.length} chars)`)

  if (options.dryRun) {
    console.log('  [DRY RUN] Skipping Discord send')
    console.log('  ---')
    console.log(result.text)
    console.log('  ---')
  } else {
    await sendSetlistComment(video, result.text, result.author)
  }

  return { videoId: video.id, found: true, text: result.text, author: result.author }
}

/**
 * Check all configured channels for new videos, process each one.
 *
 * @param {{ dryRun?: boolean }} options
 * @returns {{ processed: number, found: number, errors: number }}
 */
export async function checkChannels(options = {}) {
  await initStateAdapter()
  const state = await loadState()
  resolveChannelsFromState(state)
  console.log('Checking channels for new videos...')
  const videos = await getRecentVideos(CONFIG.channelIds)
  console.log(`Found ${videos.length} recent videos across all channels`)

  const toProcessIds = videos.filter(v => shouldProcess(state, v.id))
  console.log(`${toProcessIds.length} video(s) to process`)

  // Batch fetch details (scheduledStartTime) — 1 unit regardless of count
  const toProcess = toProcessIds.length > 0
    ? await getVideoDetailsBatch(toProcessIds.map(v => v.id))
    : []

  let found = 0
  let errors = 0

  for (const video of toProcess) {
    try {
      const result = await processVideo(video, options)
      if (!options.dryRun) {
        markProcessed(state, video.id, result.found)
      }
      if (result.found) found++
    } catch (err) {
      console.error(`Error processing ${video.id}: ${err.message}`)
      errors++
    }
  }

  if (!options.dryRun) {
    pruneState(state)
    await saveState(state)
  }

  console.log(`Done: ${toProcess.length} processed, ${found} setlist(s) found, ${errors} error(s)`)
  return { processed: toProcess.length, found, errors }
}

/**
 * Search channels for videos in a date range and process each one.
 * Uses YouTube Search API — 100 quota units per channel.
 *
 * @param {string} from - Start date (YYYY-MM-DD)
 * @param {string} to - End date (YYYY-MM-DD)
 * @param {{ dryRun?: boolean }} options
 */
export async function searchAndProcess(from, to, options = {}) {
  if (!to) to = new Date().toISOString().split('T')[0]
  await ensureChannelsResolved()

  const videos = await searchVideos(from, to)
  console.log(`Found ${videos.length} video(s) in date range`)

  let found = 0
  let errors = 0

  for (const video of videos) {
    try {
      const result = await processVideo(video, options)
      if (result.found) found++
    } catch (err) {
      console.error(`Error processing ${video.id}: ${err.message}`)
      errors++
    }
  }

  console.log(`Done: ${videos.length} processed, ${found} setlist(s) found, ${errors} error(s)`)
  return { processed: videos.length, found, errors }
}
