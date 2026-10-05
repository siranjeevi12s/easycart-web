import { useEffect, useState, useContext } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../services/api';
import { CartContext } from '../context/AppContext';

export default function Restaurant({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { restaurant } = route.params;
  const [menu, setMenu] = useState<any[]>([]);
  const { cart, addToCart } = useContext(CartContext);

  useEffect(() => {
    api.get(`/restaurants/${restaurant._id}/menu`).then(({ data }) => setMenu(data));
  }, []);

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <Image source={{ uri: restaurant.image }} style={s.hero} />
      <View style={{ padding: 16 }}>
        <Text style={s.name}>{restaurant.name}</Text>
        <Text style={s.addr}>{restaurant.address} • {restaurant.isOpen ? 'Open' : 'Closed'}</Text>
        <Text style={{ color: '#FF6B35', fontWeight: '600', marginTop: 4 }}>{restaurant.description}</Text>
      </View>

      <FlatList
        data={menu}
        keyExtractor={(i) => i._id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListHeaderComponent={<Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 8 }}>Menu — Tap ADD (backend calculates total)</Text>}
        renderItem={({ item }) => (
          <View style={s.card}>
            <Image source={{ uri: item.image }} style={s.foodImg} />
            <View style={{ flex: 1, padding: 10 }}>
              <Text style={s.foodName}>{item.name}</Text>
              <Text style={s.desc} numberOfLines={2}>{item.description}</Text>
              <Text style={s.price}>₹{item.price} <Text style={{ color: '#666', fontWeight: '400' }}>• {item.category}</Text></Text>
              {!item.isAvailable && <Text style={{ color: '#EF4444', fontSize: 12 }}>Unavailable</Text>}
            </View>
            <TouchableOpacity
              disabled={!item.isAvailable || !restaurant.isOpen}
              onPress={() => {
                if (!restaurant.isOpen) return Alert.alert('Restaurant closed');
                addToCart(restaurant._id, item, restaurant.name);
                Alert.alert('Added to cart', `${item.name} ×1 (${restaurant.name})`);
              }}
              style={[s.addBtn, (!item.isAvailable || !restaurant.isOpen) && { opacity: 0.4 }]}>
              <Text style={s.addText}>ADD</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      {cart.items.length > 0 && (
        <TouchableOpacity style={[s.cartBar, { paddingBottom: insets.bottom + 16 }]} onPress={() => navigation.navigate('Checkout')}>
          <Text style={s.cartText}>{cart.items.reduce((a: number, b: any) => a + b.quantity, 0)} items • Go to Cart →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F5' },
  hero: { width: '100%', height: 180 },
  name: { fontSize: 20, fontWeight: '800' }, addr: { color: '#666', fontSize: 12, marginTop: 2 },
  card: { backgroundColor: 'white', borderRadius: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 10, overflow: 'hidden', elevation: 1 },
  foodImg: { width: 90, height: 90, borderRadius: 10, margin: 8 },
  foodName: { fontWeight: '700' }, desc: { color: '#666', fontSize: 12 }, price: { fontWeight: '700', marginTop: 4 },
  addBtn: { backgroundColor: '#FF6B35', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, marginRight: 10 },
  addText: { color: 'white', fontWeight: '800' },
  cartBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#1A1A1A', padding: 16, alignItems: 'center' },
  cartText: { color: 'white', fontWeight: '700' }
});
