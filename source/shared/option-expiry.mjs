export function optionExpiry(value, name = '') {
  const explicit = String(value || '').replaceAll('-', '').slice(0, 8)
  const occ = String(name).match(/\s(\d{6})[CP]\d{8}$/)
  for (const digits of [explicit, occ ? `20${occ[1]}` : '']) {
    if (!/^\d{8}$/.test(digits)) continue
    const iso = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
    const date = new Date(`${iso}T12:00:00Z`)
    if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso) return iso
  }
  return null
}
