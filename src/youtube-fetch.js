import { CONFIG } from './config.js'

/**
 * Fetch from YouTube Data API v3.
 * Handles: URL construction, API key injection, error parsing.
 *
 * @param {string} endpoint - API endpoint (e.g. 'commentThreads', 'search')
 * @param {URLSearchParams} params - Query parameters (key is auto-added)
 * @param {string} errorLabel - Label for error messages
 * @returns {Promise<object>} - Parsed JSON response
 */
export async function ytApiFetch(endpoint, params, errorLabel) {
  params.set('key', CONFIG.youtube.apiKey)
  const url = `${CONFIG.youtube.apiBase}/${endpoint}?${params}`
  const response = await fetch(url)
  const data = await response.json()

  if (!response.ok) {
    const msg = data?.error?.message || `HTTP ${response.status}`
    throw new Error(`${errorLabel}: ${msg}`)
  }

  return data
}
