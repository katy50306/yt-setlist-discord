import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export function createFileAdapter(filePath) {
  return {
    name: 'file',

    async load() {
      try {
        return JSON.parse(readFileSync(filePath, 'utf-8'))
      } catch {
        return { processedVideos: {} }
      }
    },

    async save(state) {
      mkdirSync(dirname(filePath), { recursive: true })
      writeFileSync(filePath, JSON.stringify(state, null, 2))
    },
  }
}
