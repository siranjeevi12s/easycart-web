import { useEffect, useState, useCallback } from 'react';
import { ScrollView, View } from 'react-native';
import { Icon, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, BASE_URL } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';
import QRCode from 'react-native-qrcode-svg';
import { Screen } from '../components/Screen';
import { AppText } from '../components/AppText';
import { AppCard } from '../components/AppCard';
import { LoadingView } from '../components/LoadingView';
import { palette } from '../theme/tokens';
import { useAppThemeMode } from '../theme/ThemeContext';

const steps = ['PAID', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP'] as const;
const stepHelp: Record<string, string> = {
  PAID: 'Payment verified',
  ACCEPTED: 'Restaurant accepted',
  PREPARING: 'Being prepared',
  READY: 'Collect without waiting',
  PICKED_UP: 'Enjoy your meal',
};

export default function OrderTracking({ route }: any) {
  const theme = useTheme();
  const { mode } = useAppThemeMode();
  const p = palette[mode];
  const insets = useSafeAreaInsets();
  const { orderId } = route.params;
  const [order, setOrder] = useState<any>(null);
  const [qr, setQr] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/orders/${orderId}`);
      setOrder(data);
      try {
        const { data: qrData } = await api.get(`/orders/${orderId}/qr`);
        setQr(qrData);
      } catch {}
    } catch {}
  }, [orderId]);

  useEffect(() => {
    load();
    let sock: any;
    (async () => {
      const token = await AsyncStorage.getItem('token');
      sock = io(BASE_URL, { auth: { token }, transports: ['websocket', 'polling'] });
      const raw = await AsyncStorage.getItem('user');
      const customerId = raw ? JSON.parse(raw).id || JSON.parse(raw)._id : null;
      if (customerId) sock.emit('join:customer', customerId);
      sock.on('order:update', (o: any) => { if (o._id === orderId) setOrder(o); });
      sock.on('order:ready', (o: any) => { if (o._id === orderId) setOrder(o); });
    })();
    const interval = setInterval(load, 5000);
    return () => { clearInterval(interval); sock?.disconnect(); };
  }, [orderId, load]);

  if (!order) return <LoadingView />;

  const idx = steps.indexOf(order.orderStatus);
  const bannerKind = order.orderStatus === 'READY' ? 'success' : order.orderStatus === 'PICKED_UP' ? 'info' : 'warning';
  const bannerBg = bannerKind === 'success' ? p.successSoft : bannerKind === 'info' ? p.infoSoft : p.primarySoft;
  const bannerFg = bannerKind === 'success' ? p.success : bannerKind === 'info' ? p.info : p.primary;
  const bannerText =
    order.orderStatus === 'READY'
      ? 'Your food is READY! Please visit the restaurant for pickup.'
      : order.orderStatus === 'PICKED_UP'
        ? 'Picked up — Enjoy your meal!'
        : 'Please wait until your order is READY before coming.';

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }} showsVerticalScrollIndicator={false}>
        <AppText variant="title">Order {order.orderNumber}</AppText>
        <AppText variant="caption" tone="muted">
          {new Date(order.createdAt).toLocaleString()} • ₹{order.totalAmount}
        </AppText>

        <View style={{ padding: 14, borderRadius: 12, marginTop: 12, backgroundColor: bannerBg, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <Icon source={bannerKind === 'success' ? 'check-circle' : bannerKind === 'info' ? 'party-popper' : 'clock-outline'} size={28} color={bannerFg} />
          <View style={{ flex: 1 }}>
            <AppText variant="bodyBold" style={{ color: bannerFg }}>
              {bannerText}
            </AppText>
            <AppText variant="caption" tone="muted" style={{ marginTop: 2 }}>
              Real-time via Socket.IO — no paid push needed in MVP
            </AppText>
          </View>
        </View>

        <AppCard style={{ marginTop: 12 }}>
          {steps.map((step, i) => {
            const done = i <= idx && order.orderStatus !== 'PENDING_PAYMENT';
            const current = i === idx;
            return (
              <View key={step} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }} accessible accessibilityLabel={`${step}${done ? ', done' : ''}${current ? ', current' : ''}`}>
                <View
                  style={{
                    width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 12,
                    backgroundColor: done ? p.success : theme.colors.surfaceVariant,
                    borderWidth: current && !done ? 2 : done ? 0 : 1,
                    borderColor: current && !done ? p.primary : p.border,
                  }}
                >
                  <Icon source={done ? 'check' : 'circle-outline'} size={14} color={done ? '#FFFFFF' : p.faint} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant={done ? 'bodyBold' : 'body'}>{step}</AppText>
                  {!!stepHelp[step] && (
                    <AppText variant="caption" tone="muted">
                      {stepHelp[step]}
                    </AppText>
                  )}
                </View>
              </View>
            );
          })}
        </AppCard>

        <AppCard style={{ marginTop: 0 }}>
          <AppText variant="bodyBold" style={{ marginBottom: 8 }}>
            Items (snapshot pricing)
          </AppText>
          {order.items.map((it: any) => (
            <AppText key={it.name} variant="body" tone="muted" style={{ paddingVertical: 2 }}>
              {it.quantity} × {it.name} @ ₹{it.price} = ₹{it.subtotal}
            </AppText>
          ))}
          <AppText variant="bodyBold" style={{ marginTop: 8 }}>
            Total ₹{order.totalAmount} • {order.paymentStatus}
          </AppText>
        </AppCard>

        {qr && (
          <AppCard style={{ alignItems: 'stretch' }}>
            <AppText variant="bodyBold" style={{ textAlign: 'center' }}>
              Pickup QR • Show at counter
            </AppText>
            <AppText variant="caption" tone="muted" style={{ textAlign: 'center' }}>
              {order.orderNumber}
            </AppText>
            <View style={{ alignItems: 'center', marginTop: 12 }}>
              <QRCode value={qr.data || order.orderNumber} size={160} />
            </View>
            <View style={{ backgroundColor: '#1A1A1A', padding: 10, borderRadius: 8, marginTop: 12 }}>
              <AppText variant="bodyBold" tone="onPrimary" style={{ textAlign: 'center', letterSpacing: 1 }}>
                {order.orderNumber}
              </AppText>
            </View>
            <AppText variant="caption" tone="muted" style={{ textAlign: 'center', marginTop: 8 }}>
              Restaurant can scan QR or enter code manually. Backend verifies: exists, paid, READY, belongs to restaurant, not already picked up.
            </AppText>
          </AppCard>
        )}
      </ScrollView>
    </Screen>
  );
}
