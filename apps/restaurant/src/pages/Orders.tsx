import { useEffect, useState } from 'react';
import { Box, CircularProgress, Stack, Tabs, Tab, Typography } from '@mui/material';
import { api } from '../services/api';
import PageHeader from '../components/PageHeader';
import OrderCard from '../components/OrderCard';
import CancelOrderDialog from '../components/CancelOrderDialog';
import { useSnack } from '../components/useSnack';

const FILTERS = ['all', 'PAID', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP', 'CANCELLED'];

export default function Orders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const { show, fail, host } = useSnack();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/orders' + (filter === 'all' ? '' : `?status=${filter}`));
      setOrders(data);
    } catch (e: any) {
      fail(e, 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [filter]);

  const update = async (id: string, status: string) => {
    try {
      await api.patch(`/orders/${id}/status`, { status });
      if (status === 'READY') show('Order marked READY — customer notified');
      load();
    } catch (e: any) {
      fail(e, `Failed to update to ${status}`);
    }
  };
  const pickup = async (id: string, code: string) => {
    if (!code) { show('Enter customer order code #FD-xxxx or scan QR', 'error'); return; }
    try {
      await api.post(`/orders/${id}/pickup`, { orderNumber: code, qrData: code });
      show('Pickup verified — order completed');
      load();
    } catch (e: any) {
      fail(e, 'Verification failed — check code');
    }
  };
  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setCancellingId(cancelTarget._id);
    try {
      await api.patch(`/orders/${cancelTarget._id}/status`, { status: 'CANCELLED' });
      show(`Order ${cancelTarget.orderNumber} cancelled`);
      setCancelTarget(null);
      load();
    } catch (e: any) {
      fail(e, 'Cancellation failed');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Order Management"
        sub="Accept • Prepare • READY • Verify pickup (QR / order code). Backend enforces state machine & ownership."
      />
      <Tabs value={filter} onChange={(_, v) => setFilter(v)} sx={{ mb: 2 }} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
        {FILTERS.map((f) => (
          <Tab key={f} label={f === 'all' ? 'All' : f} value={f} />
        ))}
      </Tabs>
      {loading ? <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress color="primary" /></Box> :
        <Stack spacing={2}>
          {orders.map((o) => (
            <OrderCard key={o._id} order={o} onStatus={update} onPickup={pickup} onCancel={setCancelTarget} cancellingId={cancellingId} showRestaurant />
          ))}
          {orders.length === 0 && <Typography color="text.secondary">No orders for this filter.</Typography>}
        </Stack>
      }

      <CancelOrderDialog orderNumber={cancelTarget?.orderNumber} busy={!!cancellingId} onClose={() => setCancelTarget(null)} onConfirm={confirmCancel} />
      {host}
    </Box>
  );
}
