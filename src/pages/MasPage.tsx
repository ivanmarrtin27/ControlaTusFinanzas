import { Link } from 'react-router-dom'

const links = [
  { to: '/cuentas', title: 'Cuentas', subtitle: 'Bancarias, efectivo, tarjetas' },
  { to: '/categorias', title: 'Categorías', subtitle: 'Ingresos y gastos' },
  { to: '/etiquetas', title: 'Etiquetas', subtitle: 'Tags en movimientos' },
  { to: '/plantillas', title: 'Plantillas', subtitle: 'Atajos rápidos de movimientos' },
  { to: '/movimientos?transferencia=1', title: 'Transferencias', subtitle: 'Mover dinero entre cuentas' },
  { to: '/objetivos', title: 'Objetivos', subtitle: 'Metas de ahorro' },
  { to: '/planificacion', title: 'Planificación', subtitle: 'Límites, recurrentes, deudas' },
  { to: '/calendario', title: 'Calendario', subtitle: 'Vencimientos y agenda' },
  { to: '/recordatorios', title: 'Recordatorios', subtitle: 'Avisos y notificaciones' },
  { to: '/informes', title: 'Informes', subtitle: 'Descargar PDF y Excel (.xlsx)' },
  { to: '/centro-financiero', title: 'Centro financiero', subtitle: 'Salud y previsión' },
  { to: '/ajustes', title: 'Ajustes', subtitle: 'Perfil, privacidad y PWA' },
  { to: '/privacidad', title: 'Privacidad', subtitle: 'Cómo tratamos tus datos' },
]

export function MasPage() {
  return (
    <main className="page">
      <header className="page-header">
        <h1>Más</h1>
        <p className="page-header-lead">Accede al resto de secciones de ControlaTusFinanzas.</p>
      </header>
      <div className="more-grid">
        {links.map((link) => (
          <Link key={link.to} className="more-link" to={link.to}>
            <div>
              <strong>{link.title}</strong>
              <div className="muted" style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                {link.subtitle}
              </div>
            </div>
            <span>Abrir</span>
          </Link>
        ))}
      </div>
    </main>
  )
}
