export async function scanResponse(response) {
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const hint = response.status === 403 ? 'Het site-adres is niet toegestaan voor scan-aanvragen; controleer IBKR_ALLOWED_ORIGINS.'
      : response.status === 404 ? 'De server-API mist de scanroute; werk de backend bij en herstart de API.'
      : response.status === 502 || response.status === 503 ? 'De server-API is niet bereikbaar; controleer trading-monitor-api.service.'
      : body?.message || 'De server kon de scan-aanvraag niet verwerken.'
    throw new Error(`HTTP ${response.status}: ${hint}`)
  }
  if (!body || !Array.isArray(body.portfolio) || !Array.isArray(body.market)) throw new Error('De scan-API retourneert geen geldig scanresultaat; controleer de serverinstallatie.')
  return body
}

export function scanWarningSummary(warnings) {
  const counts = new Map()
  for (const warning of warnings) {
    const label = warning.includes('MOST_ACTIVE') ? 'IV-scanner niet beschikbaar; actieve aandelen worden gebruikt als shortlist.'
      : /aandelenkoers ontbreekt/.test(warning) ? 'Aandelenkoersen ontbreken; controleer marktdatarechten en beschikbaarheid buiten beursuren.'
      : /IV|IVR|jaarhistorie/.test(warning) ? 'IV of IV-historie ontbreekt; IVR kan niet worden gecontroleerd.'
      : /bied\/laat\/greeks|354|10089|10168|10186/.test(warning) ? 'Optiekoersen, Greeks of benodigde marktdatarechten ontbreken.'
      : /disabled|uitgeschakeld/.test(warning) ? 'Een IBKR-marktscanner is niet beschikbaar.'
      : 'Andere aanvragen zijn overgeslagen wegens onvolledige marktdata of dekking.'
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts].map(([label, count]) => ({ label, count }))
}
