import { useId, useMemo, useState } from 'react'
import { Card } from '@/components/ui/Card'
import type { PeriodSummary, PeriodTrend } from '@/lib/analysis'
import { formatMoney } from '@/lib/currency'

interface PeriodReportChartProps {
  summary: PeriodSummary
  trend: PeriodTrend
  currency: string
  rangeLabel: string
}

export function PeriodReportChart({
  summary,
  trend,
  currency,
  rangeLabel,
}: PeriodReportChartProps) {
  const gradientId = useId().replace(/:/g, '')
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const barMax = Math.max(summary.income, summary.expense, 0.01)
  const incomePct = Math.round((summary.income / barMax) * 100)
  const expensePct = Math.round((summary.expense / barMax) * 100)

  const chart = useMemo(() => {
    const width = 320
    const height = 148
    const padX = 8
    const padTop = 12
    const padBottom = 28
    const plotW = width - padX * 2
    const plotH = height - padTop - padBottom
    const points = trend.points

    if (points.length === 0) {
      return {
        width,
        height,
        path: '',
        area: '',
        zeroY: padTop + plotH / 2,
        markers: [] as {
          x: number
          y: number
          index: number
        }[],
        ticks: [] as { x: number; label: string }[],
        min: 0,
        max: 0,
      }
    }

    const values = points.map((p) => p.cumulative)
    const rawMin = Math.min(0, ...values)
    const rawMax = Math.max(0, ...values)
    const span = Math.max(rawMax - rawMin, 1)
    const max = rawMax === 0 && rawMin === 0 ? 1 : rawMax + span * 0.08
    const min = rawMax === 0 && rawMin === 0 ? -1 : rawMin - span * 0.08
    const rangeY = max - min || 1

    const coords = points.map((p, i) => {
      const x =
        points.length === 1
          ? padX + plotW / 2
          : padX + (i / (points.length - 1)) * plotW
      const y = padTop + ((max - p.cumulative) / rangeY) * plotH
      return { x, y, index: i }
    })

    const path = coords
      .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(' ')
    const baselineY = padTop + ((max - 0) / rangeY) * plotH
    const first = coords[0]!
    const last = coords[coords.length - 1]!
    const area = `${path} L${last.x.toFixed(1)} ${baselineY.toFixed(1)} L${first.x.toFixed(1)} ${baselineY.toFixed(1)} Z`

    const tickIndexes =
      points.length <= 4
        ? points.map((_, i) => i)
        : [
            0,
            Math.round((points.length - 1) / 3),
            Math.round(((points.length - 1) * 2) / 3),
            points.length - 1,
          ]

    const ticks = [...new Set(tickIndexes)].map((i) => ({
      x: coords[i]!.x,
      label: points[i]!.label,
    }))

    return {
      width,
      height,
      path,
      area,
      zeroY: baselineY,
      markers: coords,
      ticks,
      min,
      max,
    }
  }, [trend.points])

  const active = hoverIndex != null ? trend.points[hoverIndex] : null
  const endBalance = trend.points[trend.points.length - 1]?.cumulative ?? 0
  const positiveEnd = endBalance >= 0
  const grainLabel = trend.granularity === 'week' ? 'semanal' : 'diario'
  const hasActivity = summary.count > 0

  return (
    <Card className="period-chart-card">
      <div className="section-head">
        <div>
          <h2 style={{ fontSize: '1rem', margin: 0 }}>Gráfico del periodo</h2>
          <p className="muted" style={{ fontSize: '0.75rem', margin: '0.25rem 0 0' }}>
            {rangeLabel} · balance acumulado {grainLabel}
          </p>
        </div>
      </div>

      <div className="period-vs-bars" aria-hidden={!hasActivity}>
        <div className="period-vs-col">
          <div className="period-vs-track">
            <div
              className="period-vs-fill period-vs-fill-income"
              style={{ height: `${hasActivity ? Math.max(incomePct, 4) : 4}%` }}
            />
          </div>
          <p className="label muted period-vs-label">Ingresos</p>
          <p className="amount amount-income period-vs-value">
            {formatMoney(summary.income, currency)}
          </p>
        </div>
        <div className="period-vs-col">
          <div className="period-vs-track">
            <div
              className="period-vs-fill period-vs-fill-expense"
              style={{ height: `${hasActivity ? Math.max(expensePct, 4) : 4}%` }}
            />
          </div>
          <p className="label muted period-vs-label">Gastos</p>
          <p className="amount amount-expense period-vs-value">
            {formatMoney(summary.expense, currency)}
          </p>
        </div>
      </div>

      {!hasActivity ? (
        <p className="muted" style={{ fontSize: '0.85rem', margin: '0.85rem 0 0' }}>
          Sin movimientos en este periodo: el gráfico se llenará al registrar ingresos o
          gastos.
        </p>
      ) : (
        <div className="period-trend">
          <div className="period-trend-head">
            <p className="label muted" style={{ fontSize: '0.7rem', margin: 0 }}>
              Balance acumulado
            </p>
            <p
              className={`amount${positiveEnd ? ' amount-income' : ' amount-expense'}`}
              style={{ margin: 0, fontSize: '0.9rem' }}
            >
              {active
                ? `${active.label}: ${formatMoney(active.cumulative, currency)}`
                : formatMoney(endBalance, currency)}
            </p>
          </div>

          <svg
            className="period-trend-svg"
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            role="img"
            aria-label={`Balance acumulado ${grainLabel} del periodo ${rangeLabel}. Cierre: ${formatMoney(endBalance, currency)}.`}
            onMouseLeave={() => setHoverIndex(null)}
          >
            <defs>
              <linearGradient id={`trend-fill-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={positiveEnd ? 'var(--success)' : '#f87171'}
                  stopOpacity="0.35"
                />
                <stop
                  offset="100%"
                  stopColor={positiveEnd ? 'var(--success)' : '#f87171'}
                  stopOpacity="0.02"
                />
              </linearGradient>
            </defs>

            <line
              className="period-trend-zero"
              x1="8"
              x2={chart.width - 8}
              y1={chart.zeroY}
              y2={chart.zeroY}
            />

            {chart.area ? (
              <path
                d={chart.area}
                fill={`url(#trend-fill-${gradientId})`}
                className="period-trend-area"
              />
            ) : null}
            {chart.path ? (
              <path
                d={chart.path}
                fill="none"
                stroke={positiveEnd ? 'var(--success)' : '#f87171'}
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="period-trend-line"
              />
            ) : null}

            {chart.markers.map((m) => (
              <circle
                key={trend.points[m.index]!.key}
                cx={m.x}
                cy={m.y}
                r={hoverIndex === m.index ? 4.5 : trend.points.length <= 14 ? 3 : 0}
                className="period-trend-dot"
                fill={positiveEnd ? 'var(--success)' : '#f87171'}
                opacity={hoverIndex === m.index || trend.points.length <= 14 ? 1 : 0}
              />
            ))}

            {/* hit targets */}
            {chart.markers.map((m) => (
              <rect
                key={`hit-${trend.points[m.index]!.key}`}
                x={m.x - (chart.markers.length > 1 ? chart.width / chart.markers.length / 2 : 24)}
                y={0}
                width={
                  chart.markers.length > 1
                    ? Math.max(chart.width / chart.markers.length, 16)
                    : 48
                }
                height={chart.height}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(m.index)}
                onFocus={() => setHoverIndex(m.index)}
                tabIndex={0}
                role="presentation"
              />
            ))}

            {chart.ticks.map((tick) => (
              <text
                key={`${tick.x}-${tick.label}`}
                x={tick.x}
                y={chart.height - 8}
                textAnchor="middle"
                className="period-trend-tick"
              >
                {tick.label}
              </text>
            ))}
          </svg>

          <div className="period-trend-legend" aria-hidden="true">
            <span>
              <i className="period-legend-swatch period-legend-income" /> Ingresos
            </span>
            <span>
              <i className="period-legend-swatch period-legend-expense" /> Gastos
            </span>
            <span>
              <i className="period-legend-swatch period-legend-trend" /> Acumulado
            </span>
          </div>
        </div>
      )}
    </Card>
  )
}
