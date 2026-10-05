import { useContext, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { api } from '../services/api';
import { CartContext } from '../context/AppContext';

const CALLBACK_PREFIX = 'easycart://payment-callback';
// UPI + wallet app schemes — intercepted so Android shows the app chooser
// (GPay/PhonePe/Paytm) instead of dying inside the WebView.
const APP_SCHEMES = ['upi://', 'phonepe://', 'tez://', 'gpay://', 'paytmmp://', 'bhim://', 'amazonpay://'];

function parseQuery(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const q = url.split('?')[1] || '';
  for (const part of q.split('&')) {
    const i = part.indexOf('=');
    if (i > 0) out[decodeURIComponent(part.slice(0, i))] = decodeURIComponent(part.slice(i + 1));
  }
  return out;
}

export default function PaymentScreen({ route, navigation }: any) {
  const { checkoutUrl, orderId, orderIds: routeOrderIds, batchId } = route.params || {};
  // Sibling orders covered by this one payment (multi-seller batch)
  const batchIds: string[] = Array.isArray(routeOrderIds) && routeOrderIds.length
    ? routeOrderIds
    : orderId ? [orderId] : [];
  const insets = useSafeAreaInsets();
  const { clearCart } = useContext(CartContext);
  const [verifying, setVerifying] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const webRef = useRef<any>(null);
  const doneRef = useRef(false);
  const pollRef = useRef<any>(null);

  const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  useEffect(() => () => stopPolling(), []);

  const onPaid = (orderNumber?: string) => {
    if (doneRef.current) return;
    doneRef.current = true;
    stopPolling();
    clearCart();
    navigation.replace('OrderTracking', { orderId: batchIds[0], orderIds: batchIds, batchId });
    if (orderNumber) Alert.alert('Payment Success ✅', `Order${batchIds.length > 1 ? `s (${batchIds.length})` : ` ${orderNumber}`} confirmed. Restaurants will prepare.`);
  };

  // Webhook may confirm even if the deep-link return is missed — poll as backup
  useEffect(() => {
    if (!batchIds.length) return;
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/payments/status/${batchIds[0]}`);
        if (data.paymentStatus === 'PAID') onPaid(data.orderNumber);
        else if (['FAILED', 'CANCELLED', 'REFUNDED'].includes(data.paymentStatus)) {
          stopPolling();
          setFailed(`Payment ${data.paymentStatus.toLowerCase()} — no money was captured. You can retry.`);
        }
      } catch {}
    }, 4000);
    const t = setTimeout(stopPolling, 5 * 60 * 1000);
    return () => { stopPolling(); clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const verify = async (p: Record<string, string>) => {
    if (doneRef.current || verifying) return;
    setVerifying(true);
    try {
      // Batch ids can arrive as CSV (deep link) or array (JS bridge)
      const cbIds: string[] = Array.isArray((p as any).orderIds) && (p as any).orderIds.length
        ? (p as any).orderIds
        : typeof p.orderIds === 'string' && p.orderIds
          ? p.orderIds.split(',').filter(Boolean)
          : batchIds;
      const ids = cbIds.length ? cbIds : batchIds;
      const body = {
        orderIds: ids,
        razorpay_order_id: p.razorpay_order_id,
        razorpay_payment_id: p.razorpay_payment_id,
        razorpay_signature: p.razorpay_signature,
      };
      const { data } = await api.post('/payments/verify', body);
      onPaid(data.order?.orderNumber);
    } catch (e: any) {
      setVerifying(false);
      setFailed(e.response?.data?.message || 'Verification failed — if money was debited, it will auto-refund. Contact support with your order id.');
    } finally {
      setVerifying(false);
    }
  };

  /** Shared return handler — used by deep-link interception AND WebView postMessage bridge. */
  const handleCallback = (p: Record<string, string>): boolean => {
    const ids: string[] = Array.isArray((p as any).orderIds) && (p as any).orderIds.length
      ? (p as any).orderIds
      : typeof p.orderIds === 'string' && p.orderIds
        ? p.orderIds.split(',').filter(Boolean)
        : batchIds;
    if (p.orderId && batchIds.length && !batchIds.includes(p.orderId) && !ids.includes(p.orderId)) return false;
    if (p.cancelled === '1') {
      Alert.alert('Payment cancelled', 'No money was charged. You can retry anytime.');
      navigation.goBack();
    } else if (p.razorpay_order_id && p.razorpay_payment_id && p.razorpay_signature) {
      verify(p);
    }
    return false; // consumed — never load inside WebView
  };

  const onBridgeMessage = (e: any) => {
    try {
      const p = JSON.parse(e.nativeEvent.data);
      if (p && typeof p === 'object') handleCallback(p as Record<string, string>);
    } catch {}
  };

  const handleUrl = (url: string): boolean => {
    if (url.startsWith(CALLBACK_PREFIX)) {
      const p = parseQuery(url);
      return handleCallback(p);
    }
    if (APP_SCHEMES.some((s) => url.startsWith(s))) {
      // Hand off to the UPI/wallet app (Android shows the app chooser)
      Linking.openURL(url).catch(() => {
        Alert.alert('App not found', 'No UPI app handled this request. Try paying with your UPI ID instead (you will get a collect request in your UPI app).');
      });
      return false;
    }
    return true;
  };

  if (!checkoutUrl || !batchIds.length) {
    return <View style={s.center}><Text>Invalid payment session.</Text></View>;
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.secureBar}>
        <Text style={s.secureText}>🔒 Secured by Razorpay • UPI • Cards • Netbanking</Text>
      </View>
      {(verifying) && (
        <View style={s.overlay}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={{ marginTop: 8, fontWeight: '700' }}>Confirming payment…</Text>
        </View>
      )}
      {failed ? (
        <View style={s.center}>
          <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: 8 }}>Payment not completed</Text>
          <Text style={{ color: '#666', textAlign: 'center', paddingHorizontal: 24 }}>{failed}</Text>
          <TouchableOpacity style={s.btn} onPress={() => { setFailed(null); webRef.current?.reload(); }}>
            <Text style={s.btnText}>Retry payment</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, s.ghostBtn]} onPress={() => navigation.goBack()}>
            <Text style={s.ghostText}>Back to checkout</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          ref={webRef}
          source={{ uri: checkoutUrl }}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={s.center}><ActivityIndicator size="large" color="#FF6B35" /><Text style={{ marginTop: 8, color: '#666' }}>Loading secure checkout…</Text></View>
          )}
          onShouldStartLoadWithRequest={(req) => handleUrl(req.url)}
          onNavigationStateChange={(nav) => { if (!nav.loading) handleUrl(nav.url); }}
          onMessage={onBridgeMessage}
          onError={() => setFailed('Could not reach the payment page. Check your connection and retry.')}
          onHttpError={(e) => { if (e.nativeEvent.statusCode >= 500) setFailed('Payment server error. Please retry.'); }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  secureBar: { backgroundColor: '#FFF2EC', padding: 8, alignItems: 'center' },
  secureText: { fontSize: 12, color: '#9A3412', fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)', zIndex: 10 },
  btn: { backgroundColor: '#FF6B35', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16, minWidth: 200 },
  btnText: { color: 'white', fontWeight: '800' },
  ghostBtn: { backgroundColor: 'white', borderWidth: 1, borderColor: '#FF6B35' },
  ghostText: { color: '#FF6B35', fontWeight: '800' },
});
