const aliases = {
  technology: 'Technology', tech: 'Technology', energy: 'Energy',
  financials: 'Financials', 'financial services': 'Financials', finance: 'Financials',
  healthcare: 'Healthcare', 'health care': 'Healthcare',
  industrials: 'Industrials', 'capital goods': 'Industrials', transportation: 'Industrials',
  'consumer cyclical': 'Consumer Cyclical', 'consumer discretionary': 'Consumer Cyclical', 'consumer services': 'Consumer Cyclical', 'consumer durables': 'Consumer Cyclical',
  'consumer defensive': 'Consumer Defensive', 'consumer staples': 'Consumer Defensive', 'consumer non-durables': 'Consumer Defensive',
  'communication services': 'Communication Services', telecommunications: 'Communication Services',
  utilities: 'Utilities', 'public utilities': 'Utilities', 'real estate': 'Real Estate',
  'basic materials': 'Basic Materials', materials: 'Basic Materials',
  miscellaneous: 'Other', other: 'Other',
}
export function normalizeSector(value) {
  return typeof value === 'string' ? aliases[value.trim().toLowerCase()] : undefined
}
export function sectorMetadata(row = {}) {
  const sector = normalizeSector(row.sector)
  return sector ? { sector, sectorSource: row.sectorSource, sectorAsOf: row.sectorAsOf } : {}
}
