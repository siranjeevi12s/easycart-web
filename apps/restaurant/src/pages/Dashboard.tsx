import { useEffect, useState } from 'react';
import { Grid, Card, CardContent, Typography, Box, Chip, Button, Stack, Alert, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, TextField } from '@mui/material';
import { api } from '../services/api';
import { io } from 'socket.io-client';

const canCancel = (status: string) => status === 'PAID' || status === 'ACCEPTED';

export default function Dashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ new: 0, preparing: 0, ready: 0 });
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [pickupCode, setPickupCode] = useState<Record<string, string>>({});
  const [snack, setSnack] = useState<{ open: boolean; msg: string; sev: 'success' | 'error' }>({ open: false, msg: '', sev: 'success' });

  const fetch = async () => {
    try {
      const { data } = await api.get('/orders');
      setOrders(data);
      setStats({
        new: data.filter((o: any) => o.orderStatus === 'PAID').length,
        preparing: data.filter((o: any) => ['ACCEPTED', 'PREPARING'].includes(o.orderStatus)).length,
        ready: data.filter((o: any) => o.orderStatus === 'READY').length,
      });
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetch();
    const SOCKET_URL = (import.meta as any).env?.VITE_SOCKET_URL || 'http://localhost:5000';
    const socket = io(SOCKET_URL, { auth: { token: localStorage.getItem('token') } });
    // join restaurant room after fetching my restaurants
    api.get('/restaurants/my').then(({ data }) => {
      data.forEach((r: any) => socket.emit('join:restaurant', r._id));
    });
    socket.on('order:new', (order: any) => {
      fetch();
      setSnack({ open: true, msg: `🔔 New order ${order.orderNumber} — ₹${order.totalAmount} — PAID`, sev: 'success' });
      // Optional: browser notification
      if ('Notification' in window && Notification.permission === 'granted') new Notification(`New order ${order.orderNumber}`, { body: `₹${order.totalAmount} — ${order.items?.length} items` });
    });
    socket.on('order:update', (order: any) => {
      fetch();
      if (order.orderStatus === 'CANCELLED') setSnack({ open: true, msg: `Order ${order.orderNumber} cancelled`, sev: 'error' });
    });
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    return () => { socket.disconnect(); };
  }, []);

  const act = async (id: string, status: string) => {
    try {
      await api.patch(`/orders/${id}/status`, { status });
      fetch();
      if (status === 'READY') setSnack({ open: true, msg: 'Order marked READY — customer notified', sev: 'success' });
    } catch (e: any) {
      setSnack({ open: true, msg: e.response?.data?.message || `Failed to update to ${status}`, sev: 'error' });
    }
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setCancellingId(cancelTarget._id);
    try {
      await api.patch(`/orders/${cancelTarget._id}/status`, { status: 'CANCELLED' });
      setSnack({ open: true, msg: `Order ${cancelTarget.orderNumber} cancelled`, sev: 'success' });
      setCancelTarget(null);
      fetch();
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Cancellation failed — order may have moved to Preparing';
      setSnack({ open: true, msg, sev: 'error' });
    } finally {
      setCancellingId(null);
    }
  };

  const handlePickup = async (id: string) => {
    const code = pickupCode[id]?.trim();
    if (!code) { setSnack({ open: true, msg: 'Enter customer order code #FD-xxxx or scan QR', sev: 'error' }); return; }
    try {
      await api.post(`/orders/${id}/pickup`, { orderNumber: code, qrData: code });
      setSnack({ open: true, msg: '✅ Pickup verified — order completed', sev: 'success' });
      setPickupCode((prev) => ({ ...prev, [id]: '' }));
      fetch();
    } catch (e: any) {
      setSnack({ open: true, msg: e.response?.data?.message || 'Verification failed — check code', sev: 'error' });
    }
  };

  if (loading) return <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}><CircularProgress sx={{ color: '#FF6B35' }} /></Box>;

  const active = orders.filter((o) => !['PICKED_UP', 'CANCELLED'].includes(o.orderStatus)).slice(0, 6);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>Good evening, Chef 👋</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Orders before they arrive — prepare, mark READY, instant pickup.</Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: '#FF6B35', color: 'white' }}><CardContent><Typography variant="h3" fontWeight={800}>{stats.new}</Typography><Typography>New Paid Orders</Typography></CardContent></Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card><CardContent><Typography variant="h3" fontWeight={800}>{stats.preparing}</Typography><Typography color="text.secondary">Preparing</Typography></CardContent></Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card><CardContent><Typography variant="h3" fontWeight={800}>{stats.ready}</Typography><Typography color="text.secondary">Ready for Pickup</Typography></CardContent></Card>
        </Grid>
      </Grid>

      <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Active Orders — Priority Queue</Typography>
      {active.length === 0 && <Alert severity="info">No active orders. New pre-paid orders will appear here instantly.</Alert>}
      <Grid container spacing={2}>
        {active.map((o) => (
          <Grid item xs={12} md={6} key={o._id}>
            <Card sx={{ borderLeft: `4px solid ${o.orderStatus === 'PAID' ? '#FF6B35' : o.orderStatus === 'READY' ? '#22c55e' : '#f59e0b'}` }}>
              <CardContent>
                <Box className="flex justify-between items-start">
                  <Typography fontWeight={700}>{o.orderNumber}</Typography>
                  <Chip label={o.orderStatus} size="small" color={o.orderStatus === 'READY' ? 'success' : o.orderStatus === 'PAID' ? 'warning' : 'default'} />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{new Date(o.createdAt).toLocaleString()} • ₹{o.totalAmount} • {o.paymentStatus}</Typography>
                <Box sx={{ mt: 1.5 }}>
                  {o.items.map((it: any) => (
                    <Typography key={it.name} variant="body2">{it.quantity} × {it.name} — ₹{it.price} = ₹{it.subtotal}</Typography>
                  ))}
                </Box>
                <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', rowGap: 1 }}>
                  {o.orderStatus === 'PAID' && <Button variant="contained" onClick={() => act(o._id, 'ACCEPTED')} sx={{ bgcolor: '#FF6B35', minHeight: 40, px: 2 }}>Accept</Button>}
                  {o.orderStatus === 'ACCEPTED' && <Button variant="contained" onClick={() => act(o._id, 'PREPARING')} color="warning" sx={{ minHeight: 40 }}>Start Preparing</Button>}
                  {o.orderStatus === 'PREPARING' && <Button variant="contained" onClick={() => act(o._id, 'READY')} color="success" sx={{ minHeight: 40 }}>Mark READY 🔔 Notify</Button>}
                  {o.orderStatus === 'READY' && (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', width: '100%', bgcolor: 'white', p: 1.2, borderRadius: 2, border: '1px solid #E5E7EB', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
                      <TextField size="small" placeholder="Enter #FD-xxxx or scan QR" value={pickupCode[o._id] || ''} onChange={(e) => setPickupCode({ ...pickupCode, [o._id]: e.target.value })} inputProps={{ style: { color: '#1A1A1A' } }} sx={{ flex: 1, minWidth: 160, '& .MuiOutlinedInput-root': { bgcolor: 'white', borderRadius: 1.5, '& fieldset': { borderColor: '#E5E7EB' }, '&:hover fieldset': { borderColor: '#FF6B35' } }, '& .MuiInputBase-input': { color: '#1A1A1A', '&::placeholder': { color: '#6B7280', opacity: 1 } } }} />
                      <Button variant="contained" color="success" onClick={() => handlePickup(o._id)} sx={{ minHeight: 40, whiteSpace: 'nowrap', px: 2.5, fontWeight: 700, boxShadow: 'none', color: 'white' }}>Verify & Picked Up</Button>
                    </Box>
                  )}
                  {canCancel(o.orderStatus) && (
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={() => setCancelTarget(o)}
                      disabled={cancellingId === o._id}
                      sx={{ minHeight: 40, borderColor: '#ef4444', color: '#ef4444', minWidth: 90 }}
                    >
                      {cancellingId === o._id ? <CircularProgress size={18} color="inherit" /> : 'Cancel Order'}
                    </Button>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Alert severity="success" sx={{ mt: 3 }}>
        Workflow: PAID → ACCEPT → PREPARING → READY (customer notified via Socket.IO) → PICKED_UP (QR / code verified)
      </Alert>

      <Dialog open={!!cancelTarget} onClose={() => setCancelTarget(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { m: 2, borderRadius: 3 } }}>
        <DialogTitle fontWeight={700}>Cancel Order?</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to cancel <b>{cancelTarget?.orderNumber}</b>? This cannot be undone. Only PAID / ACCEPTED orders can be cancelled before Preparing.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setCancelTarget(null)} variant="outlined" sx={{ minHeight: 40, flex: 1 }}>Keep Order</Button>
          <Button onClick={confirmCancel} variant="contained" color="error" disabled={!!cancellingId} sx={{ minHeight: 40, flex: 1 }}>
            {cancellingId ? <CircularProgress size={18} color="inherit" /> : 'Yes, Cancel'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack({ ...snack, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.sev} onClose={() => setSnack({ ...snack, open: false })} sx={{ width: '100%' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
