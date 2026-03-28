import { CONFIG } from './config.js'
import { verifyToken, AUTH_ERROR } from './auth.js'
import { handleRequest } from './routes.js'
import { processVideo, checkChannels, ensureChannelsResolved } from './core.js'
import { initStateAdapter } from './state.js'

export async function handler(event) {
  // Warmup
  if (event.source === 'warmup') {
    return { statusCode: 200, body: 'warm' }
  }

  // EventBridge scheduled event
  if (event.source === 'aws.events' || event['detail-type'] === 'Scheduled Event') {
    await initStateAdapter()
    const result = await checkChannels()
    return { statusCode: 200, body: JSON.stringify(result) }
  }

  // API Gateway — verify token
  const params = event.queryStringParameters || {}
  const token = params.token || event.headers?.authorization?.replace('Bearer ', '')
  if (!verifyToken(token)) {
    return { statusCode: 401, body: JSON.stringify(AUTH_ERROR) }
  }

  const path = event.rawPath || event.requestContext?.http?.path || '/check'
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET'
  const result = await handleRequest(path, {
    method,
    body: event.body || null,
    video: params.video,
    from: params.from,
    to: params.to,
    add: params.add,
    remove: params.remove,
    dryRun: params['dry-run'] === 'true',
  })
  if (result.html) {
    return { statusCode: result.status, body: result.body, headers: { 'Content-Type': 'text/html' } }
  }
  return { statusCode: result.status, body: JSON.stringify(result.body) }
}
