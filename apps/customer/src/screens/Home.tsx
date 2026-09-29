import { useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, BASE_URL } from '../services/api';

export default function Home({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const load = async (search = '') => {
    setLoading(true); setError(null);
    try {
      const { data } = await api.get(`/restaurants${search ? `?search=${encodeURIComponent(search)}` : ''}`);
      setRestaurants(Array.isArray(data) ? data : []);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Network Error';
      setError(msg);
      // keep previous list on search error, clear only on initial load
      if (!search) setRestaurants([]);
      console.log('[Home] load failed:', msg);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q), 400);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <View style={[s.container, { paddingTop: insets.top + 16 }]}>
      <Text style={s.header}>Discover Restaurants</Text>
      <Text style={s.sub}>Pre-order for quick pickup — no waiting</Text>
      <TextInput style={s.search} placeholder="Search restaurants or menu items…" value={q} onChangeText={setQ} />
      {error ? (
        <View style={s.errorBox}>
          <Text style={s.errorText}>⚠️ {error}</Text>
          <Text style={s.errorSub}>Check server is running at {BASE_URL.replace(/\/api/, '')}</Text>
          <TouchableOpacity onPress={() => load(q)} style={s.retryBtn}><Text style={s.retryText}>Retry</Text></TouchableOpacity>
        </View>
      ) : null}
      {loading ? <ActivityIndicator color="#FF6B35" style={{ marginTop: 20 }} /> :
        <FlatList
          data={restaurants}
          keyExtractor={(i) => i._id}
          contentContainerStyle={{ paddingBottom: 20 + insets.bottom }}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.card} onPress={() => navigation.navigate('Restaurant', { restaurant: item })} activeOpacity={0.8}>
              <Image source={{ uri: item.image }} style={s.img} />
              <View style={{ flex: 1, padding: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={s.name}>{item.name}</Text>
                  <Text style={s.rating}>★ {item.rating ?? 4.5}</Text>
                </View>
                <Text style={s.addr} numberOfLines={1}>{item.address}</Text>
                <View style={{ flexDirection: 'row', marginTop: 6, gap: 6 }}>
                  <Text style={[s.badge, { backgroundColor: item.isOpen ? '#DCFCE7' : '#FEE2E2', color: item.isOpen ? '#166534' : '#991B1B' }]}>{item.isOpen ? '● Open' : '● Closed'}</Text>
                  {!item.isActive && <Text style={[s.badge, { backgroundColor: '#FEF3C7' }]}>Deactivated</Text>}
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#666', marginTop: 30 }}>No restaurants found.</Text>}
        />
      }
    </View>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F5', padding: 16 },
  header: { fontSize: 22, fontWeight: '800' }, sub: { color: '#666', marginBottom: 12 },
  search: { backgroundColor: 'white', borderRadius: 12, height: 48, paddingHorizontal: 14, paddingVertical: 0, textAlignVertical: 'center', borderWidth: 1, borderColor: '#FFE8DE', marginBottom: 12 },
  card: { backgroundColor: 'white', borderRadius: 16, overflow: 'hidden', marginBottom: 12, flexDirection: 'row', elevation: 2, shadowColor: '#FF6B35', shadowOpacity: 0.08 },
  img: { width: 110, height: 110 },
  name: { fontWeight: '700', fontSize: 15, flex: 1 }, rating: { fontWeight: '700', color: '#FF6B35' },
  addr: { color: '#666', fontSize: 12, marginTop: 2 },
  badge: { fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, overflow: 'hidden' },
  errorBox: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, padding: 12, marginBottom: 12 },
  errorText: { color: '#DC2626', fontWeight: '700', fontSize: 13 }, errorSub: { color: '#6B7280', fontSize: 11, marginTop: 4 },
  retryBtn: { marginTop: 8, backgroundColor: '#FF6B35', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, alignSelf: 'flex-start' }, retryText: { color: 'white', fontWeight: '700', fontSize: 12 },
});
