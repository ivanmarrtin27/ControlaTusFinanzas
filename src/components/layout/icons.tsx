import type { SVGProps } from 'react'

/** Green Deck icon set — stroke 1.75, round caps, 24 viewBox. Size via `.icon`. */
export type IconProps = SVGProps<SVGSVGElement>

const defaults = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
  className: 'icon',
}

function mergeProps(props: IconProps): IconProps {
  const { className, ...rest } = props
  return {
    ...defaults,
    ...rest,
    className: className ? `icon ${className}` : 'icon',
  }
}

export function IconHome(props: IconProps) {
  return (
    <svg {...mergeProps(props)}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
    </svg>
  )
}

export function IconMovements(props: IconProps) {
  return (
    <svg {...mergeProps(props)}>
      <path d="M8 7h12M8 12h12M8 17h8" />
      <path d="M4 7h.01M4 12h.01M4 17h.01" />
    </svg>
  )
}

export function IconAnalysis(props: IconProps) {
  return (
    <svg {...mergeProps(props)}>
      <path d="M4 19V5M4 19h16" />
      <path d="M8 15v-4M12 15V8M16 15v-7" />
    </svg>
  )
}

export function IconMore(props: IconProps) {
  return (
    <svg {...mergeProps(props)}>
      <circle cx="6" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...mergeProps(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function IconExpense(props: IconProps) {
  return (
    <svg {...mergeProps(props)}>
      <path d="M12 5v14M12 19l-4-4M12 19l4-4" />
    </svg>
  )
}

export function IconIncome(props: IconProps) {
  return (
    <svg {...mergeProps(props)}>
      <path d="M12 19V5M12 5l-4 4M12 5l4 4" />
    </svg>
  )
}

export function IconTransfer(props: IconProps) {
  return (
    <svg {...mergeProps(props)}>
      <path d="M7 8h12M16 5l3 3-3 3" />
      <path d="M17 16H5M8 13l-3 3 3 3" />
    </svg>
  )
}

export function IconGoals(props: IconProps) {
  return (
    <svg {...mergeProps(props)}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconAccounts(props: IconProps) {
  return (
    <svg {...mergeProps(props)}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 14h4" />
    </svg>
  )
}

export function IconCategories(props: IconProps) {
  return (
    <svg {...mergeProps(props)}>
      <path d="M4 7h6v6H4zM14 7h6v2M14 12h6v2M14 17h6" />
    </svg>
  )
}

export function IconTags(props: IconProps) {
  return (
    <svg {...mergeProps(props)}>
      <path d="M3 12V5a1 1 0 0 1 1-1h7l9 9-7 7-9-9Z" />
      <circle cx="7.5" cy="7.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconTemplates(props: IconProps) {
  return (
    <svg {...mergeProps(props)}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  )
}

export function IconPlan(props: IconProps) {
  return (
    <svg {...mergeProps(props)}>
      <path d="M8 4h8a2 2 0 0 1 2 2v14l-6-3-6 3V6a2 2 0 0 1 2-2Z" />
      <path d="M10 9h4M10 13h3" />
    </svg>
  )
}

export function IconCalendar(props: IconProps) {
  return (
    <svg {...mergeProps(props)}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  )
}

export function IconBell(props: IconProps) {
  return (
    <svg {...mergeProps(props)}>
      <path d="M6 9a6 6 0 1 1 12 0c0 3.5 1.5 5 1.5 5H4.5S6 12.5 6 9Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  )
}

export function IconReports(props: IconProps) {
  return (
    <svg {...mergeProps(props)}>
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  )
}

export function IconHealth(props: IconProps) {
  return (
    <svg {...mergeProps(props)}>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
    </svg>
  )
}

export function IconSettings(props: IconProps) {
  return (
    <svg {...mergeProps(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.9 6.5l1.6 1.5M17.5 16l1.6 1.5M3.5 12h2.2M18.3 12h2.2M4.9 17.5l1.6-1.5M17.5 8l1.6-1.5" />
    </svg>
  )
}

export function IconPrivacy(props: IconProps) {
  return (
    <svg {...mergeProps(props)}>
      <path d="M12 3 5 6v5c0 4.5 3 8 7 9 4-1 7-4.5 7-9V6l-7-3Z" />
      <path d="M9.5 12.2 11 13.7l3.5-3.5" />
    </svg>
  )
}

export function IconChevron(props: IconProps) {
  return (
    <svg {...mergeProps(props)}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

export function IconClose(props: IconProps) {
  return (
    <svg {...mergeProps(props)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}
