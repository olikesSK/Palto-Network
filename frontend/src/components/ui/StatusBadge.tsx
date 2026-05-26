interface Props { status: string; }

const config: Record<string, { label: string; bg: string; color: string }> = {
  running:    { label: 'Running',    bg: 'rgba(34,197,94,0.15)',   color: '#22c55e' },
  stopped:    { label: 'Stopped',    bg: 'rgba(107,114,128,0.2)',  color: '#9ca3af' },
  starting:   { label: 'Starting',   bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b' },
  stopping:   { label: 'Stopping',   bg: 'rgba(249,115,22,0.15)',  color: '#f97316' },
  crashed:    { label: 'Crashed',    bg: 'rgba(239,68,68,0.15)',   color: '#ef4444' },
  installing: { label: 'Installing', bg: 'rgba(56,189,248,0.15)',  color: '#38bdf8' },
};

export default function StatusBadge({ status }: Props) {
  const c = config[status] ?? config.stopped;
  return (
    <span
      className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.color}30` }}
    >
      <span className={`status-dot status-${status}`} />
      {c.label}
    </span>
  );
}
