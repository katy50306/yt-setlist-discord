import { CONFIG } from './config.js'

const MAX_LENGTH = 2000

/**
 * Split setlist text into chunks that fit within Discord's message limit.
 * Splits by line to avoid cutting a song entry in half.
 */
function splitSetlist(header, setlistText) {
  const lines = setlistText.split('\n')
  const chunks = []
  let current = ''

  for (const line of lines) {
    const test = current ? current + '\n' + line : line
    // Reserve space for header (first chunk) or code block markers
    const overhead = chunks.length === 0
      ? header.length + '\n```\n'.length + '\n```'.length
      : '```\n'.length + '\n```'.length
    if (overhead + test.length > MAX_LENGTH && current) {
      chunks.push(current)
      current = line
    } else {
      current = test
    }
  }
  if (current) chunks.push(current)

  return chunks
}

/**
 * Send a setlist comment to all configured Discord webhooks.
 * Automatically splits into multiple messages if the setlist exceeds 2000 chars.
 *
 * @param {{ id: string, title?: string, time?: string }} video
 * @param {string} setlistText - The raw setlist comment text
 * @param {string} author - Comment author display name
 */
export async function sendSetlistComment(video, setlistText, author) {
  const urls = CONFIG.webhookUrls
  if (urls.length === 0) return

  const videoUrl = `<https://www.youtube.com/watch?v=${video.id}>`
  const safeAuthor = (author || '匿名').replace(/@/g, '@\u200B')

  let timeStr = ''
  if (video.time) {
    const tz = CONFIG.timezone
    const d = new Date(video.time)
    const formatted = d.toLocaleString('en-US', {
      timeZone: tz,
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
    const tzAbbr = d.toLocaleString('en-US', { timeZone: tz, timeZoneName: 'short' }).split(' ').pop()
    timeStr = `${formatted} (${tzAbbr})`
  }

  const headerLine = [timeStr, video.title || ''].filter(Boolean).join(' ')
  const header = `━━━━━━━━━━━━━━━━━━━━\n${headerLine}\n${videoUrl}\nセトリ by ${safeAuthor}`

  const chunks = splitSetlist(header, setlistText)

  // Build messages
  const messages = chunks.map((chunk, i) => {
    if (i === 0) return `${header}\n\`\`\`\n${chunk}\n\`\`\``
    return `\`\`\`\n${chunk}\n\`\`\``
  })

  let totalSent = 0
  let totalFailed = 0

  for (let i = 0; i < messages.length; i++) {
    const body = JSON.stringify({ content: messages[i] })
    const results = await Promise.allSettled(
      urls.map(url =>
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
      )
    )
    for (const r of results) {
      if (r.status === 'rejected' || !r.value.ok) {
        totalFailed++
        const reason = r.status === 'rejected' ? r.reason.message : `HTTP ${r.value.status}`
        console.error(`  Webhook failed: ${reason}`)
      } else {
        totalSent++
      }
    }

    if (i < messages.length - 1) await new Promise(r => setTimeout(r, 200))
  }

  console.log(`Setlist sent: ${messages.length} message(s) to ${urls.length} webhook(s)` +
    (totalFailed > 0 ? ` (${totalFailed} failed)` : ''))
}
