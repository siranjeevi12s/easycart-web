import { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { ActivityIndicator, Chip, Searchbar, useTheme } from 'react-native-paper';
import { api } from '../services/api';
import { Screen } from '../components/Screen';
import { AppText } from '../components/AppText';
import { OrderCard, canCancelOrder } from '../components/OrderCard';
import { QRScanner } from '../components/QRScanner';
import { EmptyState } from '../components/EmptyState';
import { useSnackbar } from '../components/Snackbar';

const FILTERS = ['all', 'PAID', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP', 'CANCELLED'];

export default function Orders() {
  const theme = useTheme();
  const { show } = useSnackbar();
  const [orders, setOrders] = useState<any[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [restId, setRestId] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [scanTarget, setScanTarget] = useState<any | null>(null);

  const load = useCallback(async () => {
    try {
      const my = await api.get('/restaurants/my').catch(() => ({ data: [] }));
      setRestaurants(my.data || []);
      const p = new URLSearchParams();
      if (filter !== 'all') p.set('status', filter);
      if (restId !== 'all') p.set('restaurantId', restId);
      if (query.trim()) p.set('search', query.trim());
      const qs = p.toString();
      const { data } = await api.get('/orders' + (qs ? `?${qs}` : ''));
      setOrders(data);
    } catch (e: any) {
      show(e.response?.data?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, restId, query, show]);

  useEffect(() => {
    const t = setTimeout(load, query ? 400 : 0);
    return () => clearTimeout(t);
  }, [load]);

  const update = async (id: string, status: string) => {
    try {
      await api.patch(`/orders/${id}/status`, { status });
      if (status === 'READY') show('Order marked READY — customer notified');
      load();
    } catch (e: any) {
      Alert.alert('Update failed', e.response?.data?.message || `Failed to update to ${status}`);
    }
  };

  const pickup = async (id: string, code: string) => {
    if (!code) return Alert.alert('Pickup code', 'Enter customer order code #FD-xxxx');
    try {
      await api.post(`/orders/${id}/pickup`, { orderNumber: code, qrData: code });
      show('Pickup verified — order completed');
      load();
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
            load();
          } catch (e: any) {
            Alert.alert('Cancellation failed', e.response?.data?.message || 'Failed');
          } finally {
            setCancellingId(null);
          }
        },
      },
    ]);
  };

  return (
    <Screen scroll={false} topPad={8}>
      <AppText variant="title" style={{ marginBottom: 4 }}>Orders</AppText>
      <Searchbar
        placeholder="Search order # (FD-xxxx)"
        value={query}
        onChangeText={setQuery}
        style={{ marginBottom: 8, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.outline }}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4, flexGrow: 0 }}>
        <View style={{ flexDirection: 'row', gap: 6, paddingRight: 16 }}>
          {FILTERS.map((f) => (
            <Chip key={f} selected={filter === f} onPress={() => setFilter(f)} compact>
              {f === 'all' ? 'All' : f}
            </Chip>
          ))}
        </View>
      </ScrollView>
      {restaurants.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8, flexGrow: 0 }}>
          <View style={{ flexDirection: 'row', gap: 6, paddingRight: 16 }}>
            <Chip selected={restId === 'all'} onPress={() => setRestId('all')} compact>All outlets</Chip>
            {restaurants.map((r: any) => (
              <Chip key={r._id} selected={restId === r._id} onPress={() => setRestId(r._id)} compact>{r.name}</Chip>
            ))}
          </View>
        </ScrollView>
      )}
      <AppText variant="caption" tone="muted" style={{ marginBottom: 8 }}>
        {orders.length} order{orders.length === 1 ? '' : 's'}
      </AppText>
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {orders.map((o) => (
            <OrderCard key={o._id} order={o} onStatus={update} onPickup={pickup} onCancel={cancel} onScanRequest={setScanTarget} cancellingId={cancellingId} showRestaurant />
          ))}
          {orders.length === 0 && <EmptyState icon="receipt-text-outline" message="No orders for this filter" />}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
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
