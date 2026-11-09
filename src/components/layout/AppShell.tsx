import type { ComponentType } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { NotificationBell } from '@/components/NotificationBell'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { PageTransition } from '@/components/layout/PageTransition'
import {
  IconAccounts,
  IconAnalysis,
  IconBell,
  IconCalendar,
  IconCategories,
  IconGoals,
  IconHealth,
  IconHome,
  IconMore,
  IconMovements,
  IconPlan,
  IconPlus,
  IconReports,
  IconSettings,
  IconTags,
  IconTemplates,
  type IconProps,
} from '@/components/layout/icons'

const railLinks: {
  to: string
  label: string
  end?: boolean
  Icon: ComponentType<IconProps>
}[] = [
  { to: '/', label: 'Inicio', end: true, Icon: IconHome },
  { to: '/movimientos', label: 'Movimientos', Icon: IconMovements },
  { to: '/analisis', label: 'Análisis', Icon: IconAnalysis },
  { to: '/informes', label: 'Informes', Icon: IconReports },
  { to: '/calendario', label: 'Calendario', Icon: IconCalendar },
  { to: '/recordatorios', label: 'Recordatorios', Icon: IconBell },
  { to: '/cuentas', label: 'Cuentas', Icon: IconAccounts },
  { to: '/categorias', label: 'Categorías', Icon: IconCategories },
  { to: '/etiquetas', label: 'Etiquetas', Icon: IconTags },
  { to: '/plantillas', label: 'Plantillas', Icon: IconTemplates },
  { to: '/objetivos', label: 'Objetivos', Icon: IconGoals },
  { to: '/planificacion', label: 'Planificación', Icon: IconPlan },
  { to: '/centro-financiero', label: 'Centro financiero', Icon: IconHealth },
  { to: '/ajustes', label: 'Ajustes', Icon: IconSettings },
]

export function AppShell() {
  const navigate = useNavigate()
  const { profile, configured } = useAuth()

  return (
    <div className="app-shell">
      <aside className="side-rail" aria-label="Navegación principal">
        <div className="brand-mark">ControlaTusFinanzas</div>
        <nav aria-label="Secciones de la app">
          {railLinks.map(({ Icon, ...link }) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `rail-link${isActive ? ' active' : ''}`}
            >
              <span className="rail-link-icon" aria-hidden>
                <Icon />
              </span>
              <span className="rail-link-label">{link.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="rail-fab">
          <Button
            block
            onClick={() => navigate('/movimientos?nuevo=1&quick=expense')}
            aria-label="Añadir movimiento"
          >
            <IconPlus /> Añadir
          </Button>
        </div>
      </aside>

      <div className="app-main">
        <header className="top-bar">
          <div className="brand-mark">ControlaTusFinanzas</div>
          <div className="top-bar-actions">
            <NotificationBell />
            <span className="chip chip-active" aria-label={`Moneda ${profile?.currency ?? 'EUR'}`}>
              {profile?.currency ?? 'EUR'}
              {!configured ? ' · demo' : ''}
            </span>
          </div>
        </header>

        <PageTransition />
      </div>

      <nav className="bottom-nav" aria-label="Navegación móvil">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          aria-label="Inicio"
        >
          <IconHome aria-hidden />
          <span>Inicio</span>
        </NavLink>
        <NavLink
          to="/movimientos"
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          aria-label="Movimientos"
        >
          <IconMovements aria-hidden />
          <span>Movimientos</span>
        </NavLink>
        <div className="nav-fab-slot">
          <button
            type="button"
            className="fab"
            aria-label="Añadir movimiento"
            onClick={() => navigate('/movimientos?nuevo=1&quick=expense')}
          >
            <IconPlus aria-hidden />
          </button>
        </div>
        <NavLink
          to="/analisis"
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          aria-label="Análisis"
        >
          <IconAnalysis aria-hidden />
          <span>Análisis</span>
        </NavLink>
        <NavLink
          to="/mas"
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          aria-label="Más opciones"
        >
          <IconMore aria-hidden />
          <span>Más</span>
        </NavLink>
      </nav>
    </div>
  )
}
