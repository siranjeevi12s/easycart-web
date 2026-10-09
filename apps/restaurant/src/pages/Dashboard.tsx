import { useEffect, useState } from 'react';
import { Alert, Box, CircularProgress, Grid, Typography } from '@mui/material';
import { api } from '../services/api';
import { io } from 'socket.io-client';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import OrderCard from '../components/OrderCard';
import CancelOrderDialog from '../components/CancelOrderDialog';
import EmptyState from '../components/EmptyState';
import { useSnack } from '../components/useSnack';

export default function Dashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ new: 0, preparing: 0, ready: 0 });
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const { show, fail, host } = useSnack();

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
      show(`New order ${order.orderNumber} — ₹${order.totalAmount} — PAID`);
      // Optional: browser notification
      if ('Notification' in window && Notification.permission === 'granted') new Notification(`New order ${order.orderNumber}`, { body: `₹${order.totalAmount} — ${order.items?.length} items` });
    });
    socket.on('order:update', (order: any) => {
      fetch();
      if (order.orderStatus === 'CANCELLED') show(`Order ${order.orderNumber} cancelled`, 'error');
    });
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    return () => { socket.disconnect(); };
  }, [show]);

  const act = async (id: string, status: string) => {
    try {
      await api.patch(`/orders/${id}/status`, { status });
      fetch();
      if (status === 'READY') show('Order marked READY — customer notified');
    } catch (e: any) {
      fail(e, `Failed to update to ${status}`);
    }
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setCancellingId(cancelTarget._id);
    try {
      await api.patch(`/orders/${cancelTarget._id}/status`, { status: 'CANCELLED' });
      show(`Order ${cancelTarget.orderNumber} cancelled`);
      setCancelTarget(null);
      fetch();
    } catch (e: any) {
      fail(e, 'Cancellation failed — order may have moved to Preparing');
    } finally {
      setCancellingId(null);
    }
  };

  const handlePickup = async (id: string, code: string) => {
    if (!code) { show('Enter customer order code #FD-xxxx or scan QR', 'error'); return; }
    try {
      await api.post(`/orders/${id}/pickup`, { orderNumber: code, qrData: code });
      show('Pickup verified — order completed');
      fetch();
    } catch (e: any) {
      fail(e, 'Verification failed — check code');
    }
  };

  if (loading) return <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}><CircularProgress color="primary" /></Box>;

  const active = orders.filter((o) => !['PICKED_UP', 'CANCELLED'].includes(o.orderStatus)).slice(0, 6);

  return (
    <Box>
      <PageHeader title="Good evening, Chef 👋" sub="Orders before they arrive — prepare, mark READY, instant pickup." />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <StatCard value={stats.new} label="New Paid Orders" highlight />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard value={stats.preparing} label="Preparing" />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard value={stats.ready} label="Ready for Pickup" />
        </Grid>
      </Grid>

      <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Active Orders — Priority Queue</Typography>
      {active.length === 0 && <EmptyState message="No active orders. New pre-paid orders will appear here instantly." />}
      <Grid container spacing={2}>
        {active.map((o) => (
          <Grid item xs={12} md={6} key={o._id}>
            <OrderCard order={o} onStatus={act} onPickup={handlePickup} onCancel={setCancelTarget} cancellingId={cancellingId} />
          </Grid>
        ))}
      </Grid>
      <Alert severity="success" sx={{ mt: 3 }}>
        Workflow: PAID → ACCEPT → PREPARING → READY (customer notified via Socket.IO) → PICKED_UP (QR / code verified)
      </Alert>

      <CancelOrderDialog orderNumber={cancelTarget?.orderNumber} busy={!!cancellingId} onClose={() => setCancelTarget(null)} onConfirm={confirmCancel} />
      {host}
    </Box>
  );
}
