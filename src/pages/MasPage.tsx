import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { DeveloperCredit } from '@/components/DeveloperCredit'
import {
  IconAccounts,
  IconBell,
  IconCalendar,
  IconCategories,
  IconChevron,
  IconGoals,
  IconHealth,
  IconPlan,
  IconPrivacy,
  IconReports,
  IconSettings,
  IconTags,
  IconTemplates,
  IconTransfer,
  type IconProps,
} from '@/components/layout/icons'

const links: {
  to: string
  title: string
  subtitle: string
  Icon: ComponentType<IconProps>
}[] = [
  { to: '/cuentas', title: 'Cuentas', subtitle: 'Bancarias, efectivo, ahorro…', Icon: IconAccounts },
  { to: '/categorias', title: 'Categorías', subtitle: 'Ingresos y gastos', Icon: IconCategories },
  { to: '/etiquetas', title: 'Etiquetas', subtitle: 'Tags en movimientos', Icon: IconTags },
  { to: '/plantillas', title: 'Plantillas', subtitle: 'Atajos rápidos de movimientos', Icon: IconTemplates },
  {
    to: '/movimientos?transferencia=1',
    title: 'Transferencias',
    subtitle: 'Mover dinero entre cuentas',
    Icon: IconTransfer,
  },
  { to: '/objetivos', title: 'Objetivos', subtitle: 'Metas de ahorro', Icon: IconGoals },
  { to: '/planificacion', title: 'Planificación', subtitle: 'Límites, recurrentes, deudas e importar', Icon: IconPlan },
  { to: '/planificacion?tab=importar', title: 'Importar extracto', subtitle: 'CSV o Excel del banco → movimientos', Icon: IconReports },
  { to: '/calendario', title: 'Calendario', subtitle: 'Vencimientos y agenda', Icon: IconCalendar },
  { to: '/recordatorios', title: 'Recordatorios', subtitle: 'Avisos y notificaciones', Icon: IconBell },
  { to: '/informes', title: 'Informes', subtitle: 'Descargar PDF y Excel (.xlsx)', Icon: IconReports },
  { to: '/centro-financiero', title: 'Centro financiero', subtitle: 'Salud y previsión', Icon: IconHealth },
  { to: '/ajustes', title: 'Ajustes', subtitle: 'Perfil, privacidad y PWA', Icon: IconSettings },
  { to: '/privacidad', title: 'Privacidad', subtitle: 'Cómo tratamos tus datos', Icon: IconPrivacy },
]

export function MasPage() {
  return (
    <main className="page">
      <header className="page-header">
        <h1>Más</h1>
        <p className="page-header-lead">Resto de secciones.</p>
      </header>
      <div className="more-grid">
        {links.map((link) => (
          <Link key={link.to} className="more-link" to={link.to}>
            <span className="more-link-icon" aria-hidden>
              <link.Icon />
            </span>
            <div className="more-link-copy">
              <strong>{link.title}</strong>
              <div className="more-link-sub">{link.subtitle}</div>
            </div>
            <span className="more-link-chevron" aria-hidden>
              <IconChevron />
            </span>
          </Link>
        ))}
      </div>
      <footer className="page-credit">
        <DeveloperCredit />
      </footer>
    </main>
  )
}
