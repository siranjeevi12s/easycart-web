/** Kitchen order card: status flow actions + code pickup verify + cancel. */
import { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { AppCard } from './AppCard';
import { AppText } from './AppText';
import { AppButton } from './AppButton';
import { AppTextField } from './AppTextField';
import { StatusChip } from './StatusChip';
import { brand } from '../theme/tokens';

export const canCancelOrder = (status: string) => status === 'PAID' || status === 'ACCEPTED';

interface Props {
  order: any;
  onStatus: (id: string, status: string) => void;
  onPickup: (id: string, code: string) => void;
  onCancel: (order: any) => void;
  onScanRequest?: (order: any) => void;
  cancellingId: string | null;
  showRestaurant?: boolean;
}

export function OrderCard({ order: o, onStatus, onPickup, onCancel, onScanRequest, cancellingId, showRestaurant = false }: Props) {
  const theme = useTheme();
  const [code, setCode] = useState('');
  const edge = o.orderStatus === 'PAID' ? brand.primary : o.orderStatus === 'READY' ? '#218653' : '#E6A21A';

  return (
    <AppCard outlined style={{ borderLeftWidth: 4, borderLeftColor: edge }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <AppText variant="bodyBold" style={{ flex: 1 }}>
          {o.orderNumber}
          {showRestaurant && ` — ${typeof o.restaurantId === 'object' ? o.restaurantId?.name : o.restaurantId}`}
        </AppText>
        <StatusChip status={`${o.orderStatus} • ${o.paymentStatus}`} />
      </View>
      <AppText variant="caption" tone="muted" style={{ marginTop: 4 }}>
        {new Date(o.createdAt).toLocaleString()} • ₹{o.totalAmount}
        {o.subtotal !== undefined && ` (sub ₹${o.subtotal} + tax ₹${o.tax})`} • {o.paymentStatus}
      </AppText>
      <View style={{ marginTop: 8 }}>
        {(o.items || []).map((it: any, i: number) => (
          <AppText key={`${it.name}-${i}`} variant="body">
            {it.quantity} × {it.name} @ ₹{it.price}
            {it.subtotal !== undefined && ` = ₹${it.subtotal}`}
          </AppText>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {o.orderStatus === 'PAID' && (
          <AppButton title="Accept" compact onPress={() => onStatus(o._id, 'ACCEPTED')} />
        )}
        {o.orderStatus === 'ACCEPTED' && (
          <AppButton title="Start Preparing" compact onPress={() => onStatus(o._id, 'PREPARING')} />
        )}
        {o.orderStatus === 'PREPARING' && (
          <AppButton title="Mark READY" compact onPress={() => onStatus(o._id, 'READY')} />
        )}
        {canCancelOrder(o.orderStatus) && (
          <AppButton
            title="Cancel Order"
            variant="outline"
            compact
            loading={cancellingId === o._id}
            onPress={() => onCancel(o)}
            style={{ borderColor: theme.colors.error }}
          />
        )}
      </View>
      {o.orderStatus === 'READY' && (
        <View
          style={{
            marginTop: 12,
            padding: 10,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.colors.outline,
            backgroundColor: theme.colors.surface,
          }}
        >
          <AppText variant="captionBold" tone="success" style={{ marginBottom: 8 }}>
            READY — verify customer pickup code
          </AppText>
          {onScanRequest && (
            <AppButton
              title="Scan Customer QR"
              icon="qrcode-scan"
              compact
              onPress={() => onScanRequest(o)}
              style={{ marginBottom: 8 }}
            />
          )}
          <AppTextField
            label="Pickup code (#FD-xxxx)"
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            placeholder="Enter #FD-xxxx"
          />
          <AppButton
            title="Verify & Picked Up"
            compact
            onPress={() => {
              onPickup(o._id, code.trim());
              setCode('');
            }}
          />
        </View>
      )}
    </AppCard>
  );
}
