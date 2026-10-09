import { useContext, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { Divider, List, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, BASE_URL } from '../services/api';
import { CartContext } from '../context/AppContext';
import { Screen } from '../components/Screen';
import { AppText } from '../components/AppText';
import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { EmptyState } from '../components/EmptyState';
import { QtyStepper } from '../components/QtyStepper';

export default function Checkout({ navigation }: any) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { cart, clearCart, setCart } = useContext(CartContext);
  const [loading, setLoading] = useState(false);
  const [payees, setPayees] = useState<any[]>([]);
  const subtotal = cart.items.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
  const tax = Math.round(subtotal * 0.02);
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
  }, [cart, groups]);

  // Same quantity editing as the Cart screen — dropping to 0 removes the line,
  // and an emptied cart falls back to the empty state below.
  const changeQty = (id: string, delta: number) => {
    setCart((prev: any) => {
      const items = prev.items.map((i: any) => i._id === id ? { ...i, quantity: i.quantity + delta } : i).filter((i: any) => i.quantity > 0);
      if (items.length === 0) return { restaurantId: null, items: [] };
      return { ...prev, items };
    });
  };

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
        Alert.alert('Payment Success', `Orders ${nums} PAID.`);
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

  if (!groups.length)
    return (
      <Screen>
        <EmptyState icon="cart-off" message="Nothing to check out" hint="Your cart is empty" />
        <AppButton title="Browse Restaurants" onPress={() => navigation.navigate('Home')} />
      </Screen>
    );

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }} showsVerticalScrollIndicator={false}>
        <AppText variant="title" style={{ marginBottom: 12 }}>
          Checkout{groups.length > 1 ? ` • ${groups.length} restaurants, one payment` : ''}
        </AppText>
        {groups.map((g) => (
          <AppCard key={g.restaurantId}>
            <AppText variant="subheading" tone="primary">
              {g.restaurantName}
            </AppText>
            {g.items.map((i: any) => (
              <View key={i._id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 8 }}>
                <AppText variant="body" style={{ flex: 1 }}>
                  {i.name} × {i.quantity} = ₹{i.price * i.quantity}
                </AppText>
                <QtyStepper small quantity={i.quantity} onChange={(d) => changeQty(i._id, d)} />
              </View>
            ))}
            <AppText variant="body" tone="muted" style={{ marginTop: 4 }}>
              Subtotal ({g.restaurantName}): ₹{g.subtotal}
            </AppText>
          </AppCard>
        ))}
        <AppCard>
          <SummaryRow label="Subtotal" value={`₹${subtotal}`} />
          <SummaryRow label="Tax 2%" value={`₹${tax}`} />
          <Divider style={{ marginVertical: 8 }} />
          <SummaryRow label="Total (one payment)" value={`₹${total}`} bold accent />
          <AppText variant="caption" tone="muted" style={{ marginTop: 8 }}>
            Backend splits this across restaurants and keeps the platform fee — never trusts frontend totals.
          </AppText>
        </AppCard>
        <AppCard>
          <AppText variant="bodyBold">Payment split</AppText>
          {payees.map((p: any, idx: number) => (
            <List.Item
              key={idx}
              title={p ? (p.payoutEnabled ? `${p.restaurantName}: settles to ${p.payoutMode === 'UPI' && p.payoutUpiId ? `UPI ${p.payoutUpiId}` : p.payoutBankName || 'bank account'}` : `${p.restaurantName}: payouts not configured`) : 'Verifying…'}
              titleStyle={{ fontSize: 12, color: p?.payoutEnabled === false ? theme.colors.error : theme.colors.onSurfaceVariant }}
              left={(props) => <List.Icon {...props} icon={p?.payoutEnabled === false ? 'alert' : 'check-circle'} />}
              style={{ paddingVertical: 0, paddingLeft: 0 }}
            />
          ))}
        </AppCard>
        <AppButton title={loading ? 'Processing…' : `Pay ₹${total}`} onPress={pay} loading={loading} style={{ marginTop: 8 }} />
        <AppText variant="caption" tone="muted" style={{ marginTop: 8, textAlign: 'center' }}>
          UPI • Cards • Netbanking — stays inside the app
        </AppText>
      </ScrollView>
    </Screen>
  );
}

function SummaryRow({ label, value, bold = false, accent = false }: { label: string; value: string; bold?: boolean; accent?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
      <AppText variant={bold ? 'bodyBold' : 'body'}>{label}</AppText>
      <AppText variant={bold ? 'bodyBold' : 'body'} tone={accent ? 'primary' : 'text'}>
        {value}
      </AppText>
    </View>
  );
}
