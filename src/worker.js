let initialized = false

function populateEnv(env) {
  if (initialized) return
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') {
      process.env[key] = value
    }
  }
  initialized = true
}

export default {
  async fetch(request, env) {
    populateEnv(env)

    const { verifyToken, AUTH_ERROR } = await import('./auth.js')
    const { handleRequest } = await import('./routes.js')

    const url = new URL(request.url)
    const token = url.searchParams.get('token')
      || request.headers.get('authorization')?.replace('Bearer ', '')

    if (!verifyToken(token)) {
      return Response.json(AUTH_ERROR, { status: 401 })
    }

    try {
      const body = request.method === 'POST' ? await request.text() : null
      const params = {
        method: request.method,
        body,
        video: url.searchParams.get('video'),
        from: url.searchParams.get('from'),
        to: url.searchParams.get('to'),
        add: url.searchParams.get('add'),
        remove: url.searchParams.get('remove'),
        dryRun: url.searchParams.get('dry-run') === 'true',
      }
      const result = await handleRequest(url.pathname, params, { kvNamespace: env.STATE_KV })
      if (result.html) {
        return new Response(result.body, { status: result.status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
      }
      return Response.json(result.body, { status: result.status })
    } catch (err) {
      console.error('Worker error:', err)
      return Response.json({ error: err.message }, { status: 500 })
    }
  },

  async scheduled(event, env, ctx) {
    populateEnv(env)

    const { initStateAdapter } = await import('./state.js')
    const { checkChannels } = await import('./core.js')
    await initStateAdapter(env.STATE_KV)
    await checkChannels()
  },
}
