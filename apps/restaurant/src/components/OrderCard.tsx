import { useState } from 'react';
import { Box, Button, Card, CardContent, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import StatusChip from './StatusChip';
import { brand } from '../theme/tokens';

export const canCancelOrder = (status: string) => status === 'PAID' || status === 'ACCEPTED';

interface Props {
  order: any;
  onStatus: (id: string, status: string) => void;
  onPickup: (id: string, code: string) => void;
  onCancel: (order: any) => void;
  cancellingId: string | null;
  showRestaurant?: boolean;
}

/** Kitchen order card: status flow actions + QR/code pickup + cancel (Dashboard + Orders share it). */
export default function OrderCard({ order: o, onStatus, onPickup, onCancel, cancellingId, showRestaurant = false }: Props) {
  const theme = useTheme();
  const [code, setCode] = useState('');
  const edge = o.orderStatus === 'PAID' ? brand.primary : o.orderStatus === 'READY' ? '#22c55e' : '#f59e0b';

  return (
    <Card variant="outlined" sx={{ borderLeft: `4px solid ${edge}` }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Typography fontWeight={700}>
            {o.orderNumber}
            {showRestaurant && <> — {typeof o.restaurantId === 'object' ? o.restaurantId.name : o.restaurantId}</>}
          </Typography>
          <StatusChip status={`${o.orderStatus} • ${o.paymentStatus}`} kind={o.orderStatus === 'READY' || o.orderStatus === 'PAID' ? 'success' : o.orderStatus === 'CANCELLED' ? 'error' : 'warning'} />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {new Date(o.createdAt).toLocaleString()} • ₹{o.totalAmount}
          {o.subtotal !== undefined && <> (sub ₹{o.subtotal} + tax ₹{o.tax})</>} • {o.paymentStatus}
        </Typography>
        <Box sx={{ mt: 1 }}>
          {o.items.map((it: any) => (
            <Typography key={it.name} variant="body2">
              {it.quantity} × {it.name} @ ₹{it.price}
              {it.subtotal !== undefined && <> = ₹{it.subtotal}</>}
            </Typography>
          ))}
        </Box>
        <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', rowGap: 1 }}>
          {o.orderStatus === 'PAID' && (
            <Button variant="contained" onClick={() => onStatus(o._id, 'ACCEPTED')} sx={{ bgcolor: brand.primary, '&:hover': { bgcolor: brand.primaryDark }, minHeight: 40 }}>
              Accept
            </Button>
          )}
          {o.orderStatus === 'ACCEPTED' && (
            <Button variant="contained" color="warning" onClick={() => onStatus(o._id, 'PREPARING')} sx={{ minHeight: 40 }}>
              Start Preparing
            </Button>
          )}
          {o.orderStatus === 'PREPARING' && (
            <Button variant="contained" color="success" onClick={() => onStatus(o._id, 'READY')} sx={{ minHeight: 40 }}>
              Mark READY
            </Button>
          )}
          {o.orderStatus === 'READY' && (
            <Box
              sx={{
                display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', width: '100%',
                bgcolor: 'background.paper', p: 1.2, borderRadius: 2,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <TextField
                size="small"
                placeholder="Enter #FD-xxxx or scan QR"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                sx={{ flex: 1, minWidth: 160 }}
                aria-label="Pickup code"
              />
              <Button variant="contained" color="success" onClick={() => { onPickup(o._id, code.trim()); setCode(''); }} sx={{ minHeight: 40 }}>
                Verify & Picked Up
              </Button>
            </Box>
          )}
          {canCancelOrder(o.orderStatus) && (
            <Button variant="outlined" color="error" onClick={() => onCancel(o)} disabled={cancellingId === o._id} sx={{ minHeight: 40, minWidth: 90 }}>
              {cancellingId === o._id ? <CircularProgress size={18} color="inherit" /> : 'Cancel Order'}
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
