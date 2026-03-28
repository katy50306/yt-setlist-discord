import { processVideo, checkChannels, searchAndProcess } from './core.js'
import { CONFIG } from './config.js'

const args = process.argv.slice(2)

function getArg(name) {
  const idx = args.indexOf(name)
  if (idx === -1) return null
  const val = args[idx + 1]
  if (!val || val.startsWith('--')) {
    console.error(`ERROR: ${name} requires a value`)
    process.exit(1)
  }
  return val
}

function printUsage() {
  console.log(`
yt-setlist-discord - Auto-detect setlist comments from YouTube videos

Usage:
  node src/index.js --video <videoId> [--dry-run]    Process a single video
  node src/index.js --check [--dry-run]              Check all channels (latest)
  node src/index.js --from <date> [--to <date>] [--dry-run]
                                                     Search by date range (100 units/channel)
  node src/index.js                                  Start service (cron + HTTP)

Options:
  --video <id>     Process a specific YouTube video ID
  --check          Check all configured channels for new videos
  --from <date>    Search start date (YYYY-MM-DD), requires --from
  --to <date>      Search end date (YYYY-MM-DD, default: today)
  --dry-run        Detect setlist but don't send to Discord
  --help           Show this help message
`)
}

async function main() {
  if (args.includes('--help') || args.includes('-h')) {
    printUsage()
    return
  }

  const dryRun = args.includes('--dry-run')
  const videoId = getArg('--video')
  const from = getArg('--from')

  if (videoId) {
    const result = await processVideo(videoId, { dryRun })
    if (!result.found) process.exit(1)
    return
  }

  if (from) {
    const to = getArg('--to')
    await searchAndProcess(from, to, { dryRun })
    return
  }

  if (args.includes('--check')) {
    await checkChannels({ dryRun })
    return
  }

  if (args.length === 0) {
    const { startScheduler } = await import('./scheduler.js')
    const { startServer } = await import('./server.js')

    console.log(`yt-setlist-discord service starting`)
    console.log(`  Cron: ${CONFIG.cron.schedule}`)
    console.log(`  Manage channels: /channels`)

    startScheduler()
    startServer()
    return
  }

  console.error(`Unknown arguments: ${args.join(' ')}`)
  printUsage()
  process.exit(1)
}

main().catch(err => {
  console.error('Fatal error:', err.message)
  process.exit(1)
})
