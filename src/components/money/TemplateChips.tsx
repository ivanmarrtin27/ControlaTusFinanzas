import { formatMoney } from '@/lib/currency'
import type { TransactionTemplate } from '@/types/database'

interface TemplateChipsProps {
  templates: TransactionTemplate[]
  currency?: string
  onSelect: (template: TransactionTemplate) => void
  emptyHint?: boolean
}

export function TemplateChips({
  templates,
  currency = 'EUR',
  onSelect,
  emptyHint = false,
}: TemplateChipsProps) {
  if (templates.length === 0) {
    if (!emptyHint) return null
    return (
      <p className="muted" style={{ fontSize: '0.8rem', margin: 0 }}>
        Sin plantillas. Créalas en Más → Plantillas.
      </p>
    )
  }

  return (
    <div className="chip-row template-chips" role="group" aria-label="Plantillas rápidas">
      {templates.map((tpl) => (
        <button
          key={tpl.id}
          type="button"
          className="chip"
          onClick={() => onSelect(tpl)}
          title={`${tpl.name} · ${formatMoney(tpl.amount, currency)}`}
        >
          <span>{tpl.name}</span>
          <span className="mono" style={{ opacity: 0.75, marginLeft: '0.35rem', fontSize: '0.75rem' }}>
            {formatMoney(tpl.amount, currency)}
          </span>
        </button>
      ))}
    </div>
  )
}
