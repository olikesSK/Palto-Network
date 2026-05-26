import { Toaster } from 'react-hot-toast';

export { toast } from 'react-hot-toast';

export default function GlassToaster() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: 'rgba(15,5,40,0.95)',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(40px)',
          borderRadius: '14px',
          fontSize: '14px',
        },
        success: { iconTheme: { primary: '#22c55e', secondary: 'white' } },
        error: { iconTheme: { primary: '#ef4444', secondary: 'white' } },
      }}
    />
  );
}
