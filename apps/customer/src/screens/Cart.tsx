import { useContext } from 'react';
import { View, FlatList } from 'react-native';
import { Divider } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CartContext } from '../context/AppContext';
import { Screen } from '../components/Screen';
import { AppText } from '../components/AppText';
import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { QtyStepper } from '../components/QtyStepper';
import { EmptyState } from '../components/EmptyState';

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

  if (cart.items.length === 0)
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState icon="cart-off" message="Your cart is empty" hint="Add items from a restaurant" />
          <AppButton title="Browse Restaurants" onPress={() => navigation.navigate('Home')} style={{ marginTop: 8 }} />
        </View>
      </Screen>
    );

  return (
    <Screen>
      <AppText variant="title" style={{ marginBottom: 12 }}>
        Your Cart
      </AppText>
      <FlatList
        data={cart.items}
        keyExtractor={(i) => i._id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 8 }}
        renderItem={({ item }) => (
          <AppCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyBold">{item.name}</AppText>
                {!!item.restaurantName && (
                  <AppText variant="tiny" tone="primary">
                    {item.restaurantName}
                  </AppText>
                )}
                <AppText variant="body" tone="muted">
                  ₹{item.price} × {item.quantity} = ₹{item.price * item.quantity}
                </AppText>
              </View>
              <QtyStepper quantity={item.quantity} onChange={(d) => changeQty(item._id, d)} />
            </View>
          </AppCard>
        )}
      />
      <AppCard>
        <SummaryRow label="Subtotal" value={`₹${subtotal}`} />
        <SummaryRow label="Tax (5%)" value={`₹${tax}`} />
        <Divider style={{ marginVertical: 8 }} />
        <SummaryRow label="Total (backend authoritative)" value={`₹${total}`} bold accent />
        <AppButton title="Proceed to Payment →" onPress={() => navigation.navigate('Checkout')} style={{ marginTop: 12 }} />
        <AppButton title="Clear Cart" variant="text" onPress={clearCart} style={{ marginTop: 4 }} />
      </AppCard>
    </Screen>
  );
}

function SummaryRow({ label, value, bold = false, accent = false }: { label: string; value: string; bold?: boolean; accent?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <AppText variant={bold ? 'bodyBold' : 'body'}>{label}</AppText>
      <AppText variant={bold ? 'bodyBold' : 'body'} tone={accent ? 'primary' : 'text'}>
        {value}
      </AppText>
    </View>
  );
}
