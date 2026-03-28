import { createServer } from 'node:http'
import { CONFIG } from './config.js'
import { verifyToken, AUTH_ERROR } from './auth.js'
import { handleRequest } from './routes.js'

function readBody(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', c => data += c)
    req.on('end', () => resolve(data))
  })
}

export function startServer() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`)

    const token = url.searchParams.get('token')
      || req.headers.authorization?.replace('Bearer ', '')
    if (!verifyToken(token)) {
      res.setHeader('Content-Type', 'application/json')
      res.statusCode = 401
      res.end(JSON.stringify(AUTH_ERROR))
      return
    }

    try {
      const body = req.method === 'POST' ? await readBody(req) : null
      const params = {
        method: req.method,
        body,
        video: url.searchParams.get('video'),
        from: url.searchParams.get('from'),
        to: url.searchParams.get('to'),
        add: url.searchParams.get('add'),
        remove: url.searchParams.get('remove'),
        dryRun: url.searchParams.get('dry-run') === 'true',
      }
      const result = await handleRequest(url.pathname, params)
      if (result.html) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.statusCode = result.status
        res.end(result.body)
      } else {
        res.setHeader('Content-Type', 'application/json')
        res.statusCode = result.status
        res.end(JSON.stringify(result.body))
      }
    } catch (err) {
      console.error('HTTP handler error:', err.message)
      res.setHeader('Content-Type', 'application/json')
      res.statusCode = 500
      res.end(JSON.stringify({ error: err.message }))
    }
  })

  server.listen(CONFIG.server.port, () => {
    console.log(`HTTP server listening on port ${CONFIG.server.port}`)
    console.log(`  GET /channels          - Manage channels`)
    console.log(`  GET /check?video=<id>  - Process single video`)
    console.log(`  GET /check             - Check all channels`)
    console.log(`  GET /status            - Service status`)
  })

  return server
}
