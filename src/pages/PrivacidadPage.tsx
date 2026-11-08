import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'

export function PrivacidadPage() {
  return (
    <main className="page">
      <header className="page-header">
        <h1>Privacidad</h1>
        <p className="page-header-lead">Tratamiento de datos personales.</p>
      </header>

      <div className="stack-md" style={{ maxWidth: '40rem' }}>
        <Card>
          <h2 style={{ fontSize: '1rem' }}>Resumen</h2>
          <p className="muted" style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
            ControlaTusFinanzas es una app gratuita de finanzas personales. Tus datos
            financieros (cuentas, movimientos, presupuestos, etc.) se guardan en{' '}
            <strong>Supabase</strong> (PostgreSQL) asociados a tu cuenta de usuario, con
            políticas RLS para que solo tú puedas leerlos o modificarlos.
          </p>
        </Card>

        <Card>
          <h2 style={{ fontSize: '1rem' }}>Qué datos tratamos</h2>
          <ul className="privacy-list">
            <li>Email y, si usas Google, datos básicos de identidad del proveedor.</li>
            <li>Preferencias de perfil (nombre, moneda, color de acento).</li>
            <li>Datos que introduces: cuentas, categorías, movimientos, transferencias, límites, recurrentes, objetivos, deudas y etiquetas.</li>
            <li>En el navegador: sesión, preferencias locales (acento, recordatorios descartados) y, si lo instalas, caché PWA.</li>
          </ul>
        </Card>

        <Card>
          <h2 style={{ fontSize: '1rem' }}>Qué no hacemos</h2>
          <ul className="privacy-list">
            <li>No vendemos tus datos.</li>
            <li>No conectamos con bancos (sin open banking).</li>
            <li>No enviamos push de pago a terceros; las notificaciones opcionales usan la API del navegador en tu dispositivo.</li>
            <li>No compartimos hogares ni presupuestos entre usuarios en esta versión.</li>
          </ul>
        </Card>

        <Card>
          <h2 style={{ fontSize: '1rem' }}>Conservación y borrado</h2>
          <p className="muted" style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
            Puedes exportar un backup JSON desde Ajustes. También puedes{' '}
            <Link to="/ajustes" className="text-link">
              eliminar tu cuenta
            </Link>
            : se borran tus filas de negocio y el usuario de autenticación. Tras el borrado,
            la acción no se puede deshacer.
          </p>
        </Card>

        <Card>
          <h2 style={{ fontSize: '1rem' }}>Contacto</h2>
          <p className="muted" style={{ fontSize: '0.9rem', margin: 0 }}>
            Si tienes dudas sobre privacidad, escribe al correo con el que te registraste
            o abre un issue en el repositorio del proyecto.
          </p>
        </Card>

        <p className="muted" style={{ fontSize: '0.8rem' }}>
          Última actualización: noviembre 2026 ·{' '}
          <Link to="/auth/login" className="text-link">
            Volver al acceso
          </Link>
        </p>
      </div>
    </main>
  )
}
