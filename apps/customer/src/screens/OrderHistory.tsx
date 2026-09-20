import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../services/api';

export default function OrderHistory({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    const { data } = await api.get('/orders');
    setOrders(data);
    setLoading(false);
  };
  useFocusEffect(useCallback(() => { load(); }, []));
  if (loading) return <View style={[s.center, { paddingTop: insets.top + 16 }]}><ActivityIndicator color="#FF6B35" /></View>;
  return (
    <View style={[s.container, { paddingTop: insets.top + 16 }]}>
      <Text style={s.title}>Order History</Text>
      <FlatList
        data={orders}
        keyExtractor={(i) => i._id}
        contentContainerStyle={{ paddingBottom: 20 + insets.bottom }}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.card} onPress={() => navigation.navigate('OrderTracking', { orderId: item._id })}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '700' }}>{item.orderNumber}</Text>
              <Text style={[s.badge, { backgroundColor: item.orderStatus === 'READY' ? '#DCFCE7' : item.orderStatus === 'PICKED_UP' ? '#E0E7FF' : '#FFF2EC' }]}>{item.orderStatus}</Text>
            </View>
            <Text style={{ color: '#666', fontSize: 12 }}>{new Date(item.createdAt).toLocaleString()} • ₹{item.totalAmount}</Text>
            <Text style={{ marginTop: 6 }} numberOfLines={1}>{item.items.map((it: any) => `${it.quantity}× ${it.name}`).join(', ')}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#666', marginTop: 30 }}>No orders yet. Search a restaurant and pre-order!</Text>}
      />
    </View>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F5', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 12 },
  card: { backgroundColor: 'white', padding: 14, borderRadius: 12, marginBottom: 8 },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, overflow: 'hidden' }
});
