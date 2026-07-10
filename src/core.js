import { CONFIG } from './config.js'
import { getVideoComments } from './youtube-comments.js'
import { findSetlistComment } from './comment-matcher.js'
import { sendSetlistComment } from './discord-sender.js'
import { getRecentVideos, getVideoDetails, getVideoDetailsBatch } from './youtube-channel.js'
import { searchVideos } from './youtube-search.js'
import { getStreamlistVideoIds } from './streamlist-source.js'
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
  // Non-live uploads have no end time — cooldown counts from publish time instead.
  let onlyPreferred = false
  if (CONFIG.preferredAuthors.length > 0) {
    const cooldownMs = CONFIG.commentFilter.preferredAuthorCooldownHours * 3600_000
    if (video.isLive && !video.actualEndTime) {
      onlyPreferred = true // stream ongoing (or waiting room): always wait
    } else {
      const anchor = video.actualEndTime || video.time
      if (anchor && Date.now() - new Date(anchor).getTime() < cooldownMs) {
        onlyPreferred = true
      }
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
  const videos = await getRecentVideos(CONFIG.channelIds, CONFIG.youtube.maxVideosPerChannel)
  console.log(`Found ${videos.length} recent videos across all channels`)

  // Merge external streamlist source — catches videos absent from the
  // uploads playlist (copyright-blocked, members-only, index-delayed)
  const extraIds = await getStreamlistVideoIds(CONFIG.youtube.maxVideosPerChannel)
  const knownIds = new Set(videos.map(v => v.id))
  const extras = extraIds.filter(id => !knownIds.has(id)).map(id => ({ id }))
  if (extras.length > 0) {
    console.log(`Streamlist source added ${extras.length} video(s) not in playlist`)
  }

  const toProcessIds = [...videos, ...extras].filter(v => shouldProcess(state, v.id))
  console.log(`${toProcessIds.length} video(s) to process`)

  // Batch fetch details (scheduledStartTime) — 1 unit per 50 videos.
  // Also drops deleted/private videos (absent from the API response).
  const allDetails = toProcessIds.length > 0
    ? await getVideoDetailsBatch(toProcessIds.map(v => v.id))
    : []

  // Ongoing/upcoming streams can't have a final setlist yet — skip without
  // marking processed so they're picked up again next run
  const toProcess = allDetails.filter(v => {
    if (v.isLive && !v.actualEndTime) {
      console.log(`  Skipping (still live): ${v.title || v.id}`)
      return false
    }
    return true
  })

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

  const searchResults = await searchVideos(from, to)
  console.log(`Found ${searchResults.length} video(s) in date range`)
  // Search results lack liveStreamingDetails — fetch full shape for cooldown logic
  const videos = await getVideoDetailsBatch(searchResults.map(v => v.id))

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
