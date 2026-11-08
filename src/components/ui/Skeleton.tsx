import type { CSSProperties } from 'react'

interface SkeletonProps {
  className?: string
  style?: CSSProperties
  /** Accesible: anuncia carga a lectores de pantalla */
  label?: string
}

export function Skeleton({ className = '', style, label }: SkeletonProps) {
  return (
    <span
      className={`skeleton ${className}`.trim()}
      style={style}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'status' : undefined}
    />
  )
}

interface MoneyListSkeletonProps {
  rows?: number
  /** Incluye un importe a la derecha (listas de dinero) */
  withAmount?: boolean
}

/** Placeholder de filas tipo money-list (Inicio / Movimientos / Cuentas). */
export function MoneyListSkeleton({ rows = 5, withAmount = true }: MoneyListSkeletonProps) {
  return (
    <div className="money-list skeleton-list" role="status" aria-label="Cargando lista">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="money-row skeleton-row" aria-hidden>
          <span className="skeleton skeleton-dot" />
          <span className="money-row-main skeleton-main">
            <span className="skeleton skeleton-line skeleton-line-title" />
            <span className="skeleton skeleton-line skeleton-line-meta" />
          </span>
          {withAmount ? <span className="skeleton skeleton-line skeleton-line-amount" /> : null}
        </div>
      ))}
    </div>
  )
}

/** Bloque patrimonio + recientes en Inicio. */
export function HomeLoadingSkeleton() {
  return (
    <div className="stack-md" role="status" aria-label="Cargando inicio">
      <div className="home-hero skeleton-hero" aria-hidden>
        <span className="skeleton skeleton-line skeleton-line-label" />
        <span className="skeleton skeleton-line skeleton-line-hero" />
        <span className="skeleton skeleton-line skeleton-line-meta" />
      </div>
      <div className="home-period" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className="home-period-cell">
            <span className="skeleton skeleton-line skeleton-line-label" />
            <span className="skeleton skeleton-line skeleton-line-period" />
            <span className="skeleton skeleton-line skeleton-line-meta" />
          </div>
        ))}
      </div>
      <div className="card skeleton-card">
        <div className="section-head" aria-hidden>
          <span className="skeleton skeleton-line skeleton-line-section" />
        </div>
        <MoneyListSkeleton rows={4} />
      </div>
    </div>
  )
}
