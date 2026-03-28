// Load .env file in Node.js only; skip in Workers/Lambda
if (typeof globalThis.process?.versions?.node === 'string') {
  try { await import('dotenv/config') } catch {}
}

function parseJsonArray(envValue, name) {
  if (!envValue) return []
  try {
    const parsed = JSON.parse(envValue)
    if (!Array.isArray(parsed)) throw new Error('not an array')
    return parsed
  } catch {
    console.error(`ERROR: ${name} must be a valid JSON array, e.g. ["value1","value2"]`)
    console.error(`  Got: ${envValue}`)
    throw new Error(`Config error`)
  }
}

function validateRequired(env) {
  const missing = []
  if (!env.YOUTUBE_API_KEY) missing.push('YOUTUBE_API_KEY')
  if (!env.DISCORD_WEBHOOK_URLS) missing.push('DISCORD_WEBHOOK_URLS')
  if (!env.API_TOKEN) missing.push('API_TOKEN')

  if (missing.length > 0) {
    console.error('ERROR: Missing required environment variables:')
    missing.forEach(k => console.error(`  - ${k}`))
    console.error('\nSee .env.example for reference.')
    throw new Error(`Config error`)
  }
}

validateRequired(process.env)

const webhookUrls = parseJsonArray(process.env.DISCORD_WEBHOOK_URLS, 'DISCORD_WEBHOOK_URLS')
const preferredAuthors = parseJsonArray(process.env.PREFERRED_AUTHORS || '[]', 'PREFERRED_AUTHORS')
const extraKeywords = parseJsonArray(process.env.EXTRA_KEYWORDS || '[]', 'EXTRA_KEYWORDS')

if (webhookUrls.length === 0) {
  throw new Error('DISCORD_WEBHOOK_URLS must contain at least one webhook URL')
}

export const CONFIG = {
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY,
    apiBase: 'https://www.googleapis.com/youtube/v3',
    maxResults: 100,
    textFormat: 'plainText',
    playlistPrefix: process.env.PLAYLIST_PREFIX || 'UULV',
    searchMaxResults: parseInt(process.env.SEARCH_MAX_RESULTS, 10) || 50,
  },

  // Resolved channel IDs — populated from storage by ensureChannelsResolved()
  channelIds: [],

  webhookUrls,
  preferredAuthors,
  extraKeywords,

  setlistKeywords: [
    // Japanese
    'セットリスト', 'セトリ', '歌単', '歌リスト',
    '今日の歌', '本日の歌', '歌った曲',
    // English
    'setlist', 'set list', 'song list',
  ],

  commentFilter: {
    minTimestamps: 3,
    minLikes: parseInt(process.env.MIN_LIKES, 10) || 10,
    minLength: 100,
    minLines: 3,
    likeWeight: 2,
    lengthWeight: 0.1,
    preferredAuthorBonus: 50,
  },

  cron: {
    schedule: process.env.CRON_SCHEDULE || '0 0 * * *',
  },

  timezone: process.env.TIMEZONE || 'Asia/Tokyo',

  server: {
    port: parseInt(process.env.PORT, 10) || 3000,
    apiToken: process.env.API_TOKEN,
  },

  state: {
    filePath: process.env.STATE_FILE_PATH || './data/state.json',
    maxEntries: 500,
    retryWindowMs: 24 * 60 * 60 * 1000, // 24 hours
  },
}
