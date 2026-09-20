import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, BASE_URL } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';
import QRCode from 'react-native-qrcode-svg';

const steps = ['PAID', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP'] as const;

export default function OrderTracking({ route }: any) {
  const insets = useSafeAreaInsets();
  const { orderId } = route.params;
  const [order, setOrder] = useState<any>(null);
  const [qr, setQr] = useState<any>(null);

  const load = async () => {
    const { data } = await api.get(`/orders/${orderId}`);
    setOrder(data);
    try {
      const { data: qrData } = await api.get(`/orders/${orderId}/qr`);
      setQr(qrData);
    } catch {}
  };

  useEffect(() => {
    load();
    let socket: any;
    (async () => {
      const token = await AsyncStorage.getItem('token');
      socket = io(BASE_URL, { auth: { token } });
      socket.emit('join:order', orderId);
      socket.on('order:update', (o: any) => { if (o._id === orderId) setOrder(o); });
      socket.on('order:ready', (o: any) => { if (o._id === orderId) setOrder(o); });
    })();
    const interval = setInterval(load, 5000); // fallback polling
    return () => { clearInterval(interval); socket?.disconnect(); };
  }, []);

  if (!order) return <View style={[s.center, { paddingTop: insets.top + 16 }]}><ActivityIndicator color="#FF6B35" /></View>;

  const idx = steps.indexOf(order.orderStatus);
  const isReady = order.orderStatus === 'READY';
  const isPicked = order.orderStatus === 'PICKED_UP';

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}>
      <Text style={s.orderNo}>Order {order.orderNumber}</Text>
      <Text style={s.sub}>{new Date(order.createdAt).toLocaleString()} • ₹{order.totalAmount}</Text>

      <View style={[s.banner, { backgroundColor: isReady ? '#DCFCE7' : isPicked ? '#E0E7FF' : '#FFF2EC' }]}>
        <Text style={s.bannerTitle}>
          {isReady ? '✅ Your food is READY! Please visit the restaurant for pickup.' : isPicked ? '🎉 Picked up — Enjoy your meal!' : '⏳ Please wait until your order is READY before coming.'}
        </Text>
        <Text style={{ color: '#666', fontSize: 12, marginTop: 4 }}>Real-time via Socket.IO — no paid push needed in MVP</Text>
      </View>

      <View style={s.timeline}>
        {steps.map((step, i) => {
          const done = i <= idx && order.orderStatus !== 'PENDING_PAYMENT';
          const current = i === idx;
          return (
            <View key={step} style={s.stepRow}>
              <View style={[s.dot, done ? s.dotDone : s.dotTodo, current && s.dotCurrent]}><Text style={{ color: done ? 'white' : '#999', fontSize: 10 }}>{done ? '✓' : '○'}</Text></View>
              <View style={{ flex: 1 }}><Text style={[s.stepLabel, done && { fontWeight: '700' }]}>{step}</Text><Text style={s.stepDesc}>{step === 'PAID' ? 'Payment verified' : step === 'READY' ? 'Collect without waiting' : ''}</Text></View>
            </View>
          );
        })}
      </View>

      <View style={s.card}>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Items (snapshot pricing)</Text>
        {order.items.map((it: any) => <Text key={it.name} style={s.itemLine}>{it.quantity} × {it.name} @ ₹{it.price} = ₹{it.subtotal}</Text>)}
        <Text style={{ fontWeight: '800', marginTop: 8 }}>Total ₹{order.totalAmount} • {order.paymentStatus}</Text>
      </View>

      {qr && (
        <View style={s.qrCard}>
          <Text style={{ fontWeight: '700', textAlign: 'center' }}>Pickup QR • Show at counter</Text>
          <Text style={{ textAlign: 'center', color: '#666', fontSize: 12 }}>{order.orderNumber}</Text>
          <View style={{ alignItems: 'center', marginTop: 12 }}>
            <QRCode value={qr.data || order.orderNumber} size={160} />
          </View>
          <View style={{ backgroundColor: '#1A1A1A', padding: 10, borderRadius: 8, marginTop: 12 }}><Text style={{ color: 'white', textAlign: 'center', fontWeight: '700', letterSpacing: 1 }}>{order.orderNumber}</Text></View>
          <Text style={{ textAlign: 'center', color: '#666', fontSize: 11, marginTop: 8 }}>Restaurant can scan QR or enter code manually. Backend verifies: exists, paid, READY, belongs to restaurant, not already picked up.</Text>
        </View>
      )}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  orderNo: { fontSize: 20, fontWeight: '800' }, sub: { color: '#666', fontSize: 12 },
  banner: { padding: 14, borderRadius: 12, marginTop: 12 }, bannerTitle: { fontWeight: '700' },
  timeline: { backgroundColor: 'white', borderRadius: 14, padding: 16, marginTop: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  dot: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  dotDone: { backgroundColor: '#22C55E' }, dotTodo: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' }, dotCurrent: { borderWidth: 2, borderColor: '#FF6B35' },
  stepLabel: { fontWeight: '600' }, stepDesc: { color: '#666', fontSize: 11 },
  card: { backgroundColor: 'white', padding: 14, borderRadius: 14, marginTop: 12 },
  itemLine: { paddingVertical: 2, color: '#333' },
  qrCard: { backgroundColor: 'white', padding: 16, borderRadius: 16, marginTop: 12, alignItems: 'stretch' }
});
