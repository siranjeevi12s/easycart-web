import { useContext, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, BASE_URL } from '../services/api';
import { CartContext } from '../context/AppContext';

export default function Checkout({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { cart, clearCart } = useContext(CartContext);
  const [loading, setLoading] = useState(false);
  const [payees, setPayees] = useState<any[]>([]);
  const subtotal = cart.items.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
  const tax = Math.round(subtotal * 0.05);
  const total = subtotal + tax;

  // Group cart lines per restaurant (multi-seller batch: A ₹400 + B ₹350 + C ₹150 ...)
  const groups = useMemo(() => {
    const m = new Map<string, { restaurantId: string; restaurantName: string; items: any[]; subtotal: number }>();
    for (const i of cart.items) {
      const rid = i.restaurantId || (cart as any).restaurantId;
      if (!rid) continue;
      if (!m.has(rid)) m.set(rid, { restaurantId: rid, restaurantName: i.restaurantName || 'Restaurant', items: [], subtotal: 0 });
      const g = m.get(rid)!;
      g.items.push(i);
      g.subtotal += i.price * i.quantity;
      if (i.restaurantName) g.restaurantName = i.restaurantName;
    }
    return [...m.values()];
  }, [cart]);

  // Load each restaurant's payout info so customer sees where money goes
  useEffect(() => {
    let live = true;
    (async () => {
      const out: any[] = [];
      for (const g of groups) {
        try {
          const { data } = await api.get(`/restaurants/${g.restaurantId}/payment-info`);
          out.push(data);
        } catch { out.push(null); }
      }
      if (live) setPayees(out);
    })();
    return () => { live = false; };
  }, [cart]);

  const pay = async () => {
    if (!groups.length) return Alert.alert('Cart is empty');
    setLoading(true);
    try {
      // 1. Create ONE order per restaurant (backend prices + splits). Single payment covers all.
      const { data: batch } = await api.post('/orders', {
        items: cart.items.map((i: any) => ({ restaurantId: i.restaurantId || (cart as any).restaurantId, menuItemId: i._id, quantity: i.quantity }))
      });
      const orders = batch.orders as any[];
      const orderIds = orders.map((o: any) => o._id);
      // 2. Single gateway payment for the combined total (Route transfers[] split per seller)
      const { data: intent } = await api.post('/payments/create', { orderIds, batchId: batch.batchId });

      // Gateway already captured this batch earlier — go straight to tracking, no new charge.
      if (!intent.checkoutPath && (/already paid/i.test(intent.message || '') || (intent.orders || []).every?.((o: any) => o.paymentStatus === 'PAID'))) {
        clearCart();
        setLoading(false);
        navigation.replace('OrderTracking', { orderId: orderIds[0], orderIds, batchId: batch.batchId });
        return;
      }

      const isMock = intent.mode === 'mock' || String(intent.keyId || '').includes('dummy');
      if (isMock) {
        // Dev: mock gateway auto-verifies (backend accepts test_success only with dummy keys)
        const verify = await api.post('/payments/verify', {
          orderIds,
          razorpay_order_id: intent.razorpayOrderId,
          razorpay_payment_id: `pay_${Date.now()}`,
          razorpay_signature: 'test_success'
        });
        const nums = (verify.data.orders || []).map((o: any) => o.orderNumber).join(', ');
        Alert.alert('Payment Success ✅', `Orders ${nums} PAID.`);
        clearCart();
        setLoading(false);
        navigation.replace('OrderTracking', { orderId: orderIds[0], orderIds, batchId: batch.batchId });
        return;
      }

      // 3. Real mode: in-app secure checkout for the combined amount.
      setLoading(false);
      navigation.navigate('Payment', {
        checkoutUrl: `${BASE_URL}${intent.checkoutPath}`,
        orderId: orderIds[0],
        orderIds,
        batchId: intent.batchId || batch.batchId,
        provider: intent.provider || 'razorpay',
      });
    } catch (e: any) {
      const code = e.response?.data?.code;
      const message = e.response?.data?.message || e.message || 'Try again';
      if (code === 'PAYOUT_NOT_CONFIGURED') {
        Alert.alert('Restaurant not accepting payments', message);
      } else {
        Alert.alert('Payment failed', message);
      }
      setLoading(false);
    }
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
      <View style={[s.inner, { paddingTop: insets.top + 16 }]}>
        <Text style={s.title}>Checkout{groups.length > 1 ? ` • ${groups.length} restaurants, one payment` : ''}</Text>
        {groups.map((g) => (
          <View key={g.restaurantId} style={s.card}>
            <Text style={{ fontWeight: '800', color: '#FF6B35' }}>{g.restaurantName}</Text>
            {g.items.map((i: any) => <Text key={i._id} style={s.line}>{i.name} × {i.quantity} = ₹{i.price * i.quantity}</Text>)}
            <View style={s.row}><Text style={{ color: '#666' }}>Subtotal ({g.restaurantName})</Text><Text>₹{g.subtotal}</Text></View>
          </View>
        ))}
        <View style={s.card}>
          <View style={s.row}><Text>Subtotal</Text><Text>₹{subtotal}</Text></View>
          <View style={s.row}><Text>Tax 5%</Text><Text>₹{tax}</Text></View>
          <View style={s.row}><Text style={{ fontWeight: '800' }}>Total (one payment)</Text><Text style={{ fontWeight: '800', color: '#FF6B35' }}>₹{total}</Text></View>
          <Text style={{ fontSize: 11, color: '#666', marginTop: 8 }}>Backend splits this across restaurants and keeps the platform fee — never trusts frontend totals.</Text>
        </View>
        <View style={s.card}>
          <Text style={{ fontWeight: '700' }}>Payment split</Text>
          {payees.map((p: any, idx: number) => (
            <Text key={idx} style={{ color: p?.payoutEnabled ? '#666' : '#B45309', fontSize: 12, marginTop: 4 }}>
              {p ? (p.payoutEnabled ? `• ${p.restaurantName}: settles to ${p.payoutMode === 'UPI' && p.payoutUpiId ? `UPI ${p.payoutUpiId}` : p.payoutBankName || 'bank account'}` : `• ⚠️ ${p.restaurantName} payouts not configured`) : '• Verifying…'}
            </Text>
          ))}
        </View>
        <TouchableOpacity style={[s.btn, loading && { opacity: 0.6 }]} onPress={pay} disabled={loading}>
          <Text style={s.btnText}>{loading ? 'Processing…' : `Pay ₹${total}`}</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 11, color: '#666', marginTop: 8, textAlign: 'center' }}>UPI • Cards • Netbanking — stays inside the app</Text>
      </View>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F5' },
  inner: { padding: 16 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 12 },
  card: { backgroundColor: 'white', padding: 16, borderRadius: 14, marginBottom: 12 },
  line: { paddingVertical: 2 },
  divider: { height: 1, backgroundColor: '#FFE8DE', marginVertical: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  btn: { backgroundColor: '#FF6B35', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  btnText: { color: 'white', fontWeight: '800' }
});
