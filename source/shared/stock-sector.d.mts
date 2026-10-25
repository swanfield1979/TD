export interface SectorMetadata { sector?: string; sectorSource?: string; sectorAsOf?: string }
export function normalizeSector(value: unknown): string | undefined
export function sectorMetadata(row?: SectorMetadata): SectorMetadata
