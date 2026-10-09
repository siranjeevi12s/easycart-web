/** Restaurant design tokens — brand + theme-aware helpers (MUI palette does the rest). */
export const brand = {
  primary: '#FF6B35',
  primaryDark: '#E55A2B',
  ink: '#1A1A1A',
} as const;

export type StatusKind = 'success' | 'warning' | 'error' | 'info' | 'muted';

export function orderStatusKind(status?: string): StatusKind {
  switch (status) {
    case 'PAID':
    case 'READY':
    case 'SETTLED':
    case 'ACCEPTED':
      return 'success';
    case 'PREPARING':
    case 'PROCESSING':
    case 'PENDING':
      return 'warning';
    case 'FAILED':
    case 'CANCELLED':
    case 'REFUNDED':
    case 'REVERSED':
      return 'error';
    case 'PICKED_UP':
      return 'info';
    default:
      return 'muted';
  }
}

/** Soft tint backgrounds that stay readable in both modes (MUI palette-driven). */
export function statusSoft(kind: StatusKind, mode: 'light' | 'dark'): string {
  const table: Record<StatusKind, [string, string]> = {
    success: ['#DCFCE7', 'rgba(34,197,94,0.16)'],
    warning: ['#FEF3C7', 'rgba(245,158,11,0.16)'],
    error: ['#FEE2E2', 'rgba(239,68,68,0.16)'],
    info: ['#E0E7FF', 'rgba(59,130,246,0.18)'],
    muted: ['#F3F4F6', 'rgba(148,163,184,0.18)'],
  };
  return mode === 'light' ? table[kind][0] : table[kind][1];
}

/** Strong foreground color for a status kind (theme-aware). */
export function statusStrong(kind: StatusKind, mode: 'light' | 'dark'): string {
  const table: Record<StatusKind, [string, string]> = {
    success: ['#166534', '#4ADE80'],
    warning: ['#92400E', '#FBBF24'],
    error: ['#991B1B', '#F87171'],
    info: ['#1E40AF', '#93C5FD'],
    muted: ['#4B5563', '#9CA3AF'],
  };
  return mode === 'light' ? table[kind][0] : table[kind][1];
}
