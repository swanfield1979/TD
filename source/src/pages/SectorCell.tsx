import type { SectorMetadata } from '../../shared/stock-sector.mjs'

export default function SectorCell({ value }: { value: SectorMetadata }) {
  const label = value.sector === 'Technology' ? 'Tech' : value.sector === 'Other' ? 'Overig' : value.sector || 'Onbekend'
  const description = [value.sectorSource, value.sectorAsOf ? new Date(value.sectorAsOf).toLocaleString('nl-NL') : undefined].filter(Boolean).join(' · ')
  return <td title={description || 'Geen sectorclassificatie beschikbaar'}>{label}</td>
}
