/** App theme provider: light/dark mode, persisted, Paper + Navigation aware. */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Provider as PaperProvider } from 'react-native-paper';
import { DarkTheme as NavDark, DefaultTheme as NavLight, type Theme as NavTheme } from '@react-navigation/native';
import { lightTheme, darkTheme } from './paper';
import { palette, type ThemeMode } from './tokens';

const STORAGE_KEY = 'easycart-theme-mode';

interface ThemeCtx {
  mode: ThemeMode;
  toggle: () => void;
  setMode: (m: ThemeMode) => void;
}

const Ctx = createContext<ThemeCtx>({ mode: 'light', toggle: () => {}, setMode: () => {} });
export const useAppThemeMode = () => useContext(Ctx);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') setModeState(saved);
      else if (system === 'dark') setModeState('dark');
    })();
  }, [system]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY, m).catch(() => {});
  }, []);
  const toggle = useCallback(() => {
    setModeState((m) => {
      const next = m === 'light' ? 'dark' : 'light';
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(() => ({ mode, toggle, setMode }), [mode, toggle, setMode]);
  const paperTheme = mode === 'light' ? lightTheme : darkTheme;

  return (
    <Ctx.Provider value={value}>
      <PaperProvider theme={paperTheme}>{children}</PaperProvider>
    </Ctx.Provider>
  );
}

/** React Navigation theme derived from the active Paper theme (call inside provider). */
export function useNavTheme(): NavTheme {
  const { mode } = useAppThemeMode();
  const p = palette[mode];
  const base = mode === 'light' ? NavLight : NavDark;
  return {
    ...base,
    dark: mode === 'dark',
    colors: { ...base.colors, primary: p.primary, background: p.background, card: p.surface, text: p.text, border: p.border },
  };
}
