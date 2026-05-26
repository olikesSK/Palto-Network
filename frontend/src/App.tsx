import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import { useSettingsStore } from './store/settings';
import Dashboard from './pages/Dashboard';
import Servers from './pages/Servers';
import ServerDetail from './pages/ServerDetail';
import Eggs from './pages/Eggs';
import Nodes from './pages/Nodes';
import Users from './pages/Users';
import Admin from './pages/Admin';
import Settings from './pages/Settings';
import Webhooks from './pages/Webhooks';
import ApiKeys from './pages/ApiKeys';
import AuditLog from './pages/AuditLog';
import Announcements from './pages/Announcements';
import PanelSettings from './pages/PanelSettings';
import StatusPage from './pages/StatusPage';
import DiscordBot from './pages/DiscordBot';

export default function App() {
  const { load } = useSettingsStore();
  useEffect(() => { load(); }, [load]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes - no auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/status" element={<StatusPage />} />

        {/* Authenticated layout */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="servers" element={<Servers />} />
          <Route path="servers/:id" element={<ServerDetail />} />
          <Route path="eggs" element={<Eggs />} />
          <Route path="nodes" element={<Nodes />} />
          <Route path="users" element={<Users />} />
          <Route path="admin" element={<Admin />} />
          <Route path="settings" element={<Settings />} />
          <Route path="webhooks" element={<Webhooks />} />
          <Route path="apikeys" element={<ApiKeys />} />
          <Route path="audit" element={<AuditLog />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="panel-settings" element={<PanelSettings />} />
          <Route path="discord-bot" element={<DiscordBot />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
