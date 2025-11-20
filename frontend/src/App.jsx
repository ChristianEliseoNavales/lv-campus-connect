import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import SocketProvider from './contexts/SocketContext';
import { KioskLayout, AdminLayout } from './components/layouts';
import { ProtectedRoute, Login, Unauthorized } from './components/auth';
import {
  MISAdminDashboard,
  RegistrarAdminDashboard,
  AdmissionsAdminDashboard,
  QueueMonitor
} from './components/pages/admin';

// MIS Admin Pages
import MISUsers from './components/pages/admin/mis/Users';
import FixUsers from './components/pages/admin/mis/FixUsers';
import DatabaseManager from './components/pages/admin/mis/DatabaseManager';
import MISAuditTrail from './components/pages/admin/mis/AuditTrail';
import MISBulletin from './components/pages/admin/mis/Bulletin';
import MISFAQ from './components/pages/admin/mis/FAQ';
import MISRatings from './components/pages/admin/mis/Ratings';

// Registrar Admin Pages
import RegistrarQueue from './components/pages/admin/registrar/Queue';
import RegistrarQueueRedirect from './components/pages/admin/registrar/QueueRedirect';
import RegistrarQueueMonitor from './components/pages/admin/registrar/QueueMonitor';
import RegistrarTransactionLogs from './components/pages/admin/registrar/TransactionLogs';
import RegistrarAuditTrail from './components/pages/admin/registrar/AuditTrail';
import RegistrarSettings from './components/pages/admin/registrar/Settings';

// Admissions Admin Pages
import AdmissionsQueue from './components/pages/admin/admissions/Queue';
import AdmissionsQueueRedirect from './components/pages/admin/admissions/QueueRedirect';
import AdmissionsQueueMonitor from './components/pages/admin/admissions/QueueMonitor';
import AdmissionsTransactionLogs from './components/pages/admin/admissions/TransactionLogs';
import AdmissionsAuditTrail from './components/pages/admin/admissions/AuditTrail';
import AdmissionsSettings from './components/pages/admin/admissions/Settings';

// Senior Management Admin Pages
import SeniorManagementCharts from './components/pages/admin/seniormanagement/Charts';

import {
  Home,
  Bulletin,
  Map,
  Directory,
  Queue,
  FAQ,
  IdlePage,
  PortalQueue
} from './components/pages';

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Router future={{ v7_relativeSplatPath: true }}>
          <Routes>
          {/* Public Kiosk Routes - No Authentication Required */}
          <Route path="/" element={
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

          {/* Idle Page - No Layout Wrapper */}
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
            <ProtectedRoute requiredRoles={['super_admin']}>
              <AdminLayout>
                <MISFAQ />
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
            <ProtectedRoute requiredRoles={['super_admin', 'registrar_admin']}>
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
            <ProtectedRoute requiredRoles={['super_admin', 'admissions_admin']}>
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

          {/* Senior Management Admin Routes */}
          <Route path="/admin/seniormanagement/charts" element={
            <ProtectedRoute requiredRoles={['super_admin', 'senior_management_admin']}>
              <AdminLayout>
                <SeniorManagementCharts />
              </AdminLayout>
            </ProtectedRoute>
          } />

          {/* Unauthorized Access */}
          <Route path="/admin/unauthorized" element={<Unauthorized />} />
          </Routes>
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