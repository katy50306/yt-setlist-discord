const STATE_KEY = 'state'

export function createCloudflareKVAdapter(kvNamespace) {
  return {
    name: 'cloudflare-kv',

    async load() {
      const raw = await kvNamespace.get(STATE_KEY)
      if (!raw) return { processedVideos: {} }
      return JSON.parse(raw)
    },

    async save(state) {
      await kvNamespace.put(STATE_KEY, JSON.stringify(state))
    },
  }
}
