import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout() {
  const token = useAuthStore(s => s.token);
  if (!token) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#050510' }}>
      {/* Background orbs */}
      <div className="bg-orb w-[600px] h-[600px] opacity-25" style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', top: '-150px', left: '-100px' }} />
      <div className="bg-orb w-[500px] h-[500px] opacity-20" style={{ background: 'radial-gradient(circle, #0ea5e9 0%, transparent 70%)', bottom: '-100px', right: '10%' }} />
      <div className="bg-orb w-[400px] h-[400px] opacity-15" style={{ background: 'radial-gradient(circle, #ec4899 0%, transparent 70%)', top: '40%', right: '-100px' }} />

      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
