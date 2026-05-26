import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export function useGlobalKeyboard() {
  const navigate = useNavigate();
  const lastKey = useRef<string>('');
  const lastKeyTime = useRef<number>(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        // Allow Ctrl+K even in inputs
        if (!((e.ctrlKey || e.metaKey) && e.key === 'k')) return;
      }

      // Ctrl+K or Cmd+K - focus search in header
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[placeholder*="Hle"], input[placeholder*="Search"]')?.focus();
        return;
      }

      // G then D - go to dashboard
      const now = Date.now();
      if (lastKey.current === 'g' && e.key === 'd' && now - lastKeyTime.current < 1000) {
        e.preventDefault();
        navigate('/dashboard');
      }
      // G then S - go to servers
      if (lastKey.current === 'g' && e.key === 's' && now - lastKeyTime.current < 1000) {
        e.preventDefault();
        navigate('/servers');
      }

      lastKey.current = e.key;
      lastKeyTime.current = now;
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [navigate]);
}
