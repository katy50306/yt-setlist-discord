import { CONFIG } from './config.js'
import { ytApiFetch } from './youtube-fetch.js'

export async function getVideoComments(videoId) {
  const params = new URLSearchParams({
    textFormat: CONFIG.youtube.textFormat,
    part: 'snippet,replies',
    videoId,
    maxResults: String(CONFIG.youtube.maxResults),
  })

  const data = await ytApiFetch('commentThreads', params, 'YouTube commentThreads API error')

  const comments = []
  for (const item of (data.items || [])) {
    const s = item.snippet.topLevelComment.snippet
    comments.push({
      text: s.textDisplay,
      authorDisplayName: s.authorDisplayName,
      likeCount: s.likeCount,
    })
    for (const reply of (item.replies?.comments || [])) {
      const rs = reply.snippet
      comments.push({
        text: rs.textDisplay,
        authorDisplayName: rs.authorDisplayName,
        likeCount: rs.likeCount,
      })
    }
  }

  return comments
}
