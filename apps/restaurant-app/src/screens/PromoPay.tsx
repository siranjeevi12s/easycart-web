import { useEffect, useRef, useState } from 'react';
import { View, Alert, Linking } from 'react-native';
import { ActivityIndicator, useTheme } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import { api } from '../services/api';
import { AppText } from '../components/AppText';
import { AppButton } from '../components/AppButton';
import { EmptyState } from '../components/EmptyState';

const CALLBACK_PREFIX = 'easycart://payment-callback';
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

/** Hosted Razorpay checkout for a promo purchase. Verifies → campaign awaits admin approval. */
export default function PromoPay({ route, navigation }: any) {
  const theme = useTheme();
  const { checkoutUrl, campaignId } = route.params || {};
  const [verifying, setVerifying] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const webRef = useRef<any>(null);
  const doneRef = useRef(false);
  const pollRef = useRef<any>(null);

  const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  useEffect(() => () => stopPolling(), []);

  const onPaid = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    stopPolling();
    Alert.alert('Payment received', 'Your campaign is now awaiting admin approval. You will go live once approved.');
    navigation.replace('Main', { screen: 'Promote' });
  };

  // Webhook may confirm even if the deep-link return is missed — poll as backup
  useEffect(() => {
    if (!campaignId) return;
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/promos/campaigns/${campaignId}`);
        if (data?.campaign && data.campaign.status !== 'payment_pending') onPaid();
      } catch {}
    }, 4000);
    const t = setTimeout(stopPolling, 5 * 60 * 1000);
    return () => { stopPolling(); clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const verify = async (p: Record<string, string>) => {
    if (doneRef.current || verifying) return;
    setVerifying(true);
    try {
      const { data } = await api.post('/promos/verify', {
        campaignId,
        razorpay_order_id: p.razorpay_order_id,
        razorpay_payment_id: p.razorpay_payment_id,
        razorpay_signature: p.razorpay_signature,
      });
      if (data?.campaign) onPaid();
      else throw new Error('Unexpected response');
    } catch (e: any) {
      setVerifying(false);
      setFailed(e.response?.data?.message || 'Verification failed — if money was debited, it will auto-refund. Contact support.');
    } finally {
      setVerifying(false);
    }
  };

  const handleCallback = (p: Record<string, string>): boolean => {
    if (p.orderId && p.orderId !== campaignId) return false;
    if (p.cancelled === '1') {
      Alert.alert('Payment cancelled', 'No money was charged. You can retry anytime.');
      navigation.goBack();
    } else if (p.razorpay_order_id && p.razorpay_payment_id && p.razorpay_signature) {
      verify(p);
    }
    return false;
  };

  const onBridgeMessage = (e: any) => {
    try {
      const p = JSON.parse(e.nativeEvent.data);
      if (p && typeof p === 'object') handleCallback(p as Record<string, string>);
    } catch {}
  };

  const handleUrl = (url: string): boolean => {
    if (url.startsWith(CALLBACK_PREFIX)) {
      handleCallback(parseQuery(url));
      return false;
    }
    if (APP_SCHEMES.some((s) => url.startsWith(s))) {
      Linking.openURL(url).catch(() => {
        Alert.alert('App not found', 'No UPI app handled this request. Try your UPI ID instead.');
      });
      return false;
    }
    return true;
  };

  if (!checkoutUrl || !campaignId) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: theme.colors.background }}>
        <EmptyState icon="alert-circle" message="Invalid payment session." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {verifying && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)', zIndex: 10 }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <AppText variant="bodyBold" style={{ marginTop: 8 }}>Confirming payment…</AppText>
        </View>
      )}
      {failed ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <AppText variant="heading" style={{ marginBottom: 8 }}>Payment not completed</AppText>
          <AppText variant="body" tone="muted" style={{ textAlign: 'center' }}>{failed}</AppText>
          <AppButton title="Retry payment" onPress={() => { setFailed(null); webRef.current?.reload(); }} style={{ marginTop: 16, minWidth: 200 }} />
          <AppButton title="Back" variant="outline" onPress={() => navigation.goBack()} style={{ marginTop: 8, minWidth: 200 }} />
        </View>
      ) : (
        <WebView
          ref={webRef}
          source={{ uri: checkoutUrl }}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <AppText variant="body" tone="muted" style={{ marginTop: 8 }}>Loading secure checkout…</AppText>
            </View>
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
