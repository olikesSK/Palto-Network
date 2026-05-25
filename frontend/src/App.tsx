import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Servers from './pages/Servers';
import ServerDetail from './pages/ServerDetail';
import Eggs from './pages/Eggs';
import Nodes from './pages/Nodes';
import Users from './pages/Users';
import Admin from './pages/Admin';
import Settings from './pages/Settings';
import Webhooks from './pages/Webhooks';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
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
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
