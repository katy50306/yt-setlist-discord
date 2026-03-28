import cron from 'node-cron'
import { CONFIG } from './config.js'
import { checkChannels } from './core.js'

/**
 * Start the cron scheduler.
 * Runs checkChannels immediately on start, then on the configured schedule.
 */
export function startScheduler() {
  const schedule = CONFIG.cron.schedule

  console.log(`Scheduler started: ${schedule}`)

  cron.schedule(schedule, () => {
    checkChannels().catch(err => {
      console.error('Scheduled check failed:', err.message)
    })
  })
}
