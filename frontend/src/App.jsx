import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import AdminLayout from './components/AdminLayout'
import ColaboradorLayout from './components/ColaboradorLayout'
import ConsultorLayout from './components/ConsultorLayout'
import SuperAdminLayout from './components/SuperAdminLayout'
import { useContext } from 'react'
import { AuthContext } from './context/AuthContext'
import ProtectedRoute from './routes/ProtectedRoute'
import PWAInstallPrompt from './components/PWAInstallPrompt'




// Super Admin pages
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard'
import SuperAdminUsuarios from './pages/superadmin/SuperAdminUsuarios'
import SuperAdminAuditoriaLogs from './pages/superadmin/SuperAdminAuditoriaLogs'
import SuperAdminConfiguracion from './pages/superadmin/SuperAdminConfiguracion'
import SuperAdminContrasenas from './pages/superadmin/SuperAdminContrasenas'
import SuperAdminNorma from './pages/superadmin/SuperAdminNorma'
import SuperAdminDocumentos from './pages/superadmin/SuperAdminDocumentos'
import Notificaciones from './pages/shared/Notificaciones'

// Admin pages
import Dashboard from './pages/admin/Dashboard'
import DocumentosISO from './pages/admin/DocumentosISO'
import Auditorias from './pages/admin/Auditorias'
import MejoraContinua from './pages/admin/MejoraContinua'
import CalendarioAdmin from './pages/admin/CalendarioAdmin'
import UsuariosRoles from './pages/admin/UsuariosRoles'
import Configuracion from './pages/admin/Configuracion'
import Reportes from './pages/admin/Reportes'
import RiesgosAdmin from './pages/admin/RiesgosAdmin'

// Colaborador pages
import MiPanel from './pages/colaborador/MiPanel'
import Tareas from './pages/colaborador/Tareas'
import Reportar from './pages/colaborador/Reportar'
import Indicadores from './pages/colaborador/Indicadores'
import Capacitacion from './pages/colaborador/Capacitacion'
import RiesgosColaborador from './pages/colaborador/RiesgosColaborador'
import Hallazgos from './pages/colaborador/Hallazgos'
import Documentos from './pages/colaborador/Documentos'
import Calendario from './pages/colaborador/Calendario'

// Consultor pages
import ConsultorPanel from './pages/consultor/ConsultorPanel'
import ConsultorIndicadores from './pages/consultor/ConsultorIndicadores'
import ConsultorHallazgos from './pages/consultor/ConsultorHallazgos'
import ConsultorRiesgos from './pages/consultor/ConsultorRiesgos'
import ConsultorAuditorias from './pages/consultor/ConsultorAuditorias'
import ConsultorDocumentos from './pages/consultor/ConsultorDocumentos'
import ConsultorReportes from './pages/consultor/ConsultorReportes'

export default function App() {
  // 1. Extraemos el usuario del contexto
  const { user } = useContext(AuthContext);

  return (
    <BrowserRouter>
      <PWAInstallPrompt />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* 2. Consolidamos la ruta de login */}
        {/* Nota: Lo ideal es que el propio componente <Login /> maneje la redirección basada en el rol, 
            pero por ahora lo dejamos como lo tenías. */}
       {/* Reemplaza tu ruta actual de login por esta: */}
<Route 
  path="/login" 
  element={
    !user ? <Login /> : 
    user.role === 'SUPER_ADMIN' ? <Navigate to="/superadmin/dashboard" replace /> :
    user.role === 'ADMIN' ? <Navigate to="/admin/dashboard" replace /> :
    user.role === 'COLABORADOR' ? <Navigate to="/colaborador/mipanel" replace /> :
    user.role === 'CONSULTOR' ? <Navigate to="/consultor/panel" replace /> :
    <Navigate to="/" replace /> 
  } 
/>
        
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* Admin */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute user={user} role="ADMIN">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="documentos-iso" element={<DocumentosISO />} />
          <Route path="auditorias" element={<Auditorias />} />
          <Route path="mejora-continua" element={<MejoraContinua />} />
          <Route path="calendario" element={<CalendarioAdmin />} />
          <Route path="usuarios-roles" element={<UsuariosRoles />} />
          <Route path="configuracion" element={<Configuracion />} />
          <Route path="reportes" element={<Reportes />} />
          <Route path="riesgos" element={<RiesgosAdmin />} />
          <Route path="notificaciones" element={<Notificaciones />} />
        </Route>

        {/* Colaborador */}
        <Route
          path="/colaborador"
          element={
            <ProtectedRoute user={user} role="COLABORADOR">
              <ColaboradorLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/colaborador/mipanel" replace />} />
          <Route path="mipanel" element={<MiPanel />} />
          <Route path="documentos" element={<Documentos />} />
          <Route path="tareas" element={<Tareas />} />
          <Route path="reportar" element={<Reportar />} />
          <Route path="riesgos" element={<RiesgosColaborador />} />
          <Route path="hallazgos" element={<Hallazgos />} />
          <Route path="indicadores" element={<Indicadores />} />
          <Route path="capacitacion" element={<Capacitacion />} />
          <Route path="calendario" element={<Calendario />} />
          <Route path="notificaciones" element={<Notificaciones />} />
        </Route>

        {/* Consultor */}
        <Route
          path="/consultor"
          element={
            <ProtectedRoute user={user} role="CONSULTOR">
              <ConsultorLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/consultor/panel" replace />} />
          <Route path="panel" element={<ConsultorPanel />} />
          <Route path="indicadores" element={<ConsultorIndicadores />} />
          <Route path="hallazgos" element={<ConsultorHallazgos />} />
          <Route path="riesgos" element={<ConsultorRiesgos />} />
          <Route path="auditorias" element={<ConsultorAuditorias />} />
          <Route path="documentos" element={<ConsultorDocumentos />} />
          <Route path="reportes" element={<ConsultorReportes />} />
          <Route path="notificaciones" element={<Notificaciones />} />
        </Route>

        {/* Super Admin */}
        <Route
          path="/superadmin"
          element={
            <ProtectedRoute user={user} role="SUPER_ADMIN">
              <SuperAdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/superadmin/dashboard" replace />} />
          <Route path="dashboard" element={<SuperAdminDashboard />} />
          <Route path="usuarios" element={<SuperAdminUsuarios />} />
          <Route path="auditoria-logs" element={<SuperAdminAuditoriaLogs />} />
          <Route path="configuracion" element={<SuperAdminConfiguracion />} />
          <Route path="contrasenas" element={<SuperAdminContrasenas />} />
          <Route path="norma" element={<SuperAdminNorma />} />
          <Route path="documentos" element={<SuperAdminDocumentos />} />
          <Route path="notificaciones" element={<Notificaciones />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </BrowserRouter>
  )
}