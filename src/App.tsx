/**
 * Rutas de ControlaTusFinanzas.
 * Auth públicas: login / registro / recuperar / privacidad.
 * El resto va bajo ProtectedRoute + AppShell (nav inferior / lateral).
 */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { AppShell } from '@/components/layout/AppShell'
import { QuickAddRedirect } from '@/components/QuickAddRedirect'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { InicioPage } from '@/pages/InicioPage'
import { MasPage } from '@/pages/MasPage'
import { AjustesPage } from '@/pages/AjustesPage'
import { CuentasPage } from '@/pages/CuentasPage'
import { CategoriasPage } from '@/pages/CategoriasPage'
import { EtiquetasPage } from '@/pages/EtiquetasPage'
import { PlantillasPage } from '@/pages/PlantillasPage'
import { MovimientosPage } from '@/pages/MovimientosPage'
import { ObjetivosPage } from '@/pages/ObjetivosPage'
import { PlanificacionPage } from '@/pages/PlanificacionPage'
import { AnalisisPage } from '@/pages/AnalisisPage'
import { CentroFinancieroPage } from '@/pages/CentroFinancieroPage'
import { CalendarioPage } from '@/pages/CalendarioPage'
import { RecordatoriosPage } from '@/pages/RecordatoriosPage'
import { InformesPage } from '@/pages/InformesPage'
import { PrivacidadPage } from '@/pages/PrivacidadPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { RecoverPage } from '@/pages/auth/RecoverPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/registro" element={<RegisterPage />} />
          <Route path="/auth/recuperar" element={<RecoverPage />} />
          <Route path="/privacidad" element={<PrivacidadPage />} />

          <Route
            element={
              <ProtectedRoute>
                <QuickAddRedirect />
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<InicioPage />} />
            <Route path="movimientos" element={<MovimientosPage />} />
            <Route path="analisis" element={<AnalisisPage />} />
            <Route path="informes" element={<InformesPage />} />
            <Route path="cuentas" element={<CuentasPage />} />
            <Route path="categorias" element={<CategoriasPage />} />
            <Route path="etiquetas" element={<EtiquetasPage />} />
            <Route path="plantillas" element={<PlantillasPage />} />
            <Route path="objetivos" element={<ObjetivosPage />} />
            <Route path="planificacion" element={<PlanificacionPage />} />
            <Route path="calendario" element={<CalendarioPage />} />
            <Route path="recordatorios" element={<RecordatoriosPage />} />
            <Route path="centro-financiero" element={<CentroFinancieroPage />} />
            <Route path="ajustes" element={<AjustesPage />} />
            <Route path="mas" element={<MasPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
