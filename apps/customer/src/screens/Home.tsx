import { useEffect, useState } from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import { Searchbar, useTheme } from 'react-native-paper';
import { api, BASE_URL } from '../services/api';
import { Screen } from '../components/Screen';
import { AppText } from '../components/AppText';
import { AppCard, CoverImage } from '../components/AppCard';
import { StatusChip } from '../components/StatusChip';
import { EmptyState } from '../components/EmptyState';
import { ErrorBox } from '../components/ErrorBox';
import { LoadingView } from '../components/LoadingView';

export default function Home({ navigation }: any) {
  const theme = useTheme();
  const [q, setQ] = useState('');
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (search = '', silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/restaurants${search ? `?search=${encodeURIComponent(search)}` : ''}`);
      setRestaurants(Array.isArray(data) ? data : []);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Network Error';
      setError(msg);
      // keep previous list on search error, clear only on initial load
      if (!search) setRestaurants([]);
      console.log('[Home] load failed:', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q), 400);
    return () => clearTimeout(t);
  }, [q]);

  if (loading && !restaurants.length) return <LoadingView message="Finding restaurants…" />;

  return (
    <Screen>
      <AppText variant="title">Discover Restaurants</AppText>
      <AppText variant="body" tone="muted" style={{ marginBottom: 12 }}>
        Pre-order for quick pickup — no waiting
      </AppText>
      <Searchbar
        placeholder="Search restaurants or menu items…"
        value={q}
        onChangeText={setQ}
        style={{ marginBottom: 12, backgroundColor: theme.colors.surface }}
        accessibilityLabel="Search restaurants"
      />
      {!!error && (
        <ErrorBox message={error} detail={`Check server is running at ${BASE_URL.replace(/\/api/, '')}`} onRetry={() => load(q)} />
      )}
      <FlatList
        data={restaurants}
        keyExtractor={(i) => i._id}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(q, true); }} colors={[theme.colors.primary]} />}
        ListEmptyComponent={!error ? <EmptyState icon="store-search" message="No restaurants found." hint="Try a different search." /> : null}
        renderItem={({ item }) => (
          <AppCard onPress={() => navigation.navigate('Restaurant', { restaurant: item })} padded={false} accessibilityLabel={`${item.name}, ${item.isOpen ? 'open' : 'closed'}`}>
            <View style={{ flexDirection: 'row' }}>
              <CoverImage uri={item.image} width={110} height={110} />
              <View style={{ flex: 1, padding: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <AppText variant="subheading" style={{ flex: 1 }} numberOfLines={1}>
                    {item.name}
                  </AppText>
                  <AppText variant="captionBold" tone="primary">
                    ★ {item.rating ?? 4.5}
                  </AppText>
                </View>
                <AppText variant="caption" tone="muted" style={{ marginTop: 2 }} numberOfLines={1}>
                  {item.address}
                </AppText>
                <View style={{ flexDirection: 'row', marginTop: 8, gap: 6 }}>
                  <StatusChip status={item.isOpen ? 'Open' : 'Closed'} kind={item.isOpen ? 'success' : 'error'} />
                  {!item.isActive && <StatusChip status="Deactivated" kind="warning" />}
                </View>
              </View>
            </View>
          </AppCard>
        )}
      />
    </Screen>
  );
}
