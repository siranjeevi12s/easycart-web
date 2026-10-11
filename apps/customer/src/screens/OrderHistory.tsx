import { useState, useCallback, useContext } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../services/api';
import { CartContext } from '../context/AppContext';
import { Screen } from '../components/Screen';
import { AppText } from '../components/AppText';
import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { StatusChip } from '../components/StatusChip';
import { EmptyState } from '../components/EmptyState';
import { LoadingView } from '../components/LoadingView';
import { useSnackbar } from '../components/Snackbar';

export default function OrderHistory({ navigation }: any) {
  const theme = useTheme();
  const snack = useSnackbar();
  const { addToCart, clearCart } = useContext(CartContext);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get('/orders');
      setOrders(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  // Reorder: re-add a past order's lines to the (cleared) cart, then open Cart.
  // Availability/pricing re-validates server-side at checkout — nothing trusted here.
  const reorder = async (order: any) => {
    setReorderingId(order._id);
    try {
      clearCart();
      for (const it of order.items || []) {
        const times = Math.max(1, it.quantity || 1);
        for (let i = 0; i < times; i++) {
          addToCart(it.restaurantId || order.restaurantId, { _id: it.menuItemId || it._id, name: it.name, price: it.price, image: it.image }, it.restaurantName);
        }
      }
      snack.show(`Reordering ${order.orderNumber} — review in cart`);
      navigation.navigate('Cart');
    } finally {
      setReorderingId(null);
    }
  };

  if (loading) return <LoadingView message="Loading orders…" />;

  return (
    <Screen>
      <AppText variant="title" style={{ marginBottom: 12 }}>
        Order History
      </AppText>
      <FlatList
        data={orders}
        keyExtractor={(i) => i._id}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} colors={[theme.colors.primary]} />}
        ListEmptyComponent={<EmptyState icon="package-variant" message="No orders yet." hint="Search a restaurant and pre-order!" />}
        renderItem={({ item }) => (
          <AppCard onPress={() => navigation.navigate('OrderTracking', { orderId: item._id })} accessibilityLabel={`Order ${item.orderNumber}, ${item.orderStatus}`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <AppText variant="bodyBold">{item.orderNumber}</AppText>
              <StatusChip status={item.orderStatus} />
            </View>
            <AppText variant="caption" tone="muted" style={{ marginTop: 4 }}>
              {new Date(item.createdAt).toLocaleString()} • ₹{item.totalAmount}
            </AppText>
            <AppText variant="body" style={{ marginTop: 6 }} numberOfLines={1}>
              {item.items.map((it: any) => `${it.quantity}× ${it.name}`).join(', ')}
            </AppText>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <AppButton title="Track" compact variant="outline" onPress={() => navigation.navigate('OrderTracking', { orderId: item._id })} style={{ flex: 1 }} />
              <AppButton
                title={reorderingId === item._id ? 'Adding…' : 'Reorder'}
                compact
                onPress={() => reorder(item)}
                loading={reorderingId === item._id}
                style={{ flex: 1 }}
              />
            </View>
          </AppCard>
        )}
      />
    </Screen>
  );
}
