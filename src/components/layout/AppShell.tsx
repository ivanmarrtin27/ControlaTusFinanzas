import { NavLink, useNavigate } from 'react-router-dom'
import { NotificationBell } from '@/components/NotificationBell'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { PageTransition } from '@/components/layout/PageTransition'
import {
  IconAnalysis,
  IconHome,
  IconMore,
  IconMovements,
  IconPlus,
} from '@/components/layout/icons'

const railLinks = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/movimientos', label: 'Movimientos' },
  { to: '/analisis', label: 'Análisis' },
  { to: '/informes', label: 'Informes' },
  { to: '/calendario', label: 'Calendario' },
  { to: '/recordatorios', label: 'Recordatorios' },
  { to: '/cuentas', label: 'Cuentas' },
  { to: '/categorias', label: 'Categorías' },
  { to: '/etiquetas', label: 'Etiquetas' },
  { to: '/plantillas', label: 'Plantillas' },
  { to: '/objetivos', label: 'Objetivos' },
  { to: '/planificacion', label: 'Planificación' },
  { to: '/centro-financiero', label: 'Centro financiero' },
  { to: '/ajustes', label: 'Ajustes' },
]

export function AppShell() {
  const navigate = useNavigate()
  const { profile, configured } = useAuth()

  return (
    <div className="app-shell">
      <aside className="side-rail" aria-label="Navegación principal">
        <div className="brand-mark">ControlaTusFinanzas</div>
        <nav aria-label="Secciones de la app">
          {railLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `rail-link${isActive ? ' active' : ''}`}
            >
              {link.label}
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
