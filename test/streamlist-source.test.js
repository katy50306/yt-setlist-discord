import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'

process.env.YOUTUBE_API_KEY = 'test-key'
process.env.DISCORD_WEBHOOK_URLS = '["https://example.com/webhook"]'
process.env.API_TOKEN = 'test-token'

const { CONFIG } = await import('../src/config.js')
const { getStreamlistVideoIds } = await import('../src/streamlist-source.js')

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
  CONFIG.streamlistApiUrl = ''
})

function mockFetch(handler) {
  globalThis.fetch = async (url) => handler(String(url))
}

const ok = (body) => ({ ok: true, json: async () => body })

test('disabled when no URL configured', async () => {
  CONFIG.streamlistApiUrl = ''
  globalThis.fetch = () => { throw new Error('must not be called') }
  assert.deepEqual(await getStreamlistVideoIds(3), [])
})

test('parses berry-site shape {data:[{streamID}]} and appends limit param', async () => {
  CONFIG.streamlistApiUrl = 'https://example.com/api/streamlist'
  let calledUrl
  mockFetch(url => {
    calledUrl = url
    return ok({ data: [{ streamID: 'vid1' }, { streamID: 'vid2' }] })
  })
  assert.deepEqual(await getStreamlistVideoIds(3), ['vid1', 'vid2'])
  assert.equal(calledUrl, 'https://example.com/api/streamlist?limit=3')
})

test('uses & separator when URL already has a query string', async () => {
  CONFIG.streamlistApiUrl = 'https://example.com/api?type=stream'
  let calledUrl
  mockFetch(url => { calledUrl = url; return ok([]) })
  await getStreamlistVideoIds(5)
  assert.equal(calledUrl, 'https://example.com/api?type=stream&limit=5')
})

test('supports top-level array and {data:{streams:[...]}} shapes', async () => {
  CONFIG.streamlistApiUrl = 'https://example.com/api'
  mockFetch(() => ok([{ videoId: 'a' }, { id: 'b' }]))
  assert.deepEqual(await getStreamlistVideoIds(3), ['a', 'b'])

  mockFetch(() => ok({ data: { streams: [{ streamID: 'c' }] } }))
  assert.deepEqual(await getStreamlistVideoIds(3), ['c'])
})

test('truncates to limit and drops entries without an id', async () => {
  CONFIG.streamlistApiUrl = 'https://example.com/api'
  mockFetch(() => ok({ data: [{ streamID: 'a' }, { note: 'no id' }, { streamID: 'b' }, { streamID: 'c' }] }))
  assert.deepEqual(await getStreamlistVideoIds(2), ['a', 'b'])
})

test('fail-open: HTTP error, network error, and non-array all return []', async () => {
  CONFIG.streamlistApiUrl = 'https://example.com/api'

  mockFetch(() => ({ ok: false, status: 500, json: async () => ({}) }))
  assert.deepEqual(await getStreamlistVideoIds(3), [])

  mockFetch(() => { throw new Error('ECONNREFUSED') })
  assert.deepEqual(await getStreamlistVideoIds(3), [])

  mockFetch(() => ok({ data: 'unexpected' }))
  assert.deepEqual(await getStreamlistVideoIds(3), [])
})
