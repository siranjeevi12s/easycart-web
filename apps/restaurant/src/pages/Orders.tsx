import { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, Chip, Button, Stack, TextField, Tabs, Tab, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert } from '@mui/material';
import { api } from '../services/api';

const canCancel = (s: string) => s === 'PAID' || s === 'ACCEPTED';

export default function Orders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [pickupCode, setPickupCode] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; sev: 'success' | 'error' }>({ open: false, msg: '', sev: 'success' });

  const load = async () => {
    setLoading(true);
    const { data } = await api.get('/orders' + (filter === 'all' ? '' : `?status=${filter}`));
    setOrders(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, [filter]);

  const update = async (id: string, status: string) => {
    try {
      await api.patch(`/orders/${id}/status`, { status });
      if (status === 'READY') setSnack({ open: true, msg: 'Order marked READY — customer notified', sev: 'success' });
      load();
    } catch (e: any) {
      setSnack({ open: true, msg: e.response?.data?.message || `Failed to update to ${status}`, sev: 'error' });
    }
  };
  const pickup = async (id: string) => {
    const code = pickupCode[id]?.trim();
    if (!code) { setSnack({ open: true, msg: 'Enter customer order code #FD-xxxx or scan QR', sev: 'error' }); return; }
    try {
      await api.post(`/orders/${id}/pickup`, { orderNumber: code, qrData: code });
      setSnack({ open: true, msg: '✅ Pickup verified — order completed', sev: 'success' });
      load();
    } catch (e: any) {
      setSnack({ open: true, msg: e.response?.data?.message || 'Verification failed — check code', sev: 'error' });
    }
  };
  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setCancellingId(cancelTarget._id);
    try {
      await api.patch(`/orders/${cancelTarget._id}/status`, { status: 'CANCELLED' });
      setSnack({ open: true, msg: `Order ${cancelTarget.orderNumber} cancelled`, sev: 'success' });
      setCancelTarget(null);
      load();
    } catch (e: any) {
      setSnack({ open: true, msg: e.response?.data?.message || 'Cancellation failed', sev: 'error' });
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700}>Order Management</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>Accept • Prepare • READY • Verify pickup (QR / order code). Backend enforces state machine & ownership.</Typography>
      <Tabs value={filter} onChange={(_, v) => setFilter(v)} sx={{ mb: 2 }} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
        <Tab label="All" value="all" />
        <Tab label="PAID" value="PAID" />
        <Tab label="ACCEPTED" value="ACCEPTED" />
        <Tab label="PREPARING" value="PREPARING" />
        <Tab label="READY" value="READY" />
        <Tab label="PICKED_UP" value="PICKED_UP" />
        <Tab label="CANCELLED" value="CANCELLED" />
      </Tabs>
      {loading ? <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress /></Box> :
        <Stack spacing={2}>
          {orders.map((o) => (
            <Card key={o._id} variant="outlined">
              <CardContent>
                <Box className="flex justify-between">
                  <Typography fontWeight={700}>{o.orderNumber} — {typeof o.restaurantId === 'object' ? o.restaurantId.name : o.restaurantId}</Typography>
                  <Chip label={`${o.orderStatus} • ${o.paymentStatus}`} size="small" />
                </Box>
                <Typography variant="body2" color="text.secondary">{new Date(o.createdAt).toLocaleString()} • ₹{o.totalAmount} (sub ₹{o.subtotal} + tax ₹{o.tax})</Typography>
                <Box sx={{ mt: 1 }}>
                  {o.items.map((it: any) => <Typography key={it.name} variant="body2">{it.quantity} × {it.name} @ ₹{it.price}</Typography>)}
                </Box>
                <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', rowGap: 1 }}>
                  {o.orderStatus === 'PAID' && <Button variant="contained" onClick={() => update(o._id, 'ACCEPTED')} sx={{ bgcolor: '#FF6B35', minHeight: 40 }}>Accept</Button>}
                  {o.orderStatus === 'ACCEPTED' && <Button onClick={() => update(o._id, 'PREPARING')} variant="contained" color="warning" sx={{ minHeight: 40 }}>Start Preparing</Button>}
                  {o.orderStatus === 'PREPARING' && <Button onClick={() => update(o._id, 'READY')} variant="contained" color="success" sx={{ minHeight: 40 }}>Mark READY</Button>}
                  {o.orderStatus === 'READY' && (
                    <Box className="flex gap-2 items-center flex-wrap w-full">
                      <TextField size="small" placeholder="Enter Order # e.g. #FD-1024" value={pickupCode[o._id] || ''} onChange={(e) => setPickupCode({ ...pickupCode, [o._id]: e.target.value })} sx={{ flex: 1, minWidth: 160 }} />
                      <Button variant="contained" color="success" onClick={() => pickup(o._id)} sx={{ minHeight: 40 }}>Verify & Picked Up</Button>
                    </Box>
                  )}
                  {canCancel(o.orderStatus) && (
                    <Button variant="outlined" color="error" onClick={() => setCancelTarget(o)} disabled={cancellingId === o._id} sx={{ minHeight: 40, minWidth: 90 }}>{cancellingId === o._id ? <CircularProgress size={18} /> : 'Cancel Order'}</Button>
                  )}
                </Stack>
              </CardContent>
            </Card>
          ))}
          {orders.length === 0 && <Typography color="text.secondary">No orders for this filter.</Typography>}
        </Stack>
      }

      <Dialog open={!!cancelTarget} onClose={() => setCancelTarget(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { m: 2, borderRadius: 3 } }}>
        <DialogTitle fontWeight={700}>Cancel Order?</DialogTitle>
        <DialogContent><Typography>Are you sure you want to cancel <b>{cancelTarget?.orderNumber}</b>? This cannot be undone.</Typography></DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setCancelTarget(null)} variant="outlined" sx={{ minHeight: 40, flex: 1 }}>Keep</Button>
          <Button onClick={confirmCancel} variant="contained" color="error" disabled={!!cancellingId} sx={{ minHeight: 40, flex: 1 }}>{cancellingId ? <CircularProgress size={18} /> : 'Yes, Cancel'}</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack({ ...snack, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.sev} onClose={() => setSnack({ ...snack, open: false })} sx={{ width: '100%' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
