export async function scannerRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
    ...options,
    headers: {
      'X-Requested-With': 'trading-monitor',
      ...(options.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  }).catch(() => {
    throw new Error(
      'Scanner-API niet bereikbaar. Controleer de server en LAN-verbinding.',
    )
  })
  const body = await response.json().catch(() => {
    throw new Error(
      `Serverantwoord niet leesbaar (HTTP ${response.status}). Controleer de scanner-API.`,
    )
  })
  if (!response.ok) {
    const detail = body.detail ?? body.message
    throw new Error(
      typeof detail === 'string'
        ? detail +
          (body.error?.fields
            ? ' ' +
              body.error.fields
                .map(
                  (e: { field: string; message: string }) =>
                    `${e.field}: ${e.message}`,
                )
                .join('; ')
            : '')
        : Array.isArray(detail)
          ? detail.map((e: { msg: string }) => e.msg).join('; ')
          : `Scanner-aanvraag mislukt (HTTP ${response.status}).`,
    )
  }
  return body as T
}
