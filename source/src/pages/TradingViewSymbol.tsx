export default function TradingViewSymbol({ symbol }: { symbol: string }) {
  const ticker = symbol.trim().toUpperCase().replace(/[ -]([A-Z])$/, '.$1')
  return <a className="tradingview-symbol" href={`https://www.tradingview.com/chart/fxY1us9e/?symbol=${encodeURIComponent(ticker)}`} target="_blank" rel="noopener noreferrer" title={`${symbol} bekijken in TradingView (nieuw venster)`}>{symbol}</a>
}
