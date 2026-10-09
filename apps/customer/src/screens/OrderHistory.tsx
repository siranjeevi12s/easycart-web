import { useState, useCallback } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../services/api';
import { Screen } from '../components/Screen';
import { AppText } from '../components/AppText';
import { AppCard } from '../components/AppCard';
import { StatusChip } from '../components/StatusChip';
import { EmptyState } from '../components/EmptyState';
import { LoadingView } from '../components/LoadingView';

export default function OrderHistory({ navigation }: any) {
  const theme = useTheme();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
          </AppCard>
        )}
      />
    </Screen>
  );
}
