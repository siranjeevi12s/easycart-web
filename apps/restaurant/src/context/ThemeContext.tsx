import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createTheme, ThemeProvider, CssBaseline } from '@mui/material';
import { brand } from '@easycart/design-tokens';

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
      primary: { main: brand.primary },
      secondary: { main: '#1A1A1A' },
      background: mode === 'light' ? { default: '#FFF8F5', paper: '#FFFFFF' } : { default: '#121212', paper: '#1E1E1E' },
      text: mode === 'light' ? { primary: '#1A1A1A', secondary: '#666' } : { primary: '#EAEAEA', secondary: '#A0A0A0' },
    },
    typography: { fontFamily: 'Inter, sans-serif', h6: { fontFamily: 'Poppins' } },
    shape: { borderRadius: 12 },
    components: {
      MuiAppBar: { styleOverrides: { root: { backgroundColor: mode === 'light' ? '#FFFFFF' : '#1E1E1E', color: mode === 'light' ? '#1A1A1A' : '#EAEAEA', borderBottom: `1px solid ${mode === 'light' ? '#FFE8DE' : '#333'}` } } },
      MuiCard: { styleOverrides: { root: { backgroundColor: mode === 'light' ? '#FFFFFF' : '#1E1E1E', backgroundImage: 'none' } } },
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
