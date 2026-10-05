const TIME_ZONE = 'America/New_York'

// Officiële NYSE-sluitingsdagen voor de gepubliceerde kalenders 2026–2028.
const HOLIDAYS = new Set([
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25',
  '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31',
  '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
  '2028-01-17', '2028-02-21', '2028-04-14', '2028-05-29', '2028-06-19',
  '2028-07-04', '2028-09-04', '2028-11-23', '2028-12-25',
])

// Op deze dagen sluit de reguliere NYSE-sessie om 13:00 ET.
const EARLY_CLOSES = new Set([
  '2026-11-27', '2026-12-24',
  '2027-11-26',
  '2028-07-03', '2028-11-24',
])

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  hour: '2-digit', hourCycle: 'h23',
})

function partsAt(date) {
  return Object.fromEntries(formatter.formatToParts(date)
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, part.value]))
}

export function nyseSyncWindow(date = new Date()) {
  const parts = partsAt(date)
  const marketDate = `${parts.year}-${parts.month}-${parts.day}`
  const hour = Number(parts.hour)
  const isWeekday = !['Sat', 'Sun'].includes(parts.weekday)
  const isHoliday = HOLIDAYS.has(marketDate)
  const closeHour = EARLY_CLOSES.has(marketDate) ? 13 : 16
  const shouldSync = isWeekday && !isHoliday && hour >= 4 && hour <= closeHour
  const reason = !isWeekday ? 'weekend'
    : isHoliday ? 'NYSE-feestdag'
      : hour < 4 ? 'voor pre-market'
        : hour > closeHour ? 'na beurssessie'
          : 'NYSE pre-market of reguliere sessie'

  return { shouldSync, reason, marketDate, hour, closeHour, timeZone: TIME_ZONE }
}
