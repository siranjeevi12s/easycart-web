import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createTheme, ThemeProvider, CssBaseline } from '@mui/material';
import { brand, fontFamily, palette } from '@easycart/design-tokens';

type Mode = 'light' | 'dark';
interface Ctx { mode: Mode; toggle: () => void }

const ThemeModeContext = createContext<Ctx>({ mode: 'light', toggle: () => {} });
export const useThemeMode = () => useContext(ThemeModeContext);

export function CustomThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => {
    const saved = localStorage.getItem('easycart-theme') as Mode | null;
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('easycart-theme', mode);
    document.documentElement.classList.toggle('dark', mode === 'dark');
  }, [mode]);

  const toggle = () => setMode((m) => (m === 'light' ? 'dark' : 'light'));

  const theme = useMemo(() => createTheme({
    palette: {
      mode,
      primary: { main: brand.primary, dark: brand.primaryDark, contrastText: palette[mode].onPrimary },
      secondary: { main: '#191919' },
      background: mode === 'light' ? { default: palette.light.background, paper: palette.light.surface } : { default: palette.dark.background, paper: palette.dark.surface },
      text: mode === 'light' ? { primary: palette.light.text, secondary: palette.light.muted } : { primary: palette.dark.text, secondary: palette.dark.muted },
      success: { main: palette[mode].success },
      warning: { main: palette[mode].warning },
      error: { main: palette[mode].error },
    },
    typography: { fontFamily, h6: { fontFamily: 'Poppins, Inter, sans-serif' } },
    shape: { borderRadius: 14 },
    components: {
      MuiAppBar: { styleOverrides: { root: { backgroundColor: mode === 'light' ? palette.light.surface : palette.dark.surface, color: mode === 'light' ? palette.light.text : palette.dark.text, borderBottom: `1px solid ${mode === 'light' ? palette.light.border : palette.dark.border}` } } },
      MuiCard: { styleOverrides: { root: { backgroundColor: mode === 'light' ? palette.light.surface : palette.dark.surface, backgroundImage: 'none', borderRadius: 18 } } },
      MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { textTransform: 'none', fontWeight: 700, borderRadius: 14 }, containedPrimary: { color: '#191919' } } },
    }
  }), [mode]);

  return (
    <ThemeModeContext.Provider value={{ mode, toggle }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}
