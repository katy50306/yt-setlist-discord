import { CONFIG } from './config.js'
import { ytApiFetch } from './youtube-fetch.js'

async function searchChannelVideos(channelId, publishedAfter, publishedBefore) {
  const params = new URLSearchParams({
    part: 'snippet',
    channelId,
    type: 'video',
    order: 'date',
    maxResults: String(CONFIG.youtube.searchMaxResults),
    publishedAfter: new Date(publishedAfter).toISOString(),
    publishedBefore: new Date(publishedBefore + 'T23:59:59Z').toISOString(),
  })

  const data = await ytApiFetch('search', params, `YouTube search API error (${channelId})`)

  return (data.items || []).map(item => ({
    id: item.id.videoId,
    title: item.snippet.title,
    time: item.snippet.publishedAt,
  }))
}

export async function searchVideos(from, to) {
  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRe.test(from)) throw new Error(`Invalid date format for --from: ${from} (expected YYYY-MM-DD)`)
  if (!dateRe.test(to)) throw new Error(`Invalid date format for --to: ${to} (expected YYYY-MM-DD)`)

  const channelIds = CONFIG.channelIds
  if (!channelIds.length) throw new Error('No channels configured')

  console.log(`Searching ${channelIds.length} channel(s) from ${from} to ${to} (100 units/channel)`)

  const results = await Promise.allSettled(
    channelIds.map(id => searchChannelVideos(id, from, to))
  )

  const videos = []
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (r.status === 'fulfilled') {
      videos.push(...r.value)
    } else {
      console.error(`Search failed for ${channelIds[i]}: ${r.reason.message}`)
    }
  }

  videos.sort((a, b) => new Date(b.time) - new Date(a.time))
  return videos
}
