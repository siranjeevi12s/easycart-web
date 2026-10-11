import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, RefreshControl, ScrollView, View } from 'react-native';
import { ActivityIndicator, Chip, SegmentedButtons, useTheme } from 'react-native-paper';
import { api, BASE_URL } from '../services/api';
import { Screen } from '../components/Screen';
import { AppText } from '../components/AppText';
import { AppButton } from '../components/AppButton';
import { AppTextField } from '../components/AppTextField';
import { AppCard } from '../components/AppCard';
import { StatusChip } from '../components/StatusChip';
import { EmptyState } from '../components/EmptyState';
import { ErrorBox } from '../components/ErrorBox';
import { useSnackbar } from '../components/Snackbar';

const STATUS_LABEL: Record<string, string> = {
  payment_pending: 'Payment pending',
  awaiting_approval: 'Awaiting approval',
  scheduled: 'Scheduled',
  active: 'Live',
  paused: 'Paused',
  expired: 'Expired',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
  refunded: 'Refunded',
};

export default function Promote({ navigation }: any) {
  const theme = useTheme();
  const { show } = useSnackbar();
  const [tab, setTab] = useState('packages');
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [restId, setRestId] = useState('');
  const [packages, setPackages] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [offerText, setOfferText] = useState('');
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [editingOffer, setEditingOffer] = useState(false);
  const [draftOffer, setDraftOffer] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  /** 404 = backend predates the promos feature; no response = wrong/unreachable server. */
  const promoErrorMessage = (e: any) => {
    const status = e?.response?.status;
    if (status === 404)
      return 'Promotions not available on this server (404). It needs the latest server build — deploy it, then retry.';
    if (!e?.response) return 'Cannot reach the server. Check your connection and that the backend is running.';
    return e.response?.data?.message || 'Failed to load promotions.';
  };

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const my = await api.get('/restaurants/my').catch(() => ({ data: [] }));
      setRestaurants(my.data || []);
      if ((my.data || [])[0] && !restId) setRestId(my.data[0]._id);
    } catch {}
    let err: string | null = null;
    try {
      const pkgs = await api.get('/promos/packages');
      setPackages(Array.isArray(pkgs.data) ? pkgs.data : []);
    } catch (e: any) {
      setPackages([]);
      err = promoErrorMessage(e);
    }
    try {
      const camps = await api.get('/promos/campaigns');
      setCampaigns(Array.isArray(camps.data) ? camps.data : []);
    } catch (e: any) {
      setCampaigns([]);
      err = err || promoErrorMessage(e);
    }
    if (err) setLoadError(err);
    setLoading(false);
    setRefreshing(false);
  }, [restId]);

  useEffect(() => { load(); }, [load]);

  const buy = async (pkg: any) => {
    if (!restId) return Alert.alert('Pick a restaurant', 'Select which outlet this campaign promotes.');
    setBuyingId(pkg._id);
    try {
      const { data } = await api.post('/promos/checkout', {
        packageId: pkg._id,
        restaurantId: restId,
        offerText: offerText.trim(),
      });
      setOfferText('');
      navigation.navigate('PromoPay', { checkoutUrl: `${BASE_URL}${data.checkoutPath}`, campaignId: data.campaignId });
    } catch (e: any) {
      Alert.alert('Checkout failed', e.response?.data?.message || 'Error');
    } finally {
      setBuyingId(null);
    }
  };

  const openDetail = async (id: string) => {
    try {
      const { data } = await api.get(`/promos/campaigns/${id}`);
      setDetail(data);
      setEditingOffer(false);
      setDraftOffer(data.campaign?.offerText || '');
    } catch (e: any) {
      Alert.alert('Failed', e.response?.data?.message || 'Error');
    }
  };

  const saveOffer = async () => {
    if (!detail) return;
    try {
      const { data } = await api.patch(`/promos/campaigns/${detail.campaign._id}`, { offerText: draftOffer.trim() });
      setDetail((d: any) => (d ? { ...d, campaign: data.campaign } : d));
      setEditingOffer(false);
      show('Offer updated');
      load();
    } catch (e: any) {
      Alert.alert('Failed', e.response?.data?.message || 'Error');
    }
  };

  const repay = async (c: any) => {
    try {
      const { data } = await api.post(`/promos/campaigns/${c._id}/repay`, {});
      navigation.navigate('PromoPay', { checkoutUrl: `${BASE_URL}${data.checkoutPath}`, campaignId: data.campaignId });
    } catch (e: any) {
      Alert.alert('Checkout failed', e.response?.data?.message || 'Error');
    }
  };

  const buyAgain = (c: any) => {
    const rid = typeof c.restaurantId === 'object' ? c.restaurantId?._id : c.restaurantId;
    if (rid) setRestId(rid);
    setOfferText(c.offerText || '');
    setDetail(null);
    setTab('packages');
    show('Pick a package to run it again');
  };

  const cancel = (c: any) => {
    Alert.alert('Cancel campaign', `Cancel "${c.snapshot?.name}"?${c.payment?.razorpayPaymentId ? ' The paid amount will be refunded.' : ''}`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel campaign',
        style: 'destructive',
        onPress: async () => {
          try {
            const { data } = await api.post(`/promos/campaigns/${c._id}/cancel`, {});
            show(data.message || 'Cancelled');
            setDetail(null);
            load();
          } catch (e: any) {
            Alert.alert('Failed', e.response?.data?.message || 'Error');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <Screen scroll={false} style={{ justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </Screen>
    );
  }

  const restName = (id: any) =>
    typeof id === 'object' ? id?.name : restaurants.find((r: any) => r._id === id)?.name || 'Restaurant';

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      <AppText variant="title">Promote</AppText>
      <AppText variant="body" tone="muted" style={{ marginBottom: 4 }}>
        Sponsored placement in the customer app's Featured carousel.
      </AppText>
      <AppText variant="tiny" tone="faint" style={{ marginBottom: 12 }}>
        Server: {BASE_URL}
      </AppText>
      {loadError && <ErrorBox message={loadError} detail={BASE_URL} onRetry={() => { setRefreshing(true); load(); }} />}
      <SegmentedButtons
        value={tab}
        onValueChange={setTab}
        buttons={[{ value: 'packages', label: 'Packages' }, { value: 'campaigns', label: 'My campaigns' }]}
        style={{ marginBottom: 12 }}
      />

      {tab === 'packages' && (
        <>
          {restaurants.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, flexGrow: 0 }}>
              <View style={{ flexDirection: 'row', gap: 6, paddingRight: 16 }}>
                {restaurants.map((r: any) => (
                  <Chip key={r._id} selected={restId === r._id} onPress={() => setRestId(r._id)} compact>{r.name}</Chip>
                ))}
              </View>
            </ScrollView>
          )}
          <AppTextField
            label="Offer line on your card (optional)"
            value={offerText}
            onChangeText={(v) => setOfferText(v.slice(0, 120))}
            placeholder="e.g. Weekend family combo"
          />
          {packages.map((p) => (
            <AppCard key={p._id} outlined>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <AppText variant="bodyBold" style={{ flex: 1 }}>{p.name}</AppText>
                <StatusChip status={`Priority ${p.priority}`} kind="info" />
              </View>
              {!!p.description && <AppText variant="caption" tone="muted" style={{ marginTop: 4 }}>{p.description}</AppText>}
              <AppText variant="heading" style={{ marginTop: 8 }}>
                ₹{p.price} <AppText variant="caption" tone="muted">• {p.durationDays} days • starts after admin approval</AppText>
              </AppText>
              <AppButton title="Buy & Pay" compact onPress={() => buy(p)} loading={buyingId === p._id} style={{ marginTop: 8 }} />
            </AppCard>
          ))}
          {packages.length === 0 && (
            <EmptyState icon="bullhorn-outline" message="No packages right now" hint="The platform team publishes promotional packages here." />
          )}
        </>
      )}

      {tab === 'campaigns' && !detail && (
        <>
          {campaigns.map((c: any) => (
            <AppCard key={c._id} outlined onPress={() => openDetail(c._id)} accessibilityLabel={`Campaign ${c.snapshot?.name}`}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyBold">{c.snapshot?.name}</AppText>
                  <AppText variant="caption" tone="muted">
                    {restName(c.restaurantId)} • ₹{c.snapshot?.price} • {c.snapshot?.durationDays}d
                    {c.schedule?.endDate ? ` • till ${new Date(c.schedule.endDate).toLocaleDateString()}` : ''}
                  </AppText>
                </View>
                <StatusChip status={STATUS_LABEL[c.status] || c.status} />
              </View>
              {c.status === 'payment_pending' && (
                <AppButton title="Continue payment" compact onPress={() => repay(c)} style={{ marginTop: 8 }} />
              )}
              {['expired', 'cancelled', 'rejected', 'refunded'].includes(c.status) && (
                <AppButton title="Buy again" variant="outline" compact onPress={() => buyAgain(c)} style={{ marginTop: 8 }} />
              )}
            </AppCard>
          ))}
          {campaigns.length === 0 && (
            <EmptyState icon="bullhorn-outline" message="No campaigns yet" hint="Buy a package to feature your restaurant." />
          )}
        </>
      )}

      {tab === 'campaigns' && detail && (
        <>
          <AppButton title="← All campaigns" variant="text" compact onPress={() => setDetail(null)} style={{ alignSelf: 'flex-start', marginBottom: 8 }} />
          <AppCard outlined>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <AppText variant="subheading" style={{ flex: 1 }}>{detail.campaign.snapshot?.name}</AppText>
              <StatusChip status={STATUS_LABEL[detail.campaign.status] || detail.campaign.status} />
            </View>
            <AppText variant="caption" tone="muted" style={{ marginTop: 4 }}>
              {restName(detail.campaign.restaurantId)}
              {detail.campaign.schedule?.startDate ? ` • ${new Date(detail.campaign.schedule.startDate).toLocaleDateString()} → ${detail.campaign.schedule.endDate ? new Date(detail.campaign.schedule.endDate).toLocaleDateString() : ''}` : ''}
            </AppText>
            {!!detail.campaign.offerText && !editingOffer && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <AppText variant="body" style={{ flex: 1 }}>“{detail.campaign.offerText}”</AppText>
                {!['expired', 'cancelled', 'rejected', 'refunded'].includes(detail.campaign.status) && (
                  <AppButton title="Edit" variant="text" compact onPress={() => setEditingOffer(true)} />
                )}
              </View>
            )}
            {!detail.campaign.offerText && !editingOffer && !['expired', 'cancelled', 'rejected', 'refunded'].includes(detail.campaign.status) && (
              <AppButton title="Add offer line" variant="text" compact onPress={() => setEditingOffer(true)} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
            )}
            {editingOffer && (
              <View style={{ marginTop: 8 }}>
                <AppTextField label="Offer line (max 120)" value={draftOffer} onChangeText={(v) => setDraftOffer(v.slice(0, 120))} placeholder="e.g. Weekend family combo" />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <AppButton title="Save" compact onPress={saveOffer} style={{ flex: 1 }} />
                  <AppButton title="Cancel" variant="outline" compact onPress={() => { setEditingOffer(false); setDraftOffer(detail.campaign.offerText || ''); }} style={{ flex: 1 }} />
                </View>
              </View>
            )}
            {/* Customer-facing preview */}
            <AppText variant="captionBold" tone="muted" style={{ marginTop: 16, marginBottom: 8 }}>CARD PREVIEW</AppText>
            <View style={{ borderRadius: 18, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.outline, overflow: 'hidden' }}>
              {!!detail.campaign.restaurantId?.image && (
                <Image source={{ uri: detail.campaign.restaurantId.image }} style={{ width: '100%', height: 110 }} />
              )}
              <View style={{ padding: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <AppText variant="bodyBold" style={{ flex: 1 }} numberOfLines={1}>
                    {restName(detail.campaign.restaurantId)}
                  </AppText>
                  <View style={{ backgroundColor: theme.colors.primary, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <AppText variant="tiny" style={{ color: theme.colors.onPrimary, fontWeight: '800' }}>Sponsored</AppText>
                  </View>
                </View>
                {!!(editingOffer ? draftOffer : detail.campaign.offerText) && (
                  <AppText variant="caption" tone="success" style={{ marginTop: 4 }} numberOfLines={1}>
                    • {editingOffer ? draftOffer : detail.campaign.offerText}
                  </AppText>
                )}
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              <AppCard style={{ flex: 1, minWidth: '30%', marginBottom: 0 }}><AppText variant="heading">{detail.analytics.impressions}</AppText><AppText variant="caption" tone="muted">Views</AppText></AppCard>
              <AppCard style={{ flex: 1, minWidth: '30%', marginBottom: 0 }}><AppText variant="heading">{detail.analytics.clicks}</AppText><AppText variant="caption" tone="muted">Clicks</AppText></AppCard>
              <AppCard style={{ flex: 1, minWidth: '30%', marginBottom: 0 }}><AppText variant="heading">{detail.analytics.attributedOrders}</AppText><AppText variant="caption" tone="muted">Orders</AppText></AppCard>
            </View>
            <AppText variant="caption" tone="muted" style={{ marginTop: 8 }}>
              CTR {((detail.analytics.ctr || 0) * 100).toFixed(1)}% • Attributed revenue ₹{detail.analytics.attributedRevenue}
            </AppText>
            {['payment_pending', 'awaiting_approval', 'scheduled'].includes(detail.campaign.status) && (
              <AppButton title="Cancel campaign" variant="outline" compact onPress={() => cancel(detail.campaign)} style={{ marginTop: 12, borderColor: theme.colors.error }} />
            )}
          </AppCard>
        </>
      )}
    </Screen>
  );
}
