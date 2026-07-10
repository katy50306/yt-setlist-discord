import { test } from 'node:test'
import assert from 'node:assert/strict'

// Set env BEFORE importing (config.js validates at import time; dotenv does
// not overwrite pre-existing vars, so these win over .env)
process.env.YOUTUBE_API_KEY = 'test-key'
process.env.DISCORD_WEBHOOK_URLS = '["https://example.com/webhook"]'
process.env.API_TOKEN = 'test-token'
process.env.PREFERRED_AUTHORS = '["@KL-gr1my"]'
process.env.MIN_LIKES = '10'

const { findSetlistComment } = await import('../src/comment-matcher.js')

function comment(text, { author = 'someone', likes = 0 } = {}) {
  return { text, authorDisplayName: author, likeCount: likes }
}

const chat = comment('かわいい！すごくよかった！', { likes: 50 })

// --- Priority 1: preferred author ---

test('preferred author matches regardless of likes', () => {
  const setlist = comment('セトリ\n0:07:41 曲A\n0:20:42 曲B\n0:35:46 曲C', {
    author: '@KL-gr1my', likes: 0,
  })
  const r = findSetlistComment([chat, setlist])
  assert.equal(r.matchedBy, 'preferred-author')
  assert.equal(r.author, '@KL-gr1my')
})

test('preferred author needs >=3 timestamps', () => {
  const tooFew = comment('0:07:41 曲A\n0:20:42 曲B', { author: '@KL-gr1my' })
  const r = findSetlistComment([tooFew])
  assert.equal(r, null)
})

test('relay setlist: 115 songs split A/B/A merge in timestamp order', () => {
  // Real case: song 1-60 by A, 61-90 by B, 91-115 by A again
  const partA1 = comment('0:07:41 01 曲一\n0:15:00 02 曲二\n0:22:00 03 曲三', { author: '@KL-gr1my' })
  const partB = comment('1:30:00 61 曲六十一\n1:35:00 62 曲六十二\n1:40:00 63 曲六十三', { author: '@helper-B' })
  const partA2 = comment('2:10:00 91 曲九十一\n2:15:00 92 曲九十二\n2:20:00 93 曲九十三', { author: '@KL-gr1my' })

  // Note: only @KL-gr1my is preferred — priority 1 merges their two parts;
  // helper-B (not preferred, 0 likes) is not included at priority 1.
  const r = findSetlistComment([partA2, chat, partB, partA1])
  assert.equal(r.matchedBy, 'preferred-author')
  const idx1 = r.text.indexOf('曲一')
  const idx91 = r.text.indexOf('曲九十一')
  assert.ok(idx1 >= 0 && idx91 > idx1, 'parts sorted by first timestamp')
  assert.ok(!r.text.includes('曲六十一'), 'non-preferred part not merged at priority 1')
})

test('relay setlist at priority 2 merges different authors by timestamp', () => {
  // When no preferred author posted, liked fragments from different fans merge
  const partA = comment('0:07:41 01 曲一\n0:15:00 02 曲二\n0:22:00 03 曲三', { author: '@fan-A', likes: 15 })
  const partB = comment('1:30:00 61 曲六十一\n1:35:00 62 曲六十二\n1:40:00 63 曲六十三', { author: '@fan-B', likes: 12 })
  const r = findSetlistComment([partB, chat, partA])
  assert.equal(r.matchedBy, 'timestamp+likes')
  assert.ok(r.text.indexOf('曲一') < r.text.indexOf('曲六十一'), 'sorted by first timestamp')
  assert.equal(r.author, '@fan-A, @fan-B')
})

// --- Cooldown (onlyPreferred) ---

test('onlyPreferred suppresses non-preferred matches during cooldown', () => {
  const liked = comment('setlist\n0:07:41 曲A\n0:20:42 曲B\n0:35:46 曲C', { author: '@stranger', likes: 99 })
  assert.equal(findSetlistComment([liked], { onlyPreferred: true }), null)
  const r = findSetlistComment([liked], { onlyPreferred: false })
  assert.equal(r.matchedBy, 'timestamp+likes')
})

test('onlyPreferred still returns preferred author match', () => {
  const setlist = comment('0:07:41 曲A\n0:20:42 曲B\n0:35:46 曲C', { author: '@KL-gr1my' })
  const r = findSetlistComment([setlist], { onlyPreferred: true })
  assert.equal(r.matchedBy, 'preferred-author')
})

// --- Priority 2: timestamps + likes ---

test('timestamps below MIN_LIKES do not match priority 2', () => {
  const fewLikes = comment('0:07:41 曲A\n0:20:42 曲B\n0:35:46 曲C', { likes: 9 })
  assert.equal(findSetlistComment([fewLikes]), null)
})

// --- Priority 3: keyword ---

test('keyword match requires >=2 timestamps (anti false-positive)', () => {
  // Long prose mentioning セトリ but with <2 timestamps must not match
  const prose = comment(
    'セトリを楽しみにしてました！今日の配信は最高でした。'.repeat(5) + '\n2行目\n3行目',
    { likes: 30 },
  )
  assert.equal(findSetlistComment([prose]), null)

  const withTs = comment(
    'セトリ\n0:07:41 曲A\n0:20:42 曲B\nとても良い配信でした！本当に感動しました！すばらしい歌声をありがとうございました！また来週も楽しみにしています！',
    { likes: 3 },
  )
  const r = findSetlistComment([withTs])
  assert.equal(r.matchedBy, 'keyword')
})

test('plain chat comments never match', () => {
  assert.equal(findSetlistComment([chat, comment('88888888')]), null)
})

test('empty comment list returns null', () => {
  assert.equal(findSetlistComment([]), null)
})

// --- Timestamp parsing ---

test('h:mm:ss and m:ss timestamps sort correctly when merging', () => {
  const late = comment('1:05:00 曲X\n1:10:00 曲Y\n1:15:00 曲Z', { author: '@KL-gr1my' })
  const early = comment('7:41 曲A\n15:00 曲B\n22:00 曲C', { author: '@KL-gr1my' })
  const r = findSetlistComment([late, early])
  assert.ok(r.text.indexOf('曲A') < r.text.indexOf('曲X'), 'm:ss part sorts before 1:05:00 part')
})
