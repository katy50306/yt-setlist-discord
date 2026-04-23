import { CONFIG } from './config.js'
import { ytApiFetch } from './youtube-fetch.js'

function toPlaylistId(channelOrPlaylistId) {
  if (channelOrPlaylistId.startsWith('UC')) {
    return CONFIG.youtube.playlistPrefix + channelOrPlaylistId.substring(2)
  }
  return channelOrPlaylistId
}

function extractVideoTime(item) {
  return item.liveStreamingDetails?.scheduledStartTime || item.snippet.publishedAt
}

async function fetchPlaylistVideos(playlistId, maxResults = 10) {
  const params = new URLSearchParams({
    part: 'snippet',
    playlistId,
    maxResults: String(maxResults),
  })

  const data = await ytApiFetch('playlistItems', params, `YouTube playlistItems API error (${playlistId})`)

  return (data.items || []).map(item => ({
    id: item.snippet.resourceId.videoId,
    title: item.snippet.title,
    time: item.snippet.publishedAt,
  }))
}

export async function getVideoDetails(videoId) {
  const params = new URLSearchParams({
    part: 'snippet,liveStreamingDetails',
    id: videoId,
  })

  const data = await ytApiFetch('videos', params, 'YouTube videos API error')

  const item = data.items?.[0]
  if (!item) throw new Error(`Video not found: ${videoId}`)

  return {
    id: videoId,
    title: item.snippet.title,
    time: extractVideoTime(item),
    actualEndTime: item.liveStreamingDetails?.actualEndTime || null,
    channelTitle: item.snippet.channelTitle,
  }
}

/**
 * Batch fetch video details. 1 API unit regardless of count (max 50 IDs).
 */
export async function getVideoDetailsBatch(videoIds) {
  if (videoIds.length === 0) return []

  const params = new URLSearchParams({
    part: 'snippet,liveStreamingDetails',
    id: videoIds.join(','),
  })

  const data = await ytApiFetch('videos', params, 'YouTube videos API error')

  return (data.items || []).map(item => ({
    id: item.id,
    title: item.snippet.title,
    time: extractVideoTime(item),
    actualEndTime: item.liveStreamingDetails?.actualEndTime || null,
    channelTitle: item.snippet.channelTitle,
  }))
}

export async function getRecentVideos(channelIds, maxPerChannel = 1) {
  const playlists = channelIds.map(toPlaylistId)

  const results = await Promise.allSettled(
    playlists.map(pl => fetchPlaylistVideos(pl, maxPerChannel))
  )

  const videos = []
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (r.status === 'fulfilled') {
      videos.push(...r.value)
    } else {
      console.error(`Failed to fetch from ${channelIds[i]}: ${r.reason.message}`)
    }
  }

  videos.sort((a, b) => new Date(b.time) - new Date(a.time))
  return videos
}
