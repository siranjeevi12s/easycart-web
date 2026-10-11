/** Sponsored "Featured Restaurants" carousel: horizontally swipeable cards with a
 *  Sponsored badge. Impressions + clicks are beaconed for campaign analytics.
 *  Placement is strictly separate from the organic restaurant list. */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { FlatList, Image, View, type ViewToken } from 'react-native';
import { useTheme } from 'react-native-paper';
import { api } from '../services/api';
import { AppText } from './AppText';

interface Props {
  onOpen: (restaurant: any, campaignId: string) => void;
  refreshSignal?: number;
  /** Shown when no sponsored campaigns are live. */
  fallback?: ReactNode;
}

export function FeaturedCarousel({ onOpen, refreshSignal, fallback }: Props) {
  const theme = useTheme();
  const [items, setItems] = useState<any[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const pending = useRef<string[]>([]);
  const flushTimer = useRef<any>(null);
  // Auto-slide state: steady linear rotation, paused while the user drags
  const flatRef = useRef<FlatList>(null);
  const idxRef = useRef(0);
  const dragging = useRef(false);
  const AUTO_MS = 3000;
  const CARD_STEP = 312; // card width 300 + gap 12

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/promos/featured');
      if (Array.isArray(data)) setItems(data);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load, refreshSignal]);

  const flush = useCallback(() => {
    const ids = pending.current.splice(0, pending.current.length);
    if (!ids.length) return;
    api
      .post('/promos/events', { events: ids.map((campaignId) => ({ campaignId, type: 'impression' })) })
      .catch(() => {});
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimer.current) return;
    flushTimer.current = setTimeout(() => {
      flushTimer.current = null;
      flush();
    }, 1500);
  }, [flush]);

  useEffect(
    () => () => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flush();
    },
    [flush]
  );

  // Infinite loop: three copies side by side, start in the middle.
  // The tail of copy 2 looks identical to the head of copy 1, so wrapping
  // back is invisible — the strip spins forward forever.
  const N = items.length;
  const loop = N > 1 ? [...items, ...items, ...items] : items;

  const onViewable = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      let fresh = false;
      for (const v of viewableItems) {
        if (typeof v.index === 'number') idxRef.current = v.index;
        const id = String(v.item?.campaignId || '');
        if (id && !seen.current.has(id)) {
          seen.current.add(id);
          pending.current.push(id);
          fresh = true;
        }
      }
      if (fresh) scheduleFlush();
    },
    [scheduleFlush]
  );

  // Linear auto-slide around the middle copy; wrap is invisible
  useEffect(() => {
    if (N < 2) return;
    const t = setInterval(() => {
      if (dragging.current) return;
      let next = idxRef.current + 1;
      if (next >= 2 * N) {
        // reached the third copy's head == middle copy's head: snap back silently…
        try { flatRef.current?.scrollToIndex({ index: N, animated: false }); } catch {}
        idxRef.current = N;
        next = N + 1;
      }
      // …then keep gliding forward into the "next" (first) card
      idxRef.current = next;
      try { flatRef.current?.scrollToIndex({ index: next, animated: true }); } catch {}
    }, AUTO_MS);
    return () => clearInterval(t);
  }, [N]);

  // Fresh data → restart from the middle copy's head
  useEffect(() => {
    idxRef.current = N;
    if (N > 1) {
      try { flatRef.current?.scrollToIndex({ index: N, animated: false }); } catch {}
    }
  }, [N]);

  const click = useCallback(
    (item: any) => {
      api.post('/promos/events', { events: [{ campaignId: item.campaignId, type: 'click' }] }).catch(() => {});
      onOpen(
        {
          _id: item.restaurantId,
          name: item.name,
          description: item.description,
          address: item.address,
          image: item.image,
          rating: item.rating,
          ratingCount: item.ratingCount,
          isOpen: item.isOpen,
        },
        item.campaignId
      );
    },
    [onOpen]
  );

  if (!items.length) return <>{fallback ?? null}</>;

  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <AppText variant="subheading" style={{ flex: 1 }}>
          Featured Restaurants
        </AppText>
        <AppText variant="tiny" tone="muted">
          Sponsored
        </AppText>
      </View>
      <FlatList
        ref={flatRef}
        data={loop}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => `sp-${i}`}
        initialScrollIndex={N > 1 ? N : 0}
        contentContainerStyle={{ gap: 12, paddingRight: 16 }}
        getItemLayout={(_, index) => ({ length: CARD_STEP, offset: CARD_STEP * index, index })}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        onScrollBeginDrag={() => { dragging.current = true; }}
        onScrollEndDrag={() => { dragging.current = false; }}
        onTouchEnd={() => { dragging.current = false; }}
        renderItem={({ item }) => (
          <View
            style={{
              width: 300,
              flexDirection: 'row',
              borderRadius: 18,
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.outline,
              overflow: 'hidden',
            }}
          >
            {!!item.image && <Image source={{ uri: item.image }} style={{ width: 112, height: 148 }} />}
            <View style={{ flex: 1, padding: 12, justifyContent: 'center' }}>
              <AppText
                variant="bodyBold"
                numberOfLines={1}
                onPress={() => click(item)}
                accessibilityRole="button"
                accessibilityLabel={`Open sponsored ${item.name}`}
              >
                {item.name}
              </AppText>
              {!!item.description && (
                <AppText variant="caption" tone="muted" numberOfLines={2} style={{ marginTop: 2 }}>
                  {item.description}
                </AppText>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 }}>
                <AppText variant="captionBold">
                  <AppText variant="captionBold" tone="star">★ </AppText>
                  {Number(item.rating ?? 4.5).toFixed(1)}
                </AppText>
                {!!item.offerText && (
                  <AppText variant="caption" tone="success" numberOfLines={1} style={{ flex: 1 }}>
                    • {item.offerText}
                  </AppText>
                )}
              </View>
              <AppText
                variant="button"
                style={{ color: theme.colors.primary, marginTop: 8 }}
                onPress={() => click(item)}
                accessibilityRole="button"
                accessibilityLabel={`View ${item.name}`}
              >
                View restaurant →
              </AppText>
            </View>
            <View
              style={{
                position: 'absolute',
                top: 8,
                left: 8,
                backgroundColor: theme.colors.primary,
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
              accessibilityLabel="Sponsored listing"
            >
              <AppText variant="tiny" style={{ color: theme.colors.onPrimary, fontWeight: '800' }}>
                Sponsored
              </AppText>
            </View>
          </View>
        )}
      />
    </View>
  );
}
