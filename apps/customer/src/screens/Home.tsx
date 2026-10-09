import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { Chip as PaperChip, Dialog, IconButton, Menu, Portal, Searchbar, TextInput as PaperInput, useTheme } from 'react-native-paper';
import { api, BASE_URL } from '../services/api';
import { Screen } from '../components/Screen';
import { AppText } from '../components/AppText';
import { AppButton } from '../components/AppButton';
import { AppCard, CoverImage } from '../components/AppCard';
import { StatusChip } from '../components/StatusChip';
import { EmptyState } from '../components/EmptyState';
import { ErrorBox } from '../components/ErrorBox';
import { LoadingView } from '../components/LoadingView';

type SortKey = 'recommended' | 'rating' | 'name' | 'open';
const SORT_LABELS: Record<SortKey, string> = {
  recommended: 'Recommended',
  rating: 'Rating: high to low',
  name: 'Name: A to Z',
  open: 'Open first',
};

/** Locality = last comma segment of the free-text address ("MG Road, Pune" → "Pune"). */
function localityOf(address?: string): string {
  if (!address) return '';
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

export default function Home({ navigation }: any) {
  const theme = useTheme();
  const [q, setQ] = useState('');
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters: open-now is server-authoritative; area + rating refine client-side
  const [openOnly, setOpenOnly] = useState(false);
  const [topRated, setTopRated] = useState(false);
  const [area, setArea] = useState('');
  const [areaDraft, setAreaDraft] = useState('');
  const [areaOpen, setAreaOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>('recommended');
  const [sortOpen, setSortOpen] = useState(false);

  const load = async (search = '', open = openOnly, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const params = `${search ? `?search=${encodeURIComponent(search)}` : ''}${search && open ? '&' : open ? '?' : ''}${open ? 'open=true' : ''}`;
      const { data } = await api.get(`/restaurants${params}`);
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
    const t = setTimeout(() => load(q, openOnly), 400);
    return () => clearTimeout(t);
  }, [q, openOnly]);

  // Area quick-picks derived from the loaded list (top localities)
  const localities = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of restaurants) {
      const loc = localityOf(r.address);
      if (loc) counts.set(loc, (counts.get(loc) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, count }));
  }, [restaurants]);

  const visible = useMemo(() => {
    const needle = area.trim().toLowerCase();
    let list = restaurants.filter((r) => {
      if (needle && !(r.address || '').toLowerCase().includes(needle)) return false;
      if (topRated && (r.rating ?? 4.5) < 4.5) return false;
      return true;
    });
    switch (sort) {
      case 'rating':
        list = [...list].sort((a, b) => (b.rating ?? 4.5) - (a.rating ?? 4.5));
        break;
      case 'name':
        list = [...list].sort((a, b) => String(a.name).localeCompare(String(b.name)));
        break;
      case 'open':
        list = [...list].sort((a, b) => Number(!!b.isOpen) - Number(!!a.isOpen));
        break;
      default:
        break;
    }
    return list;
  }, [restaurants, area, topRated, sort]);

  const activeCount = (openOnly ? 1 : 0) + (topRated ? 1 : 0) + (area.trim() ? 1 : 0);
  const clearAll = () => {
    setOpenOnly(false);
    setTopRated(false);
    setArea('');
    setSort('recommended');
    load(q, false);
  };

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
        style={{ marginBottom: 8, backgroundColor: theme.colors.surface }}
        accessibilityLabel="Search restaurants"
      />

      {/* Filter + sort row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8, alignItems: 'center' }}>
          <PaperChip
            selected={openOnly}
            icon="clock-outline"
            onPress={() => { const v = !openOnly; setOpenOnly(v); load(q, v); }}
            accessibilityLabel="Toggle open now filter"
          >
            Open now
          </PaperChip>
          <PaperChip
            selected={topRated}
            icon="star"
            onPress={() => setTopRated((v) => !v)}
            accessibilityLabel="Toggle top rated filter"
          >
            4.5★+
          </PaperChip>
          <PaperChip
            selected={!!area.trim()}
            icon="map-marker"
            onPress={() => { setAreaDraft(area); setAreaOpen(true); }}
            accessibilityLabel="Filter by area"
          >
            {area.trim() || 'Area'}
          </PaperChip>
          {activeCount > 0 && (
            <PaperChip icon="close" onPress={clearAll} accessibilityLabel="Clear all filters">
              Clear ({activeCount})
            </PaperChip>
          )}
        </ScrollView>
        <Menu
          visible={sortOpen}
          onDismiss={() => setSortOpen(false)}
          anchor={
            <IconButton
              icon="sort"
              size={20}
              onPress={() => setSortOpen(true)}
              style={{ margin: 0, borderWidth: 1, borderColor: theme.colors.outline }}
              accessibilityLabel={`Sort by, current ${SORT_LABELS[sort]}`}
            />
          }
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <Menu.Item
              key={k}
              leadingIcon={sort === k ? 'check' : undefined}
              onPress={() => { setSort(k); setSortOpen(false); }}
              title={SORT_LABELS[k]}
            />
          ))}
        </Menu>
      </View>
      <AppText variant="caption" tone="muted" style={{ marginBottom: 8 }}>
        {visible.length} place{visible.length === 1 ? '' : 's'} • {SORT_LABELS[sort]}
        {openOnly ? ' • Open now' : ''}{area.trim() ? ` • ${area.trim()}` : ''}{topRated ? ' • 4.5★+' : ''}
      </AppText>

      {!!error && (
        <ErrorBox message={error} detail={`Check server is running at ${BASE_URL.replace(/\/api/, '')}`} onRetry={() => load(q, openOnly)} />
      )}
      <FlatList
        data={visible}
        keyExtractor={(i) => i._id}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(q, openOnly, true); }} colors={[theme.colors.primary]} />}
        ListEmptyComponent={
          !error ? (
            <EmptyState
              icon="store-search"
              message={activeCount > 0 ? 'No matches for these filters.' : 'No restaurants found.'}
              hint={activeCount > 0 ? 'Try clearing filters or a different search.' : 'Try a different search.'}
            />
          ) : null
        }
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
                    ★ {(item.rating ?? 4.5).toFixed(1)}
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

      {/* Area picker dialog: quick-pick localities + custom text */}
      <Portal>
        <Dialog visible={areaOpen} onDismiss={() => setAreaOpen(false)}>
          <Dialog.Title>Filter by area</Dialog.Title>
          <Dialog.Content>
            <PaperInput
              label="Locality"
              value={areaDraft}
              onChangeText={setAreaDraft}
              placeholder="e.g. Kothrud, Baner…"
              mode="outlined"
              style={{ marginBottom: 12 }}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {localities.map((l) => (
                <PaperChip
                  key={l.name}
                  selected={areaDraft.trim().toLowerCase() === l.name.toLowerCase()}
                  onPress={() => setAreaDraft(l.name)}
                >
                  {l.name} ({l.count})
                </PaperChip>
              ))}
            </View>
            {!localities.length && (
              <AppText variant="caption" tone="muted">
                No localities detected yet — type one above.
              </AppText>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <AppButton
              title="Clear"
              variant="text"
              compact
              onPress={() => { setArea(''); setAreaOpen(false); }}
            />
            <AppButton
              title="Apply"
              compact
              onPress={() => { setArea(areaDraft.trim()); setAreaOpen(false); }}
            />
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}
