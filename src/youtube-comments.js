import { CONFIG } from './config.js'
import { ytApiFetch } from './youtube-fetch.js'

export async function getVideoComments(videoId) {
  const params = new URLSearchParams({
    textFormat: CONFIG.youtube.textFormat,
    part: 'snippet,replies',
    videoId,
    maxResults: String(CONFIG.youtube.maxResults),
    // relevance keeps high-liked setlist comments within the first page even
    // on older videos with hundreds of comments (default 'time' buries them)
    order: 'relevance',
  })

  const data = await ytApiFetch('commentThreads', params, 'YouTube commentThreads API error')

  const comments = []
  for (const item of (data.items || [])) {
    const s = item.snippet.topLevelComment.snippet
    comments.push({
      text: s.textDisplay,
      authorDisplayName: s.authorDisplayName,
      // stable across handle renames (authorDisplayName is the current @handle)
      authorChannelId: s.authorChannelId?.value ?? null,
      likeCount: s.likeCount,
    })
    for (const reply of (item.replies?.comments || [])) {
      const rs = reply.snippet
      comments.push({
        text: rs.textDisplay,
        authorDisplayName: rs.authorDisplayName,
        authorChannelId: rs.authorChannelId?.value ?? null,
        likeCount: rs.likeCount,
      })
    }
  }

  return comments
}
