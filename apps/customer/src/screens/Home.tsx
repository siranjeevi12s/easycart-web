import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { View, FlatList, RefreshControl, ScrollView, LayoutAnimation } from 'react-native';
import { Badge, Chip as PaperChip, Dialog, Icon, IconButton, Portal, Searchbar, Switch, TextInput as PaperInput, useTheme } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, BASE_URL } from '../services/api';
import { Screen } from '../components/Screen';
import { AppText } from '../components/AppText';
import { AppButton } from '../components/AppButton';
import { AppCard, CoverImage } from '../components/AppCard';
import { StatusChip } from '../components/StatusChip';
import { FeaturedCarousel } from '../components/FeaturedCarousel';
import { EmptyState } from '../components/EmptyState';
import { ErrorBox } from '../components/ErrorBox';
import { ListSkeleton } from '../components/Skeleton';
import { getFavRestaurants, toggleFavRestaurant } from '../utils/favorites';
import { useSnackbar } from '../components/Snackbar';

type SortKey = 'recommended' | 'rating' | 'name' | 'open';
const SORT_LABELS: Record<SortKey, string> = {
  recommended: 'Recommended',
  rating: 'Rating: high to low',
  name: 'Name: A to Z',
  open: 'Open first',
};
const SORT_SHORT: Record<SortKey, string> = {
  recommended: 'Recommended',
  rating: 'Top rated',
  name: 'A–Z',
  open: 'Open first',
};

// NOTE: New Architecture enables LayoutAnimation by default — no experimental flag needed.

/** Locality = last comma segment of the free-text address ("MG Road, Pune" → "Pune"). */
function localityOf(address?: string): string {
  if (!address) return '';
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

export default function Home({ navigation }: any) {
  const theme = useTheme();
  const snack = useSnackbar();
  const [q, setQ] = useState('');
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favIds, setFavIds] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);

  // Filters: open-now is server-authoritative; area + rating refine client-side
  const [openOnly, setOpenOnly] = useState(false);
  const [topRated, setTopRated] = useState(false);
  const [area, setArea] = useState('');
  const [areaDraft, setAreaDraft] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>('recommended');
  const [promoTick, setPromoTick] = useState(0);

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
    getFavRestaurants().then(setFavIds).catch(() => {});
    AsyncStorage.getItem('easycart_recent_search').then((raw) => {
      try { if (raw) setRecent(JSON.parse(raw).slice(0, 6)); } catch {}
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q, openOnly), 400);
    return () => clearTimeout(t);
  }, [q, openOnly]);

  const commitSearch = (term: string) => {
    const clean = term.trim();
    if (clean.length < 2) return;
    setRecent((prev) => {
      const next = [clean, ...prev.filter((x) => x.toLowerCase() !== clean.toLowerCase())].slice(0, 6);
      AsyncStorage.setItem('easycart_recent_search', JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const removeRecent = (term: string) => {
    setRecent((prev) => {
      const next = prev.filter((x) => x.toLowerCase() !== term.toLowerCase());
      AsyncStorage.setItem('easycart_recent_search', JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const clearRecent = () => {
    setRecent([]);
    AsyncStorage.removeItem('easycart_recent_search').catch(() => {});
  };

  const toggleFav = async (id: string, name: string) => {
    const { added } = await toggleFavRestaurant(id);
    setFavIds((prev) => (added ? [...prev, id] : prev.filter((x) => x !== id)));
    snack.show(added ? `Saved ${name}` : `Removed ${name}`);
  };

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
  const openFilters = () => { setAreaDraft(area); setFilterOpen(true); };
  const openCount = restaurants.filter((r) => r.isOpen).length;
  const unfiltered = !q && !openOnly && !topRated && !area.trim();

  // Animate the hero ↔ sponsored swap — fast fade so the search row never lags.
  // Must run in useLayoutEffect (before paint); useEffect fires after layout
  // already happened, so the swap would snap with no animation.
  useLayoutEffect(() => {
    LayoutAnimation.configureNext({
      duration: 180,
      create: { type: LayoutAnimation.Types.easeOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.easeOut },
      delete: { type: LayoutAnimation.Types.easeOut, property: LayoutAnimation.Properties.opacity },
    });
  }, [unfiltered]);

  const promoHero = (
    <View style={{ backgroundColor: theme.colors.primary, borderRadius: 18, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 1 }}>
        <AppText variant="subheading" style={{ color: theme.colors.onPrimary }}>
          Skip the wait
        </AppText>
        <AppText variant="caption" style={{ color: theme.colors.onPrimary, marginTop: 2 }}>
          {openCount} kitchen{openCount === 1 ? '' : 's'} open now • order ahead, pick up fresh
        </AppText>
      </View>
      <Icon source="food-takeout-box" size={44} color={theme.colors.onPrimary} />
    </View>
  );
  const clearAll = () => {
    setOpenOnly(false);
    setTopRated(false);
    setArea('');
    setSort('recommended');
    load(q, false);
  };

  if (loading && !restaurants.length) {
    return (
      <Screen>
        <AppText variant="title">Discover Restaurants</AppText>
        <AppText variant="body" tone="muted" style={{ marginBottom: 12 }}>
          Pre-order for quick pickup — no waiting
        </AppText>
        <ListSkeleton rows={4} />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppText variant="title">Discover Restaurants</AppText>
      <AppText variant="body" tone="muted" style={{ marginBottom: 12 }}>
        Pre-order for quick pickup — no waiting
      </AppText>
      {/* Prime slot: carousel stays mounted across searches (keeps scroll
          position, data, impression memory); hidden while filtering so the
          static hero shows instead. The swap above is layout-animated. */}
      {!unfiltered && promoHero}
      <View style={unfiltered ? undefined : { display: 'none' }}>
        <FeaturedCarousel
          refreshSignal={promoTick}
          onOpen={(restaurant) => navigation.navigate('Restaurant', { restaurant })}
          fallback={promoHero}
        />
      </View>
      {/* Search + all-filters button in one row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Searchbar
          placeholder="Search your menu"
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => commitSearch(q)}
          style={{ flex: 1, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.outline }}
          accessibilityLabel="Search restaurants"
        />
        <View>
          <IconButton
            icon="tune-variant"
            size={22}
            onPress={openFilters}
            style={{ margin: 0, borderWidth: 1, borderColor: theme.colors.outline, backgroundColor: theme.colors.surface }}
            accessibilityLabel={`Open filters${activeCount > 0 ? `, ${activeCount} active` : ''}`}
          />
          <Badge visible={activeCount > 0} size={16} style={{ position: 'absolute', top: -2, right: -2 }}>
            {activeCount}
          </Badge>
        </View>
      </View>
      {!q && recent.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <AppText variant="tiny" tone="muted" style={{ flex: 1 }}>
              RECENT SEARCHES
            </AppText>
            <AppText variant="tiny" tone="error" onPress={clearRecent} accessibilityRole="button" accessibilityLabel="Clear all recent searches">
              Clear all
            </AppText>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
            {recent.map((term) => (
              <PaperChip
                key={term}
                icon="history"
                onPress={() => setQ(term)}
                onClose={() => removeRecent(term)}
                accessibilityLabel={`Search again for ${term}. Remove with the close icon.`}
              >
                {term}
              </PaperChip>
            ))}
          </ScrollView>
        </View>
      )}

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setPromoTick((t) => t + 1); load(q, openOnly, true); }} colors={[theme.colors.primary]} />}
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
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                  <AppText variant="subheading" style={{ flex: 1 }} numberOfLines={1}>
                    {item.name}
                  </AppText>
                  <IconButton
                    icon={favIds.includes(item._id) ? 'heart' : 'heart-outline'}
                    size={18}
                    iconColor={favIds.includes(item._id) ? theme.colors.error : theme.colors.outline}
                    onPress={() => toggleFav(item._id, item.name)}
                    style={{ margin: -6 }}
                    accessibilityLabel={favIds.includes(item._id) ? `Unsave ${item.name}` : `Save ${item.name}`}
                  />
                  <AppText variant="captionBold">
                    <AppText variant="captionBold" tone="star">★ </AppText>
                    {(item.rating ?? 4.5).toFixed(1)}
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

      {/* All-filters dialog: fully themed — yellow accents, grouped rows, rounded sheet */}
      <Portal>
        <Dialog
          visible={filterOpen}
          onDismiss={() => setFilterOpen(false)}
          style={{ maxHeight: '92%', borderRadius: 20, backgroundColor: theme.colors.surface }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8 }}>
            <View style={{ backgroundColor: theme.colors.primary, borderRadius: 999, padding: 8, marginRight: 12 }}>
              <Icon source="tune-variant" size={20} color={theme.colors.onPrimary} />
            </View>
            <AppText variant="heading" style={{ flex: 1 }}>
              Filters{activeCount > 0 ? ` (${activeCount})` : ''}
            </AppText>
            {activeCount > 0 && <StatusChip status={`${activeCount} on`} kind="info" />}
          </View>
          <Dialog.ScrollArea style={{ paddingHorizontal: 0 }}>
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: 12 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={{ backgroundColor: theme.colors.surfaceVariant, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                  <Icon source="clock-outline" size={20} color={theme.colors.primary} />
                  <AppText variant="bodyBold" style={{ flex: 1, marginLeft: 12 }}>
                    Open now
                  </AppText>
                  <Switch value={openOnly} onValueChange={setOpenOnly} color={theme.colors.primary} accessibilityLabel="Toggle open now filter" />
                </View>
                <View style={{ height: 1, backgroundColor: theme.colors.outline }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                  <Icon source="star-outline" size={20} color={theme.colors.primary} />
                  <AppText variant="bodyBold" style={{ flex: 1, marginLeft: 12 }}>
                    Top rated (4.5★+)
                  </AppText>
                  <Switch value={topRated} onValueChange={setTopRated} color={theme.colors.primary} accessibilityLabel="Toggle top rated filter" />
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 8 }}>
                <View style={{ width: 4, height: 14, borderRadius: 2, backgroundColor: theme.colors.primary, marginRight: 8 }} />
                <AppText variant="captionBold" tone="muted">
                  SORT BY
                </AppText>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(Object.keys(SORT_SHORT) as SortKey[]).map((k) => (
                  <PaperChip
                    key={k}
                    selected={sort === k}
                    onPress={() => setSort(k)}
                    accessibilityLabel={`Sort by ${SORT_LABELS[k]}`}
                  >
                    {SORT_SHORT[k]}
                  </PaperChip>
                ))}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
                <View style={{ width: 4, height: 14, borderRadius: 2, backgroundColor: theme.colors.primary, marginRight: 8 }} />
                <AppText variant="captionBold" tone="muted">
                  AREA
                </AppText>
              </View>
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
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
            <AppButton
              title="Clear all"
              variant="text"
              compact
              onPress={() => { clearAll(); setFilterOpen(false); }}
              style={{ flex: 1 }}
            />
            <AppButton
              title="Show results"
              compact
              onPress={() => { setArea(areaDraft.trim()); setFilterOpen(false); }}
              style={{ flex: 2 }}
            />
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}
