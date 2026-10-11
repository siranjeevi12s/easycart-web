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
  primary: '#F5C923',
  primaryDark: '#E4B719',
  ink: '#191919',
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
    background: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceAlt: '#F6F6F6',
    primary: brand.primary,
    onPrimary: '#191919',
    primarySoft: '#FDF4D7',
    text: '#191919',
    muted: '#666666',
    faint: '#9CA3AF',
    border: '#EAEAEA',
    divider: '#F1F1F1',
    success: '#218653',
    successSoft: '#E3F2E9',
    warning: '#E6A21A',
    warningSoft: '#FCF3DC',
    error: '#D93636',
    errorSoft: '#FBE9E9',
    info: '#1D4ED8',
    infoSoft: '#E3EAFB',
    star: '#F5C923',
  },
  dark: {
    background: '#121212',
    surface: '#1E1E1E',
    surfaceAlt: '#262626',
    primary: '#F5C923',
    onPrimary: '#191919',
    primarySoft: 'rgba(245,201,35,0.16)',
    text: '#F5F5F5',
    muted: '#A8A8A8',
    faint: '#737373',
    border: '#333333',
    divider: '#2A2A2A',
    success: '#4ADE80',
    successSoft: 'rgba(34,197,94,0.16)',
    warning: '#FBBF24',
    warningSoft: 'rgba(230,162,26,0.18)',
    error: '#F87171',
    errorSoft: 'rgba(217,54,54,0.16)',
    info: '#93C5FD',
    infoSoft: 'rgba(59,130,246,0.18)',
    star: '#F5C923',
  },
};

/** Admin console uses a neutral canvas with white cards. */
export const adminCanvas = {
  light: { background: '#F6F6F6', paper: '#FFFFFF', text: '#191919', muted: '#666666' },
  dark: { background: '#121212', paper: '#1E1E1E', text: '#EAEAEA', muted: '#A0A0A0' },
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, full: 999 } as const;

/** Primary UI font stack (web loads Inter; native uses system sans). */
export const fontFamily = 'Inter, system-ui, sans-serif';

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
