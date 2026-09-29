import { useContext, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, BASE_URL } from '../services/api';
import { CartContext } from '../context/AppContext';

export default function Checkout({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { cart, clearCart } = useContext(CartContext);
  const [loading, setLoading] = useState(false);
  const [payee, setPayee] = useState<any>(null);
  const subtotal = cart.items.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
  const tax = Math.round(subtotal * 0.05);
  const total = subtotal + tax;

  // Load restaurant payout info so customer sees where money goes (real-world trust)
  useEffect(() => {
    if (!cart.restaurantId) return;
    api.get(`/restaurants/${cart.restaurantId}/payment-info`)
      .then(({ data }) => setPayee(data))
      .catch(() => setPayee(null));
  }, [cart.restaurantId]);

  const pay = async () => {
    if (!cart.restaurantId) return Alert.alert('No restaurant');
    setLoading(true);
    try {
      // 1. Create order (backend prices from MenuItem + computes commission split)
      const { data: order } = await api.post('/orders', {
        restaurantId: cart.restaurantId,
        items: cart.items.map((i: any) => ({ menuItemId: i._id, quantity: i.quantity }))
      });
      // 2. Create Razorpay order (Route transfer attached when restaurant is linked)
      const { data: intent } = await api.post('/payments/create', { orderId: order._id });

      const isMock = intent.mode === 'mock' || String(intent.keyId || '').includes('dummy');
      if (isMock) {
        // Dev: mock gateway auto-verifies (backend accepts test_success only with dummy keys)
        const verify = await api.post('/payments/verify', {
          orderId: order._id,
          razorpay_order_id: intent.razorpayOrderId,
          razorpay_payment_id: `pay_${Date.now()}`,
          razorpay_signature: 'test_success'
        });
        Alert.alert('Payment Success ✅', `Order ${verify.data.order.orderNumber} PAID.`);
        clearCart();
        navigation.replace('OrderTracking', { orderId: verify.data.order._id });
        return;
      }

      // 3. Real mode: in-app secure checkout. UPI taps hand off to the user's
      //    UPI apps (GPay/PhonePe/Paytm); result returns automatically for verify.
      setLoading(false);
      navigation.navigate('Payment', {
        checkoutUrl: `${BASE_URL}${intent.checkoutPath}`,
        orderId: order._id,
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
        <Text style={s.title}>Checkout</Text>
        <View style={s.card}>
          {cart.items.map((i: any) => <Text key={i._id} style={s.line}>{i.name} × {i.quantity} = ₹{i.price * i.quantity}</Text>)}
          <View style={s.divider} />
          <View style={s.row}><Text>Subtotal</Text><Text>₹{subtotal}</Text></View>
          <View style={s.row}><Text>Tax 5%</Text><Text>₹{tax}</Text></View>
          <View style={s.row}><Text style={{ fontWeight: '800' }}>Total</Text><Text style={{ fontWeight: '800', color: '#FF6B35' }}>₹{total}</Text></View>
          <Text style={{ fontSize: 11, color: '#666', marginTop: 8 }}>Backend will recalculate — never trusts frontend total.</Text>
        </View>
        <View style={s.card}>
          <Text style={{ fontWeight: '700' }}>
            {payee?.payoutEnabled ? `Paying to ${payee.restaurantName}` : 'Payment destination'}
          </Text>
          {payee ? (
            payee.payoutEnabled ? (
              <Text style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
                {payee.payoutMode === 'UPI' && payee.payoutUpiId
                  ? `Settles to restaurant UPI ${payee.payoutUpiId} via Razorpay.`
                  : `Settles to ${payee.payoutBankName || 'restaurant bank account'} via Razorpay.`}
              </Text>
            ) : (
              <Text style={{ color: '#B45309', fontSize: 12, marginTop: 4 }}>
                ⚠️ This restaurant hasn't configured payouts yet — payment may be unavailable.
              </Text>
            )
          ) : (
            <Text style={{ color: '#666', fontSize: 12, marginTop: 4 }}>Verifying restaurant payment setup…</Text>
          )}
        </View>
        <TouchableOpacity style={[s.btn, loading && { opacity: 0.6 }]} onPress={pay} disabled={loading}>
          <Text style={s.btnText}>{loading ? 'Processing…' : `Pay ₹${total} • Razorpay`}</Text>
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
