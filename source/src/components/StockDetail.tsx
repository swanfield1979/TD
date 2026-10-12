import type { BreakoutStock as Stock } from '../types/breakout'
import FinancialChart from './FinancialChart'
import { labels, number, percent } from '../utils/breakout-display'

export default function StockDetail({ row }: { row: Stock }) {
  const i = row.indicators,
    b = row.base,
    m = row.move
  return (
    <section
      className="bo-panel bo-detail"
      aria-label={`Setupdetails ${row.symbol}`}
    >
      <div className="bo-heading">
        <h2>
          {row.symbol}{' '}
          <small>
            {row.asOf} · ${number(row.close)}
          </small>
        </h2>
        <span className={`bo-status ${row.status}`}>{labels[row.status]}</span>
      </div>
      <FinancialChart row={row} />
      <p className="bo-muted">
        Candles: OHLC · blauw: MA10 · amber: MA20 · paars: MA50 · lijn:
        consolidatie vóór de laatste candle
      </p>
      <div className="bo-details">
        <article>
          <h3>01 · Voorafgaande impuls</h3>
          {m ? (
            <>
              <strong>{percent(m.pct)}</strong>
              <p>
                {m.start} → {m.end}
                <br />
                {m.sessions} handelssessies
              </p>
            </>
          ) : (
            <p>Geen kwalificerende impuls.</p>
          )}
        </article>
        <article>
          <h3>02 · Consolidatie</h3>
          {b ? (
            <dl>
              {Object.entries({
                'Start / einde': `${b.start} / ${b.end}`,
                Duur: `${b.sessions} sessies · ${number(b.weeks, 1)} weken`,
                'High / low': `${number(b.high)} / ${number(b.low)}`,
                Diepte: `${number(b.depthPct, 1)}%`,
                Rangecontractie: `${number(b.rangeRatio)}×`,
                Volatiliteitsratio: `${number(b.volatilityRatio)}×`,
                'Hogere swingbodems':
                  b.higherLows === null
                    ? 'Niet toetsbaar (te weinig pivots)'
                    : b.higherLows
                      ? 'Ja'
                      : 'Nee',
                'Bodems ordelijk': b.orderlyLows ? 'Ja' : 'Nee',
                'Range vernauwt': b.tighteningRange ? 'Ja' : 'Nee',
              }).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p>Geen consolidatie gevonden.</p>
          )}
        </article>
        <article>
          <h3>03 · Range-expansie</h3>
          {i && (
            <dl>
              {Object.entries({
                'ATR20 vóór laatste bar': number(i.atr20 as number),
                'Laatste true range': number(i.trueRange as number),
                Expansie: `${number(i.rangeExpansion as number)}×`,
                'Volume bevestigd':
                  i.volumeConfirmation === null
                    ? 'Volume ontbreekt'
                    : i.volumeConfirmation
                      ? 'Ja'
                      : 'Nee',
                'Afstand tot high': b
                  ? `${number(b.distanceToHighPct, 1)}%`
                  : '—',
              }).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </article>
      </div>
      {i && (
        <div className="bo-table-wrap">
          <table>
            <caption>
              Voortschrijdende gemiddelden · helling gemeten vóór de laatste
              candle
            </caption>
            <thead>
              <tr>
                <th>Gemiddelde</th>
                <th>Waarde</th>
                <th>Helling</th>
                <th>Koersafstand</th>
              </tr>
            </thead>
            <tbody>
              {[10, 20, 50].map((p) => (
                <tr key={p}>
                  <td>MA{p}</td>
                  <td>{number(i[`ma${p}`] as number)}</td>
                  <td>{percent(i[`slope${p}`] as number)}</td>
                  <td>{percent(i[`distance${p}`] as number)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!!row.reasons.length && (
        <ul className="bo-muted">
          {row.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
