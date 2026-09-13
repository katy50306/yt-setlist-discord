import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.YOUTUBE_API_KEY = 'test-key'
process.env.DISCORD_WEBHOOK_URLS = '["https://example.com/webhook"]'
process.env.API_TOKEN = 'test-token'
// @handle (resolved via API), raw channel ID (pass-through), plain name (string match only)
process.env.PREFERRED_AUTHORS = '["@KLバカ","UCaaaaaaaaaaaaaaaaaaaaaa","Plain Name"]'

const { resolvePreferredAuthors } = await import('../src/preferred-authors.js')
const { CONFIG } = await import('../src/config.js')

const KL_ID = 'UCKcGhLko2mzHMRI5IUcfMiA'

function lookupStub(map) {
  const calls = []
  const lookup = async (handle) => {
    calls.push(handle)
    if (map[handle] instanceof Error) throw map[handle]
    return map[handle] ?? null
  }
  return { lookup, calls }
}

test('resolves @handle via lookup, caches in state, passes UC… through', async () => {
  const state = {}
  const { lookup, calls } = lookupStub({ 'KLバカ': KL_ID })
  const r = await resolvePreferredAuthors(state, { lookup })
  assert.deepEqual(calls, ['KLバカ'])
  assert.equal(r.changed, true)
  assert.deepEqual(r.unresolved, [])
  assert.equal(state.preferredAuthors['@KLバカ'].channelId, KL_ID)
  assert.deepEqual([...CONFIG.preferredAuthorChannelIds].sort(), [KL_ID, 'UCaaaaaaaaaaaaaaaaaaaaaa'].sort())
})

test('cached handle is not looked up again (rename-proof)', async () => {
  const state = { preferredAuthors: { '@KLバカ': { channelId: KL_ID, resolvedAt: '2026-09-13T00:00:00Z' } } }
  // lookup would fail now (handle renamed) — cache must win
  const { lookup, calls } = lookupStub({})
  const r = await resolvePreferredAuthors(state, { lookup })
  assert.deepEqual(calls, [])
  assert.equal(r.changed, false)
  assert.deepEqual(r.unresolved, [])
  assert.ok(CONFIG.preferredAuthorChannelIds.includes(KL_ID))
})

test('unresolvable handle (renamed, never cached) is reported and left to name fallback', async () => {
  const state = {}
  const { lookup } = lookupStub({}) // returns null
  const r = await resolvePreferredAuthors(state, { lookup })
  assert.equal(r.changed, false)
  assert.deepEqual(r.unresolved, ['@KLバカ'])
  assert.equal(state.preferredAuthors['@KLバカ'], undefined)
  assert.deepEqual(CONFIG.preferredAuthorChannelIds, ['UCaaaaaaaaaaaaaaaaaaaaaa'])
})

test('lookup error does not throw, entry stays unresolved', async () => {
  const state = {}
  const { lookup } = lookupStub({ 'KLバカ': new Error('quota exceeded') })
  const r = await resolvePreferredAuthors(state, { lookup })
  assert.deepEqual(r.unresolved, ['@KLバカ'])
})
