/** EasyCart design tokens — single source of truth for color, type, spacing.
 *  Light + dark palettes; components must read these, never hardcode hex. */
export type ThemeMode = 'light' | 'dark';

export const brand = {
  primary: '#FF6B35',
  primaryDark: '#E55A2B',
  primarySoft: '#FFF2EC',
  primaryBorder: '#FFE8DE',
  ink: '#1A1A1A',
} as const;

interface Palette {
  background: string;
  surface: string;
  surfaceAlt: string;
  primary: string;
  onPrimary: string;
  primarySoft: string;
  text: string;
  muted: string;
  faint: string;
  border: string;
  divider: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  error: string;
  errorSoft: string;
  info: string;
  infoSoft: string;
  star: string;
}

export const palette: Record<ThemeMode, Palette> = {
  light: {
    background: '#FFF8F5',
    surface: '#FFFFFF',
    surfaceAlt: '#F9FAFB',
    primary: brand.primary,
    onPrimary: '#FFFFFF',
    primarySoft: brand.primarySoft,
    text: '#1A1A1A',
    muted: '#666666',
    faint: '#9CA3AF',
    border: brand.primaryBorder,
    divider: '#F3F4F6',
    success: '#16A34A',
    successSoft: '#DCFCE7',
    warning: '#B45309',
    warningSoft: '#FEF3C7',
    error: '#DC2626',
    errorSoft: '#FEF2F2',
    info: '#1D4ED8',
    infoSoft: '#E0E7FF',
    star: '#FF6B35',
  },
  dark: {
    background: '#121212',
    surface: '#1E1E1E',
    surfaceAlt: '#262626',
    primary: '#FF8A50',
    onPrimary: '#1A1A1A',
    primarySoft: 'rgba(255,107,53,0.16)',
    text: '#F5F5F5',
    muted: '#A8A8A8',
    faint: '#737373',
    border: '#3A2A22',
    divider: '#2A2A2A',
    success: '#4ADE80',
    successSoft: 'rgba(34,197,94,0.16)',
    warning: '#FBBF24',
    warningSoft: 'rgba(245,158,11,0.16)',
    error: '#F87171',
    errorSoft: 'rgba(239,68,68,0.16)',
    info: '#93C5FD',
    infoSoft: 'rgba(59,130,246,0.18)',
    star: '#FF8A50',
  },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, full: 999 } as const;

export const type = {
  display: { fontSize: 30, fontWeight: '800' as const },
  title: { fontSize: 22, fontWeight: '800' as const },
  heading: { fontSize: 18, fontWeight: '800' as const },
  subheading: { fontSize: 15, fontWeight: '700' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  bodyBold: { fontSize: 14, fontWeight: '700' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
  captionBold: { fontSize: 12, fontWeight: '700' as const },
  tiny: { fontSize: 11, fontWeight: '600' as const },
  button: { fontSize: 15, fontWeight: '800' as const },
} as const;

/** Order/payment status → semantic color key (resolved against active palette). */
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
