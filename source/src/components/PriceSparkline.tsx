import type { DailyBar } from '../types/breakout'

export default function PriceSparkline({
  bars,
  symbol,
}: {
  bars: DailyBar[]
  symbol: string
}) {
  const points = bars.slice(-30)
  if (points.length < 2) return <span>—</span>
  const low = Math.min(...points.map((b) => b.close)),
    high = Math.max(...points.map((b) => b.close))
  const line = points
    .map(
      (b, i) =>
        `${2 + (i * 92) / (points.length - 1)},${high === low ? 16 : 29 - ((b.close - low) * 26) / (high - low)}`,
    )
    .join(' ')
  return (
    <svg
      width="96"
      height="32"
      viewBox="0 0 96 32"
      role="img"
      aria-label={`${symbol}: laatste 30 slotkoersen`}
    >
      <polyline points={line} fill="none" stroke="#c7f36b" strokeWidth="1.5" />
    </svg>
  )
}
