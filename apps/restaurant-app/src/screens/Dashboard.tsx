import { useCallback, useContext, useEffect, useState } from 'react';
import { Alert, RefreshControl, View } from 'react-native';
import { ActivityIndicator, useTheme } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';
import { api, BASE_URL } from '../services/api';
import { AuthContext } from '../context/AppContext';
import { Screen } from '../components/Screen';
import { AppText } from '../components/AppText';
import { AppCard } from '../components/AppCard';
import { OrderCard, canCancelOrder } from '../components/OrderCard';
import { QRScanner } from '../components/QRScanner';
import { EmptyState } from '../components/EmptyState';
import { useSnackbar } from '../components/Snackbar';

export default function Dashboard() {
  const theme = useTheme();
  const { user } = useContext(AuthContext);
  const { show } = useSnackbar();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [scanTarget, setScanTarget] = useState<any | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const { data } = await api.get('/orders');
      setOrders(data);
    } catch (e: any) {
      if (!loading) show(e.response?.data?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loading, show]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Real-time: join each owned restaurant room, refetch + alert on new orders
  useEffect(() => {
    let socket: any;
    (async () => {
      const token = await AsyncStorage.getItem('token');
      socket = io(BASE_URL, { auth: { token }, transports: ['websocket', 'polling'] });
      try {
        const { data } = await api.get('/restaurants/my');
        (data || []).forEach((r: any) => socket.emit('join:restaurant', r._id));
      } catch {}
      socket.on('order:new', (order: any) => {
        fetchOrders();
        show(`New order ${order.orderNumber} — ₹${order.totalAmount}`);
        Alert.alert('New order', `${order.orderNumber} — ₹${order.totalAmount} — ${order.items?.length || 0} items (PAID)`);
      });
      socket.on('order:update', (order: any) => {
        fetchOrders();
        if (order.orderStatus === 'CANCELLED') show(`Order ${order.orderNumber} cancelled`);
      });
    })();
    return () => { socket?.disconnect(); };
  }, [fetchOrders, show]);

  const act = async (id: string, status: string) => {
    try {
      await api.patch(`/orders/${id}/status`, { status });
      fetchOrders();
      if (status === 'READY') show('Order marked READY — customer notified');
    } catch (e: any) {
      Alert.alert('Update failed', e.response?.data?.message || `Failed to update to ${status}`);
    }
  };

  const pickup = async (id: string, code: string) => {
    if (!code) return Alert.alert('Pickup code', 'Enter customer order code #FD-xxxx');
    try {
      await api.post(`/orders/${id}/pickup`, { orderNumber: code, qrData: code });
      show('Pickup verified — order completed');
      fetchOrders();
    } catch (e: any) {
      Alert.alert('Verification failed', e.response?.data?.message || 'Check code');
    }
  };

  const cancel = (order: any) => {
    if (!canCancelOrder(order.orderStatus)) return;
    Alert.alert('Cancel order', `Cancel ${order.orderNumber}?`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel order',
        style: 'destructive',
        onPress: async () => {
          setCancellingId(order._id);
          try {
            await api.patch(`/orders/${order._id}/status`, { status: 'CANCELLED' });
            show(`Order ${order.orderNumber} cancelled`);
            fetchOrders();
          } catch (e: any) {
            Alert.alert('Cancellation failed', e.response?.data?.message || 'Order may have moved to Preparing');
          } finally {
            setCancellingId(null);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <Screen scroll={false} style={{ justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </Screen>
    );
  }

  const stats = {
    fresh: orders.filter((o) => o.orderStatus === 'PAID').length,
    preparing: orders.filter((o) => ['ACCEPTED', 'PREPARING'].includes(o.orderStatus)).length,
    ready: orders.filter((o) => o.orderStatus === 'READY').length,
  };
  const active = orders.filter((o) => !['PICKED_UP', 'CANCELLED'].includes(o.orderStatus)).slice(0, 6);

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrders(); }} />}>
      <View>
        <AppText variant="title">Good day, {user?.name?.split(' ')[0] || 'Chef'} 👋</AppText>
        <AppText variant="body" tone="muted" style={{ marginBottom: 16 }}>
          Orders before they arrive — prepare, mark READY, instant pickup.
        </AppText>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <AppCard style={{ flex: 1 }}><AppText variant="display" tone="primary">{stats.fresh}</AppText><AppText variant="caption" tone="muted">New Paid</AppText></AppCard>
          <AppCard style={{ flex: 1 }}><AppText variant="display">{stats.preparing}</AppText><AppText variant="caption" tone="muted">Preparing</AppText></AppCard>
          <AppCard style={{ flex: 1 }}><AppText variant="display" tone="success">{stats.ready}</AppText><AppText variant="caption" tone="muted">Ready</AppText></AppCard>
        </View>

        <AppText variant="heading" style={{ marginTop: 12, marginBottom: 8 }}>Active Orders</AppText>
        {active.length === 0 && (
          <EmptyState icon="receipt-text-outline" message="No active orders" hint="New pre-paid orders will appear here instantly." />
        )}
        {active.map((o) => (
          <OrderCard key={o._id} order={o} onStatus={act} onPickup={pickup} onCancel={cancel} onScanRequest={setScanTarget} cancellingId={cancellingId} />
        ))}
        <AppText variant="caption" tone="muted" style={{ marginTop: 8, marginBottom: 8 }}>
          Workflow: PAID → ACCEPT → PREPARING → READY → PICKED_UP (code verified). Pull down to refresh.
        </AppText>
      </View>
      <QRScanner
        visible={!!scanTarget}
        orderNumber={scanTarget?.orderNumber || ''}
        onClose={() => setScanTarget(null)}
        onScan={(data) => {
          const t = scanTarget;
          setScanTarget(null);
          if (t) pickup(t._id, data);
        }}
      />
    </Screen>
  );
}
