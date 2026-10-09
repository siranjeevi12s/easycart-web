import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createTheme, ThemeProvider, CssBaseline } from '@mui/material';

type Mode = 'light' | 'dark';

const ThemeModeContext = createContext<{ mode: Mode; toggle: () => void }>({ mode: 'light', toggle: () => {} });
export const useThemeMode = () => useContext(ThemeModeContext);

export const brand = { primary: '#FF6B35', primaryDark: '#E55A2B', ink: '#1A1A1A' } as const;

export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => {
    const saved = localStorage.getItem('easycart-admin-theme') as Mode | null;
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    localStorage.setItem('easycart-admin-theme', mode);
  }, [mode]);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: { main: brand.primary },
          background: mode === 'light' ? { default: '#FAFAF9', paper: '#FFFFFF' } : { default: '#121212', paper: '#1E1E1E' },
          text: mode === 'light' ? { primary: '#1C1917', secondary: '#57534E' } : { primary: '#EAEAEA', secondary: '#A0A0A0' },
        },
        typography: { fontFamily: 'Inter, system-ui, sans-serif' },
        shape: { borderRadius: 12 },
        components: {
          MuiCard: { styleOverrides: { root: { backgroundImage: 'none' } } },
          MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { textTransform: 'none', fontWeight: 600, minHeight: 40 } } },
        },
      }),
    [mode]
  );

  return (
    <ThemeModeContext.Provider value={{ mode, toggle: () => setMode((m) => (m === 'light' ? 'dark' : 'light')) }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}
