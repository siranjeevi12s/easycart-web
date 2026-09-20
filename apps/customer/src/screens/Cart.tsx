import { useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CartContext } from '../context/AppContext';

export default function Cart({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { cart, setCart, clearCart } = useContext(CartContext);
  const subtotal = cart.items.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
  const tax = Math.round(subtotal * 0.05);
  const total = subtotal + tax;

  const changeQty = (id: string, delta: number) => {
    setCart((prev: any) => {
      const items = prev.items.map((i: any) => i._id === id ? { ...i, quantity: i.quantity + delta } : i).filter((i: any) => i.quantity > 0);
      if (items.length === 0) return { restaurantId: null, items: [] };
      return { ...prev, items };
    });
  };

  if (cart.items.length === 0) return <View style={[s.empty, { paddingTop: insets.top + 16 }]}><Text style={s.emptyText}>Your cart is empty</Text><Text style={{ color: '#666' }}>Add items from a restaurant</Text></View>;

  return (
    <View style={[s.container, { paddingTop: insets.top + 16 }]}>
      <Text style={s.title}>Your Cart</Text>
      <FlatList
        data={cart.items}
        keyExtractor={(i) => i._id}
        renderItem={({ item }) => (
          <View style={s.row}>
            <View style={{ flex: 1 }}><Text style={{ fontWeight: '600' }}>{item.name}</Text><Text style={{ color: '#666' }}>₹{item.price} × {item.quantity} = ₹{item.price * item.quantity}</Text></View>
            <View style={s.qtyBox}>
              <TouchableOpacity onPress={() => changeQty(item._id, -1)} style={s.qBtn}><Text>-</Text></TouchableOpacity>
              <Text style={{ fontWeight: '700', paddingHorizontal: 10 }}>{item.quantity}</Text>
              <TouchableOpacity onPress={() => changeQty(item._id, 1)} style={s.qBtn}><Text>+</Text></TouchableOpacity>
            </View>
          </View>
        )}
      />
      <View style={s.summary}>
        <View style={s.line}><Text>Subtotal</Text><Text>₹{subtotal}</Text></View>
        <View style={s.line}><Text>Tax (5%)</Text><Text>₹{tax}</Text></View>
        <View style={[s.line, { borderTopWidth: 1, borderColor: '#FFE8DE', paddingTop: 8, marginTop: 8 }]}><Text style={{ fontWeight: '800' }}>Total (backend authoritative)</Text><Text style={{ fontWeight: '800', color: '#FF6B35' }}>₹{total}</Text></View>
        <TouchableOpacity style={s.payBtn} onPress={() => navigation.navigate('Checkout')}><Text style={s.payText}>Proceed to Payment →</Text></TouchableOpacity>
        <TouchableOpacity onPress={clearCart} style={{ alignItems: 'center', marginTop: 10 }}><Text style={{ color: '#EF4444' }}>Clear Cart</Text></TouchableOpacity>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F5', padding: 16 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 12 },
  row: { backgroundColor: 'white', padding: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  qtyBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF2EC', borderRadius: 20, padding: 4 },
  qBtn: { backgroundColor: 'white', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  summary: { backgroundColor: 'white', padding: 16, borderRadius: 16, marginTop: 12 },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  payBtn: { backgroundColor: '#FF6B35', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  payText: { color: 'white', fontWeight: '800' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF8F5' },
  emptyText: { fontSize: 18, fontWeight: '700' }
});
