import { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { ActivityIndicator, Chip, SegmentedButtons, useTheme } from 'react-native-paper';
import { api } from '../services/api';
import { Screen } from '../components/Screen';
import { AppText } from '../components/AppText';
import { AppButton } from '../components/AppButton';
import { AppTextField } from '../components/AppTextField';
import { AppCard } from '../components/AppCard';
import { StatusChip } from '../components/StatusChip';
import { EmptyState } from '../components/EmptyState';
import { useSnackbar } from '../components/Snackbar';

export default function Payments() {
  const theme = useTheme();
  const { show } = useSnackbar();
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [routeBusy, setRouteBusy] = useState(false);
  const [mode, setMode] = useState<'UPI' | 'BANK'>('UPI');
  const [upiId, setUpiId] = useState('');
  const [holder, setHolder] = useState('');
  const [account, setAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [bankName, setBankName] = useState('');
  const [linkedAccount, setLinkedAccount] = useState('');
  const [pan, setPan] = useState('');
  const [payout, setPayout] = useState<any>(null);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [settlingId, setSettlingId] = useState<string | null>(null);

  const loadRestaurants = useCallback(async () => {
    try {
      const { data } = await api.get('/restaurants/my');
      setRestaurants(data || []);
      if (data?.length > 0 && !selectedId) setSelectedId(data[0]._id);
    } catch (e: any) {
      show(e.response?.data?.message || 'Failed to load restaurants');
    } finally {
      setLoading(false);
    }
  }, [selectedId, show]);

  const loadPayout = useCallback(async (id: string) => {
    if (!id) return;
    try {
      const { data } = await api.get(`/restaurants/${id}/payout`);
      setPayout(data);
      setMode(data.payoutMode || 'UPI');
      setUpiId(data.payoutUpiId || '');
      setHolder(data.payoutAccountHolder || '');
      setAccount(data.payoutAccountNumber || '');
      setIfsc(data.payoutIfsc || '');
      setBankName(data.payoutBankName || '');
      setLinkedAccount(data.razorpayLinkedAccountId || '');
      const s = await api.get(`/restaurants/${id}/settlements`);
      setSettlements(s.data || []);
    } catch (e: any) {
      show(e.response?.data?.message || 'Failed to load payout details');
    } finally {
      setRefreshing(false);
    }
  }, [show]);

  useEffect(() => { loadRestaurants(); }, [loadRestaurants]);
  useEffect(() => { if (selectedId) loadPayout(selectedId); }, [selectedId, loadPayout]);

  const save = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const body = mode === 'UPI'
        ? { payoutMode: 'UPI', payoutUpiId: upiId.trim(), razorpayLinkedAccountId: linkedAccount.trim() }
        : { payoutMode: 'BANK', payoutAccountHolder: holder.trim(), payoutAccountNumber: account.replace(/\s/g, ''), payoutIfsc: ifsc.trim().toUpperCase(), payoutBankName: bankName.trim(), razorpayLinkedAccountId: linkedAccount.trim() };
      const { data } = await api.put(`/restaurants/${selectedId}/payout`, body);
      show(data.message || 'Payout details saved');
      loadPayout(selectedId);
      loadRestaurants();
    } catch (e: any) {
      Alert.alert('Save failed', e.response?.data?.message || 'Check UPI / IFSC format');
    } finally {
      setSaving(false);
    }
  };

  const onboardRoute = async () => {
    if (!selectedId) return;
    if (!/^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/.test(pan.trim())) {
      return Alert.alert('PAN required', 'Enter a valid 10-character PAN for Route KYC first');
    }
    setRouteBusy(true);
    try {
      const { data } = await api.post(`/restaurants/${selectedId}/route-account`, { pan: pan.trim().toUpperCase() });
      show(data.message || 'Route account created');
      loadPayout(selectedId);
    } catch (e: any) {
      Alert.alert('Route onboarding failed', e.response?.data?.message || 'Error');
    } finally {
      setRouteBusy(false);
    }
  };

  const markSettled = async (orderId: string) => {
    if (!selectedId) return;
    setSettlingId(orderId);
    try {
      await api.patch(`/restaurants/${selectedId}/settlements/${orderId}`, { settlementRef: `UPI-${Date.now()}` });
      show('Marked settled — amount transferred to your account');
      loadPayout(selectedId);
    } catch (e: any) {
      Alert.alert('Failed', e.response?.data?.message || 'Error');
    } finally {
      setSettlingId(null);
    }
  };

  if (loading) {
    return (
      <Screen scroll={false} style={{ justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </Screen>
    );
  }

  if (restaurants.length === 0) {
    return (
      <Screen>
        <EmptyState icon="bank-outline" message="No restaurant profile yet" hint="Create a restaurant profile first (Profile tab), then configure payouts here." />
      </Screen>
    );
  }

  const selected = restaurants.find((r) => r._id === selectedId);
  const e = payout?.earnings;

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); if (selectedId) loadPayout(selectedId); }} />}>
      <AppText variant="title">Payments</AppText>
      <AppText variant="body" tone="muted" style={{ marginBottom: 12 }}>
        Order money settles to the account below.
      </AppText>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, flexGrow: 0 }}>
        <View style={{ flexDirection: 'row', gap: 6, paddingRight: 16 }}>
          {restaurants.map((r: any) => (
            <Chip key={r._id} selected={selectedId === r._id} onPress={() => setSelectedId(r._id)} compact>
              {r.name} {r.payoutEnabled ? '✓' : '• off'}
            </Chip>
          ))}
        </View>
      </ScrollView>

      {selected && !selected.payoutEnabled && (
        <AppCard outlined style={{ backgroundColor: theme.colors.errorContainer }}>
          <AppText variant="bodyBold">{selected.name} cannot receive orders yet</AppText>
          <AppText variant="caption">Complete the form below to go live and receive order amounts.</AppText>
        </AppCard>
      )}
      {payout?.payoutEnabled && (
        <AppCard outlined style={{ backgroundColor: theme.colors.primaryContainer }}>
          <AppText variant="bodyBold" tone="primary">
            Payouts active — {payout.payoutMode === 'UPI' ? `UPI ${payout.payoutUpiId}` : `${payout.payoutBankName} ****${(payout.payoutAccountNumber || '').slice(-4)}`}
          </AppText>
          <AppText variant="caption" tone="primary">
            {payout.settlementMode === 'ROUTE_AUTO' ? 'Razorpay Route auto-split ON' : 'Settlement queued (platform settles to the above account)'}
          </AppText>
        </AppCard>
      )}

      {e && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
          <AppCard style={{ flex: 1, minWidth: '47%' }}><AppText variant="heading" tone="primary">₹{e.totalReceived}</AppText><AppText variant="caption" tone="muted">Received ({e.paidOrders})</AppText></AppCard>
          <AppCard style={{ flex: 1, minWidth: '47%' }}><AppText variant="heading">₹{e.pendingSettlement}</AppText><AppText variant="caption" tone="muted">Pending ({e.pendingCount})</AppText></AppCard>
          <AppCard style={{ flex: 1, minWidth: '47%' }}><AppText variant="heading" tone="success">₹{e.settled}</AppText><AppText variant="caption" tone="muted">Settled ({e.settledCount})</AppText></AppCard>
          <AppCard style={{ flex: 1, minWidth: '47%' }}><AppText variant="heading">₹{e.platformFees ?? 0}</AppText><AppText variant="caption" tone="muted">Fee ({payout?.platformFeePercent ?? 0}%)</AppText></AppCard>
        </View>
      )}

      <AppCard outlined>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <AppText variant="subheading" style={{ flex: 1 }}>Where should order money go?</AppText>
          {payout && <StatusChip status={payout.payoutEnabled ? 'Enabled' : 'Not configured'} kind={payout.payoutEnabled ? 'success' : 'warning'} />}
        </View>
        <SegmentedButtons
          value={mode}
          onValueChange={(v) => setMode(v as 'UPI' | 'BANK')}
          buttons={[{ value: 'UPI', label: 'UPI' }, { value: 'BANK', label: 'Bank' }]}
          style={{ marginBottom: 12 }}
        />
        {mode === 'UPI' ? (
          <AppTextField label="UPI ID *" value={upiId} onChangeText={setUpiId} autoCapitalize="none" placeholder="yourname@okhdfcbank" />
        ) : (
          <>
            <AppTextField label="Account holder name *" value={holder} onChangeText={setHolder} />
            <AppTextField label="Account number *" value={account} onChangeText={(v) => setAccount(v.replace(/[^0-9]/g, ''))} keyboardType="numeric" />
            <AppTextField label="IFSC *" value={ifsc} onChangeText={(v) => setIfsc(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))} autoCapitalize="characters" placeholder="HDFC0001234" />
            <AppTextField label="Bank name *" value={bankName} onChangeText={setBankName} />
          </>
        )}
        <AppButton title={payout?.payoutEnabled ? 'Update payment details' : 'Save & enable payouts'} onPress={save} loading={saving} style={{ marginTop: 4 }} />
        <AppTextField label="Route linked account (optional)" value={linkedAccount} onChangeText={(v) => setLinkedAccount(v.trim())} autoCapitalize="none" placeholder="acc_XXXX" style={{ marginTop: 12 }} />
        <AppTextField label="PAN (for Route KYC)" value={pan} onChangeText={(v) => setPan(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))} autoCapitalize="characters" placeholder="ABCDE1234F" />
        <AppButton
          title={payout?.razorpayLinkedAccountId ? 'Route account linked ✓' : 'Create Razorpay Route account'}
          variant="secondary"
          onPress={onboardRoute}
          loading={routeBusy}
          disabled={!payout?.payoutEnabled}
        />
      </AppCard>

      <AppText variant="subheading" style={{ marginTop: 8, marginBottom: 8 }}>Settlement history</AppText>
      {settlements.map((o: any) => {
        const status = o.settlementStatus || o.payoutStatus;
        const settled = status === 'SETTLED';
        return (
          <AppCard key={o._id} outlined>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyBold">{o.orderNumber} • ₹{o.totalAmount}</AppText>
                <AppText variant="caption" tone="muted">
                  Yours ₹{o.restaurantAmount ?? o.totalAmount} • Fee ₹{o.platformFee ?? 0} • {new Date(o.createdAt).toLocaleDateString()}
                </AppText>
              </View>
              <StatusChip status={status} kind={settled ? 'success' : status === 'REVERSED' || status === 'FAILED' ? 'error' : 'warning'} />
            </View>
            {!settled && status !== 'REVERSED' && (
              <AppButton title="Mark settled" variant="outline" compact onPress={() => markSettled(o._id)} loading={settlingId === o._id} style={{ marginTop: 8 }} />
            )}
          </AppCard>
        );
      })}
      {settlements.length === 0 && (
        <EmptyState icon="history" message="No paid orders yet" hint="Settlements appear here." />
      )}
    </Screen>
  );
}
