import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createTheme, ThemeProvider, CssBaseline } from '@mui/material';
import { adminCanvas, brand, fontFamily, palette } from '@easycart/design-tokens';

type Mode = 'light' | 'dark';

const ThemeModeContext = createContext<{ mode: Mode; toggle: () => void }>({ mode: 'light', toggle: () => {} });
export const useThemeMode = () => useContext(ThemeModeContext);

export { brand };

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
          primary: { main: brand.primary, dark: brand.primaryDark, contrastText: palette[mode].onPrimary },
          background: mode === 'light' ? { default: adminCanvas.light.background, paper: adminCanvas.light.paper } : { default: adminCanvas.dark.background, paper: adminCanvas.dark.paper },
          text: mode === 'light' ? { primary: adminCanvas.light.text, secondary: adminCanvas.light.muted } : { primary: adminCanvas.dark.text, secondary: adminCanvas.dark.muted },
          success: { main: palette[mode].success },
          warning: { main: palette[mode].warning },
          error: { main: palette[mode].error },
        },
        typography: { fontFamily },
        shape: { borderRadius: 14 },
        components: {
          MuiCard: {
            styleOverrides: {
              root: ({ theme }) => ({
                backgroundImage: 'none',
                border: `1px solid ${theme.palette.divider}`,
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                '&:hover': {
                  borderColor: brand.primary,
                  boxShadow: '0 4px 16px rgba(245,201,35,0.16)',
                },
              }),
            },
          },
          MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { textTransform: 'none', fontWeight: 600, minHeight: 40 }, containedPrimary: { color: '#191919' } } },
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
