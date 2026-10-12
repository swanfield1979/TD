import { useEffect, useRef } from 'react'
import {
  CandlestickSeries,
  BaselineSeries,
  createSeriesMarkers,
  ColorType,
  LineSeries,
  createChart,
  type Time,
  type SeriesMarker,
} from 'lightweight-charts'
import type { BreakoutStock } from '../types/breakout'

export default function FinancialChart({ row }: { row: BreakoutStock }) {
  const container = useRef<HTMLDivElement>(null)
  const signature = JSON.stringify(row.chart)
  useEffect(() => {
    if (!container.current || !row.chart.length) return
    const chart = createChart(container.current, {
      autoSize: true,
      height: 310,
      layout: {
        background: { type: ColorType.Solid, color: '#141914' },
        textColor: '#9da69b',
      },
      grid: {
        vertLines: { color: '#222a22' },
        horzLines: { color: '#222a22' },
      },
      timeScale: { timeVisible: false },
      rightPriceScale: { borderColor: '#2c342b' },
    })
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: '#c7f36b',
      downColor: '#f29a92',
      wickUpColor: '#c7f36b',
      wickDownColor: '#f29a92',
      borderVisible: false,
    })
    candles.setData(row.chart.map((b) => ({ ...b, time: b.date as Time })))
    if (row.move)
      createSeriesMarkers<Time>(
        candles,
        [
          {
            time: row.move.start as Time,
            position: 'belowBar',
            color: '#c7f36b',
            shape: 'arrowUp',
            text: 'Start impuls',
          },
          {
            time: row.move.end as Time,
            position: 'aboveBar',
            color: '#c7f36b',
            shape: 'arrowDown',
            text: `Impuls +${row.move.pct.toFixed(1)}%`,
          },
        ].filter((m) =>
          row.chart.some((b) => b.date === m.time),
        ) as SeriesMarker<Time>[],
      )
    ;[10, 20, 50].forEach((p, index) => {
      const series = chart.addSeries(LineSeries, {
        color: ['#74a7ff', '#e8bd65', '#ba95db'][index],
        lineWidth: 1,
        title: `MA${p}`,
        priceLineVisible: false,
        lastValueVisible: false,
      })
      series.setData(
        row.chart.flatMap((b, i) =>
          i + 1 < p
            ? []
            : [
                {
                  time: b.date as Time,
                  value:
                    row.chart
                      .slice(i - p + 1, i + 1)
                      .reduce((s, x) => s + x.close, 0) / p,
                },
              ],
        ),
      )
    })
    if (row.base) {
      const base = chart.addSeries(BaselineSeries, {
        baseValue: { type: 'price', price: row.base.low },
        topFillColor1: 'rgba(199,243,107,0.09)',
        topFillColor2: 'rgba(199,243,107,0.09)',
        bottomFillColor1: 'transparent',
        bottomFillColor2: 'transparent',
        topLineColor: '#798951',
        bottomLineColor: '#798951',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      })
      base.setData(
        [
          { time: row.base.start as Time, value: row.base.high },
          { time: row.base.end as Time, value: row.base.high },
        ].filter((p) => row.chart.some((b) => b.date === p.time)),
      )
      candles.createPriceLine({
        price: row.base.low,
        color: '#798951',
        lineWidth: 1,
        lineStyle: 2,
        title: 'Basislow',
      })
      candles.createPriceLine({
        price: row.base.high,
        color: '#c7f36b',
        lineWidth: 1,
        lineStyle: 2,
        title: 'Eerdere basishigh',
      })
    }
    chart.timeScale().fitContent()
    return () => chart.remove()
  }, [
    signature,
    row.base?.high,
    row.base?.low,
    row.base?.start,
    row.move?.start,
    row.move?.end,
  ])
  return (
    <div
      ref={container}
      className="bo-financial-chart"
      role="img"
      aria-label={`${row.symbol}: dagelijkse OHLC-candles, MA10, MA20, MA50 en eerdere basishigh`}
    />
  )
}
