import { useCallback, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';

export type SnackSev = 'success' | 'error' | 'info' | 'warning';

/** Shared snackbar state + host element. */
export function useSnack() {
  const [snack, setSnack] = useState<{ open: boolean; msg: string; sev: SnackSev }>({ open: false, msg: '', sev: 'success' });

  const show = useCallback((msg: string, sev: SnackSev = 'success') => setSnack({ open: true, msg, sev }), []);
  const hide = useCallback(() => setSnack((s) => ({ ...s, open: false })), []);
  const fail = useCallback(
    (e: any, fallback: string) => show(e?.response?.data?.message || fallback, 'error'),
    [show]
  );

  const host = (
    <Snackbar open={snack.open} autoHideDuration={4000} onClose={hide} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert severity={snack.sev} onClose={hide} sx={{ width: '100%' }}>
        {snack.msg}
      </Alert>
    </Snackbar>
  );

  return { show, showError: (m: string) => show(m, 'error'), hide, fail, host };
}
