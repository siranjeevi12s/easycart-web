/**
 * EasyCart design tokens — the SINGLE source of truth for brand, color,
 * spacing, radius, type and status semantics across admin (MUI web),
 * restaurant (MUI web) and customer (React Native Paper) apps.
 *
 * Framework-agnostic plain data only: each app maps these into its own
 * theme system (MUI `createTheme` / Paper MD3 / StyleSheet). Change a value
 * here and all three apps follow after rebuild.
 */

export type ThemeMode = 'light' | 'dark';

export const brand = {
  primary: '#FF6B35',
  primaryDark: '#E55A2B',
  ink: '#1A1A1A',
} as const;

export interface Palette {
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
    primarySoft: '#FFF2EC',
    text: '#1A1A1A',
    muted: '#666666',
    faint: '#9CA3AF',
    border: '#FFE8DE',
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

/** Admin console uses a neutral canvas with warm-gray cards. */
export const adminCanvas = {
  light: { background: '#FAFAF9', paper: '#F4F1EC', text: '#1C1917', muted: '#57534E' },
  dark: { background: '#121212', paper: '#1E1E1E', text: '#EAEAEA', muted: '#A0A0A0' },
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, full: 999 } as const;

/** Numeric type scale (sp on native, px on web at 1x). */
export const typeScale = {
  display: 30,
  title: 22,
  heading: 18,
  subheading: 15,
  body: 14,
  caption: 12,
  tiny: 11,
} as const;

export type StatusKind = 'success' | 'warning' | 'error' | 'info' | 'muted';

/** Order/payment/approval status → semantic kind. */
export function orderStatusKind(status?: string): StatusKind {
  switch (status) {
    case 'PAID':
    case 'READY':
    case 'SETTLED':
    case 'ACCEPTED':
    case 'approved':
    case 'Active':
    case 'Available':
    case 'Enabled':
      return 'success';
    case 'PREPARING':
    case 'PROCESSING':
    case 'PENDING':
    case 'pending':
    case 'under_review':
      return 'warning';
    case 'FAILED':
    case 'CANCELLED':
    case 'REFUNDED':
    case 'REVERSED':
    case 'rejected':
    case 'suspended':
      return 'error';
    case 'PICKED_UP':
      return 'info';
    default:
      return 'muted';
  }
}

/** Soft background + strong foreground for a kind + mode. */
export function statusColors(
  kind: StatusKind,
  mode: ThemeMode
): { bg: string; fg: string } {
  const p = palette[mode];
  switch (kind) {
    case 'success':
      return { bg: p.successSoft, fg: p.success };
    case 'warning':
      return { bg: p.warningSoft, fg: p.warning };
    case 'error':
      return { bg: p.errorSoft, fg: p.error };
    case 'info':
      return { bg: p.infoSoft, fg: p.info };
    default:
      return { bg: p.surfaceAlt, fg: p.muted };
  }
}
