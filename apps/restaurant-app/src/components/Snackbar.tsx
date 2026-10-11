/** Global snackbar host: any screen can show transient confirmations. */
import React, { createContext, useCallback, useContext, useState } from 'react';
import { Snackbar as PaperSnackbar } from 'react-native-paper';

interface SnackCtx {
  show: (message: string) => void;
}

const Ctx = createContext<SnackCtx>({ show: () => {} });
export const useSnackbar = () => useContext(Ctx);

export function SnackProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState('');
  const [visible, setVisible] = useState(false);
  const [key, setKey] = useState(0);

  const show = useCallback((message: string) => {
    setMsg(message);
    setKey((k) => k + 1);
    setVisible(true);
  }, []);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <PaperSnackbar key={key} visible={visible} onDismiss={() => setVisible(false)} duration={2200} action={{ label: 'OK', onPress: () => setVisible(false) }}>
        {msg}
      </PaperSnackbar>
    </Ctx.Provider>
  );
}
