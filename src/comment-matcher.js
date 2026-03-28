import { CONFIG } from './config.js'

const TIMESTAMP_RE = /\d{1,2}:\d{2}(?::\d{2})?/g

function timestampToSeconds(ts) {
  const parts = ts.split(':').map(Number)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return parts[0] * 60 + parts[1]
}

function mergeByTimestamp(candidates) {
  candidates.sort((a, b) =>
    timestampToSeconds(a._tsMatches[0]) - timestampToSeconds(b._tsMatches[0])
  )
  const authors = [...new Set(candidates.map(c => c.authorDisplayName || '匿名'))]
  const text = candidates.map(c => c.text).join('\n\n')
  return { text, author: authors.join(', ') }
}

export function findSetlistComment(comments) {
  const {
    minTimestamps, minLikes, likeWeight,
    minLength, minLines, lengthWeight,
  } = CONFIG.commentFilter
  const preferred = new Set(CONFIG.preferredAuthors)
  const lowerKeywords = [...CONFIG.setlistKeywords, ...CONFIG.extraKeywords].map(kw => kw.toLowerCase())

  const withMatches = comments.map(c => ({
    ...c,
    _tsMatches: c.text.match(TIMESTAMP_RE) || [],
    _lower: c.text.toLowerCase(),
    _lines: c.text.split('\n').length,
  }))

  // Priority 1: preferred authors with timestamps (no like filter)
  if (preferred.size > 0) {
    const preferredCandidates = withMatches.filter(c =>
      preferred.has(c.authorDisplayName) && c._tsMatches.length >= minTimestamps
    )
    if (preferredCandidates.length > 0) {
      return { ...mergeByTimestamp(preferredCandidates), matchedBy: 'preferred-author' }
    }
  }

  // Priority 2: timestamps + likes
  const timestampCandidates = withMatches.filter(c =>
    c._tsMatches.length >= minTimestamps && c.likeCount >= minLikes
  )
  if (timestampCandidates.length > 0) {
    return { ...mergeByTimestamp(timestampCandidates), matchedBy: 'timestamp+likes' }
  }

  // Priority 3: keyword matching — single best
  const keywordCandidates = withMatches
    .filter(c => {
      const hasKeyword = lowerKeywords.some(kw => c._lower.includes(kw))
      return hasKeyword && (c._lines >= minLines || c.text.length >= minLength)
    })
    .map(c => ({
      ...c,
      score: c.likeCount * likeWeight + c.text.length * lengthWeight,
    }))
    .sort((a, b) => b.score - a.score)

  if (keywordCandidates.length > 0) {
    const best = keywordCandidates[0]
    return { text: best.text, author: best.authorDisplayName || '匿名', matchedBy: 'keyword' }
  }

  return null
}
