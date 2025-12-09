import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import SocketProvider from './contexts/SocketContext';
import { KioskLayout, AdminLayout } from './components/layouts';
import { ProtectedRoute, Login, Unauthorized } from './components/auth';
import SessionManager from './components/auth/SessionManager';

// Loading fallback component
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1F3463] mx-auto mb-4"></div>
      <p className="text-gray-600">Loading...</p>
    </div>
  </div>
);

// Lazy load admin dashboard components
const MISAdminDashboard = lazy(() => import('./components/pages/admin').then(module => ({ default: module.MISAdminDashboard })));
const RegistrarAdminDashboard = lazy(() => import('./components/pages/admin').then(module => ({ default: module.RegistrarAdminDashboard })));
const AdmissionsAdminDashboard = lazy(() => import('./components/pages/admin').then(module => ({ default: module.AdmissionsAdminDashboard })));
const QueueMonitor = lazy(() => import('./components/pages/admin').then(module => ({ default: module.QueueMonitor })));

// Lazy load MIS Admin Pages
const MISUsers = lazy(() => import('./components/pages/admin/mis/Users'));
const FixUsers = lazy(() => import('./components/pages/admin/mis/FixUsers'));
const DatabaseManager = lazy(() => import('./components/pages/admin/mis/DatabaseManager'));
const MISAuditTrail = lazy(() => import('./components/pages/admin/mis/AuditTrail'));
const MISBulletin = lazy(() => import('./components/pages/admin/mis/Bulletin'));
const MISFAQ = lazy(() => import('./components/pages/admin/mis/FAQ'));
const MISRatings = lazy(() => import('./components/pages/admin/mis/Ratings'));

// Lazy load Registrar Admin Pages
const RegistrarQueue = lazy(() => import('./components/pages/admin/registrar/Queue'));
const RegistrarQueueRedirect = lazy(() => import('./components/pages/admin/registrar/QueueRedirect'));
const RegistrarQueueMonitor = lazy(() => import('./components/pages/admin/registrar/QueueMonitor'));
const RegistrarTransactionLogs = lazy(() => import('./components/pages/admin/registrar/TransactionLogs'));
const RegistrarDocumentRequest = lazy(() => import('./components/pages/admin/registrar/DocumentRequest'));
const RegistrarAuditTrail = lazy(() => import('./components/pages/admin/registrar/AuditTrail'));
const RegistrarSettings = lazy(() => import('./components/pages/admin/registrar/Settings'));

// Lazy load Admissions Admin Pages
const AdmissionsQueue = lazy(() => import('./components/pages/admin/admissions/Queue'));
const AdmissionsQueueRedirect = lazy(() => import('./components/pages/admin/admissions/QueueRedirect'));
const AdmissionsQueueMonitor = lazy(() => import('./components/pages/admin/admissions/QueueMonitor'));
const AdmissionsTransactionLogs = lazy(() => import('./components/pages/admin/admissions/TransactionLogs'));
const AdmissionsAuditTrail = lazy(() => import('./components/pages/admin/admissions/AuditTrail'));
const AdmissionsSettings = lazy(() => import('./components/pages/admin/admissions/Settings'));

// Lazy load Senior Management Admin Pages
const SeniorManagementCharts = lazy(() => import('./components/pages/admin/seniormanagement/Charts'));

// Lazy load Shared Admin Pages
const SharedFAQ = lazy(() => import('./components/pages/admin/shared/FAQ'));

// Lazy load Public Pages
const Home = lazy(() => import('./components/pages').then(module => ({ default: module.Home })));
const Bulletin = lazy(() => import('./components/pages').then(module => ({ default: module.Bulletin })));
const Map = lazy(() => import('./components/pages').then(module => ({ default: module.Map })));
const Directory = lazy(() => import('./components/pages').then(module => ({ default: module.Directory })));
const Queue = lazy(() => import('./components/pages').then(module => ({ default: module.Queue })));
const FAQ = lazy(() => import('./components/pages').then(module => ({ default: module.FAQ })));
const IdlePage = lazy(() => import('./components/pages').then(module => ({ default: module.IdlePage })));
const PortalQueue = lazy(() => import('./components/pages').then(module => ({ default: module.PortalQueue })));

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <SessionManager />
        <Router future={{ v7_relativeSplatPath: true }}>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
            {/* Public Kiosk Routes - No Authentication Required */}
            {/* Idle Page - Default Landing Page - No Layout Wrapper */}
            <Route path="/" element={<IdlePage />} />

            <Route path="/home" element={
              <KioskLayout>
                <Home />
              </KioskLayout>
            } />
            <Route path="/bulletin" element={
              <KioskLayout>
                <Bulletin />
              </KioskLayout>
            } />

            <Route path="/map" element={<Map />} />
            <Route path="/directory" element={<Directory />} />
            <Route path="/queue" element={<Queue />} />
            <Route path="/portalqueue" element={<PortalQueue />} />
            <Route path="/faq" element={
              <KioskLayout>
                <FAQ />
              </KioskLayout>
            } />

            {/* Idle Page - Also accessible at /idle */}
            <Route path="/idle" element={<IdlePage />} />

            {/* Queue Monitor - Public Display, No Layout Wrapper */}
            <Route path="/queue-monitor" element={<QueueMonitor />} />

          {/* Authentication Routes */}
          <Route path="/login" element={<Login />} />

          {/* MIS Super Admin Routes */}
          <Route path="/admin/mis" element={
            <ProtectedRoute requiredRoles={['super_admin']}>
              <AdminLayout>
                <MISAdminDashboard />
              </AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/mis/users" element={
            <ProtectedRoute requiredRoles={['super_admin']}>
              <AdminLayout>
                <MISUsers />
              </AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/mis/fix-users" element={
            <ProtectedRoute requiredRoles={['super_admin']}>
              <AdminLayout>
                <FixUsers />
              </AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/mis/database-manager" element={
            <ProtectedRoute requiredRoles={['super_admin']}>
              <AdminLayout>
                <DatabaseManager />
              </AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/mis/audit-trail" element={
            <ProtectedRoute requiredRoles={['super_admin']}>
              <AdminLayout>
                <MISAuditTrail />
              </AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/mis/bulletin" element={
            <ProtectedRoute requiredRoles={['super_admin']}>
              <AdminLayout>
                <MISBulletin />
              </AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/mis/faq" element={
            <ProtectedRoute>
              <AdminLayout>
                <SharedFAQ />
              </AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/mis/ratings" element={
            <ProtectedRoute requiredRoles={['super_admin']}>
              <AdminLayout>
                <MISRatings />
              </AdminLayout>
            </ProtectedRoute>
          } />

          {/* General Queue Monitor - Super Admin Access */}
          <Route path="/admin/queue-monitor" element={
            <ProtectedRoute>
              <QueueMonitor />
            </ProtectedRoute>
          } />

          {/* Registrar Admin Routes */}
          <Route path="/admin/registrar" element={
            <ProtectedRoute requiredRoles={['super_admin', 'registrar_admin']}>
              <AdminLayout>
                <RegistrarAdminDashboard />
              </AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/registrar/queue" element={
            <ProtectedRoute requiredRoles={['super_admin', 'registrar_admin']}>
              <AdminLayout>
                <RegistrarQueueRedirect />
              </AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/registrar/queue/:windowId" element={
            <ProtectedRoute requiredRoles={['super_admin', 'registrar_admin']}>
              <AdminLayout>
                <RegistrarQueue />
              </AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/registrar/queue-monitor" element={
            <ProtectedRoute>
              <RegistrarQueueMonitor />
            </ProtectedRoute>
          } />
          <Route path="/admin/registrar/transaction-logs" element={
            <ProtectedRoute requiredRoles={['super_admin', 'registrar_admin']}>
              <AdminLayout>
                <RegistrarTransactionLogs />
              </AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/registrar/document-request" element={
            <ProtectedRoute requiredRoles={['super_admin', 'registrar_admin']}>
              <AdminLayout>
                <RegistrarDocumentRequest />
              </AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/registrar/audit-trail" element={
            <ProtectedRoute requiredRoles={['super_admin', 'registrar_admin']}>
              <AdminLayout>
                <RegistrarAuditTrail />
              </AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/registrar/settings" element={
            <ProtectedRoute requiredRoles={['super_admin', 'registrar_admin']}>
              <AdminLayout>
                <RegistrarSettings />
              </AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/registrar/faq" element={
            <ProtectedRoute>
              <AdminLayout>
                <SharedFAQ />
              </AdminLayout>
            </ProtectedRoute>
          } />

          {/* Admissions Admin Routes */}
          <Route path="/admin/admissions" element={
            <ProtectedRoute requiredRoles={['super_admin', 'admissions_admin']}>
              <AdminLayout>
                <AdmissionsAdminDashboard />
              </AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/admissions/queue" element={
            <ProtectedRoute requiredRoles={['super_admin', 'admissions_admin']}>
              <AdminLayout>
                <AdmissionsQueueRedirect />
              </AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/admissions/queue/:windowId" element={
            <ProtectedRoute requiredRoles={['super_admin', 'admissions_admin']}>
              <AdminLayout>
                <AdmissionsQueue />
              </AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/admissions/queue-monitor" element={
            <ProtectedRoute>
              <AdmissionsQueueMonitor />
            </ProtectedRoute>
          } />
          <Route path="/admin/admissions/transaction-logs" element={
            <ProtectedRoute requiredRoles={['super_admin', 'admissions_admin']}>
              <AdminLayout>
                <AdmissionsTransactionLogs />
              </AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/admissions/audit-trail" element={
            <ProtectedRoute requiredRoles={['super_admin', 'admissions_admin']}>
              <AdminLayout>
                <AdmissionsAuditTrail />
              </AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/admissions/settings" element={
            <ProtectedRoute requiredRoles={['super_admin', 'admissions_admin']}>
              <AdminLayout>
                <AdmissionsSettings />
              </AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/admissions/faq" element={
            <ProtectedRoute>
              <AdminLayout>
                <SharedFAQ />
              </AdminLayout>
            </ProtectedRoute>
          } />

          {/* Senior Management Admin Routes */}
          <Route path="/admin/seniormanagement/charts" element={
            <ProtectedRoute requiredRoles={['super_admin', 'senior_management_admin']}>
              <AdminLayout>
                <SeniorManagementCharts />
              </AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/seniormanagement/faq" element={
            <ProtectedRoute>
              <AdminLayout>
                <SharedFAQ />
              </AdminLayout>
            </ProtectedRoute>
          } />

            {/* Unauthorized Access */}
            <Route path="/admin/unauthorized" element={<Unauthorized />} />
            </Routes>
          </Suspense>
        </Router>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;

// HMR compatibility
if (import.meta.hot) {
  import.meta.hot.accept();
}
