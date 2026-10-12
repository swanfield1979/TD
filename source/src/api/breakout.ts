export async function scannerRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    cache: 'no-store',
    ...options,
    headers: {
      'X-Requested-With': 'trading-monitor',
      ...(options.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  })
  const body = await response.json()
  if (!response.ok) {
    const detail = body.detail ?? body.message
    throw new Error(
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((e: { msg: string }) => e.msg).join('; ')
          : `Scanner-aanvraag mislukt (HTTP ${response.status}).`,
    )
  }
  return body as T
}
