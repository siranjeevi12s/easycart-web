/** React Native Paper MD3 themes extended with the EasyCart brand. */
import { MD3LightTheme, MD3DarkTheme, type MD3Theme } from 'react-native-paper';
import { palette } from './tokens';

function build(mode: 'light' | 'dark'): MD3Theme {
  const p = palette[mode];
  const base = mode === 'light' ? MD3LightTheme : MD3DarkTheme;
  return {
    ...base,
    dark: mode === 'dark',
    roundness: 12,
    colors: {
      ...base.colors,
      primary: p.primary,
      onPrimary: p.onPrimary,
      primaryContainer: p.primarySoft,
      onPrimaryContainer: p.text,
      secondary: p.muted,
      background: p.background,
      onBackground: p.text,
      surface: p.surface,
      onSurface: p.text,
      surfaceVariant: p.surfaceAlt,
      onSurfaceVariant: p.muted,
      outline: p.border,
      outlineVariant: p.divider,
      error: p.error,
      onError: '#FFFFFF',
      errorContainer: p.errorSoft,
    },
  };
}

export const lightTheme = build('light');
export const darkTheme = build('dark');
export type AppTheme = MD3Theme;
