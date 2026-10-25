import { useState } from 'react'
import type { ReactNode } from 'react'

export default function ScanStepPanel({ id, step, title, summary, children }: {
  id: string; step: number; title: string; summary: string; children: ReactNode;
}) {
  const key = `tm-scan-step-${step}-expanded`
  const [expanded, setExpanded] = useState(() => {
    try { return localStorage.getItem(key) !== 'false' } catch { return true }
  })
  return <section className="monitor-panel stock-filter-panel" aria-labelledby={`${id}-title`}>
    <header className="scan-step-header">
      <h2 id={`${id}-title`}>{title}</h2>
      <span className="scan-step-summary">{summary}</span>
      <button type="button" aria-expanded={expanded} aria-controls={`${id}-content`} aria-label={`Stap ${step} ${expanded ? 'inklappen' : 'uitklappen'}`} onClick={() => {
        const next = !expanded
        setExpanded(next)
        try { localStorage.setItem(key, String(next)) } catch { /* Folding also works without storage. */ }
      }}>{expanded ? 'Inklappen' : 'Uitklappen'}</button>
    </header>
    <div id={`${id}-content`} hidden={!expanded}>{children}</div>
  </section>
}
