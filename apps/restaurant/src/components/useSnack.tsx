import { useCallback, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';

export type SnackSev = 'success' | 'error' | 'info' | 'warning';

/** Shared snackbar state + host element (replaces 3 copy-pasted copies). */
export function useSnack() {
  const [snack, setSnack] = useState<{ open: boolean; msg: string; sev: SnackSev }>({ open: false, msg: '', sev: 'success' });

  const show = useCallback((msg: string, sev: SnackSev = 'success') => setSnack({ open: true, msg, sev }), []);
  const hide = useCallback(() => setSnack((s) => ({ ...s, open: false })), []);
  const fail = useCallback(
    (e: any, fallback: string) => show(e?.response?.data?.message || fallback, 'error'),
    [show]
  );

  const host = (
    <Snackbar open={snack.open} autoHideDuration={3500} onClose={hide} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert severity={snack.sev} onClose={hide} sx={{ width: '100%' }}>
        {snack.msg}
      </Alert>
    </Snackbar>
  );

  return { show, hide, fail, host };
}
