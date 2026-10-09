import { useEffect, useState } from 'react';
import { Box, Button, Chip, CircularProgress, FormControl, InputLabel, MenuItem, Select, Stack, Tabs, Tab, TextField, Typography } from '@mui/material';
import { api } from '../services/api';
import PageHeader from '../components/PageHeader';
import OrderCard from '../components/OrderCard';
import CancelOrderDialog from '../components/CancelOrderDialog';
import { useSnack } from '../components/useSnack';

const FILTERS = ['all', 'PAID', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP', 'CANCELLED'];
const PAYMENTS = ['all', 'PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'];
const DATES = [
  { key: 'all', label: 'Any date' },
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'Last 7 days' },
];
const SORTS = [
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'amount', label: 'Highest amount' },
];

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

export default function Orders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [payment, setPayment] = useState('all');
  const [dateKey, setDateKey] = useState('all');
  const [sort, setSort] = useState('newest');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [restId, setRestId] = useState('all');
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const { show, fail, host } = useSnack();

  const load = async () => {
    setLoading(true);
    try {
      const my = await api.get('/restaurants/my').catch(() => ({ data: [] }));
      setRestaurants(my.data || []);
      const p = new URLSearchParams();
      if (filter !== 'all') p.set('status', filter);
      if (payment !== 'all') p.set('payment', payment);
      if (restId !== 'all') p.set('restaurantId', restId);
      if (debounced.trim()) p.set('search', debounced.trim());
      if (sort !== 'newest') p.set('sort', sort);
      if (dateKey !== 'all') {
        const now = new Date();
        if (dateKey === 'today') p.set('from', startOfDay(now).toISOString());
        else if (dateKey === 'yesterday') {
          const y = new Date(now);
          y.setDate(y.getDate() - 1);
          p.set('from', startOfDay(y).toISOString());
          p.set('to', startOfDay(now).toISOString());
        } else if (dateKey === 'week') {
          const w = new Date(now);
          w.setDate(w.getDate() - 7);
          p.set('from', w.toISOString());
        }
      }
      const qs = p.toString();
      const { data } = await api.get('/orders' + (qs ? `?${qs}` : ''));
      setOrders(data);
    } catch (e: any) {
      fail(e, 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [filter, payment, restId, dateKey, sort, debounced]);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  const activeExtras = (payment !== 'all' ? 1 : 0) + (restId !== 'all' ? 1 : 0) + (dateKey !== 'all' ? 1 : 0) + (sort !== 'newest' ? 1 : 0) + (debounced.trim() ? 1 : 0);
  const clearAll = () => {
    setFilter('all');
    setPayment('all');
    setRestId('all');
    setDateKey('all');
    setSort('newest');
    setQuery('');
    setDebounced('');
  };

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
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search order # (e.g. FD-1024)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ minWidth: 200, flexGrow: { xs: 1, sm: 0 } }}
          aria-label="Search orders"
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Restaurant</InputLabel>
          <Select value={restId} label="Restaurant" onChange={(e) => setRestId(e.target.value)}>
            <MenuItem value="all">All restaurants</MenuItem>
            {restaurants.map((r: any) => <MenuItem key={r._id} value={r._id}>{r.name}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Payment</InputLabel>
          <Select value={payment} label="Payment" onChange={(e) => setPayment(e.target.value)}>
            {PAYMENTS.map((p) => <MenuItem key={p} value={p}>{p === 'all' ? 'Any payment' : p}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Date</InputLabel>
          <Select value={dateKey} label="Date" onChange={(e) => setDateKey(e.target.value)}>
            {DATES.map((d) => <MenuItem key={d.key} value={d.key}>{d.label}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Sort</InputLabel>
          <Select value={sort} label="Sort" onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => <MenuItem key={s.key} value={s.key}>{s.label}</MenuItem>)}
          </Select>
        </FormControl>
        {activeExtras > 0 && (
          <Chip label={`Clear (${activeExtras})`} onDelete={clearAll} size="small" />
        )}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {orders.length} order{orders.length === 1 ? '' : 's'}
        {restId !== 'all' ? ` • ${restaurants.find((r: any) => r._id === restId)?.name || 'restaurant'}` : ''}{filter !== 'all' ? ` • ${filter}` : ''}{payment !== 'all' ? ` • ${payment} payment` : ''}
      </Typography>
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
