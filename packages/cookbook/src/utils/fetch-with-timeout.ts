export async function fetchWithTimeout(url: string, options: FetchRequestInit & { timeout?: number } = {}) {
  const { timeout = 8000 } = options

  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  const response = await fetch(url, {
    ...options,
    signal: controller.signal,
  })
  clearTimeout(id)
  return response
}
