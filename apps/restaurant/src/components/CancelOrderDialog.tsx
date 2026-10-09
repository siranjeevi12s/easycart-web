import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';

interface Props {
  orderNumber?: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** Shared cancel-order confirmation (Dashboard + Orders used copies). */
export default function CancelOrderDialog({ orderNumber, busy, onClose, onConfirm }: Props) {
  return (
    <Dialog open={!!orderNumber} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { m: 2, borderRadius: 3 } }}>
      <DialogTitle fontWeight={700}>Cancel Order?</DialogTitle>
      <DialogContent>
        <Typography>
          Are you sure you want to cancel <b>{orderNumber}</b>? This cannot be undone. Only PAID / ACCEPTED orders can be cancelled before Preparing.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} variant="outlined" sx={{ minHeight: 40, flex: 1 }}>
          Keep Order
        </Button>
        <Button onClick={onConfirm} variant="contained" color="error" disabled={busy} sx={{ minHeight: 40, flex: 1 }}>
          {busy ? <CircularProgress size={18} color="inherit" /> : 'Yes, Cancel'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
