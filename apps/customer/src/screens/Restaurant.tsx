import { useEffect, useState, useContext } from 'react';
import { View, FlatList, Alert, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button as PaperButton, useTheme } from 'react-native-paper';
import { api } from '../services/api';
import { CartContext } from '../context/AppContext';
import { AppText } from '../components/AppText';
import { AppCard } from '../components/AppCard';
import { EmptyState } from '../components/EmptyState';
import { LoadingView } from '../components/LoadingView';

export default function Restaurant({ route, navigation }: any) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { restaurant } = route.params;
  const [menu, setMenu] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { cart, addToCart } = useContext(CartContext);

  useEffect(() => {
    api.get(`/restaurants/${restaurant._id}/menu`).then(({ data }) => setMenu(data)).catch(() => {}).finally(() => setLoading(false));
  }, [restaurant._id]);

  const add = (item: any) => {
    if (!restaurant.isOpen) return Alert.alert('Restaurant closed');
    addToCart(restaurant._id, item, restaurant.name);
    Alert.alert('Added to cart', `${item.name} ×1 (${restaurant.name})`);
  };

  if (loading) return <LoadingView message="Loading menu…" />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {!!restaurant.image && <Image source={{ uri: restaurant.image }} style={{ width: '100%', height: 180 }} />}
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <AppText variant="title">{restaurant.name}</AppText>
        <AppText variant="caption" tone="muted" style={{ marginTop: 2 }}>
          {restaurant.address} • {restaurant.isOpen ? 'Open' : 'Closed'}
        </AppText>
        {!!restaurant.description && (
          <AppText variant="body" tone="primary" style={{ marginTop: 4 }}>
            {restaurant.description}
          </AppText>
        )}
      </View>

      <FlatList
        data={menu}
        keyExtractor={(i) => i._id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <AppText variant="subheading" style={{ marginBottom: 8 }}>
            Menu — Tap ADD (backend calculates total)
          </AppText>
        }
        ListEmptyComponent={<EmptyState icon="food" message="No menu items yet." />}
        renderItem={({ item }) => {
          const disabled = !item.isAvailable || !restaurant.isOpen;
          return (
            <AppCard padded={false}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {!!item.image && <Image source={{ uri: item.image }} style={{ width: 90, height: 90, borderRadius: 10, margin: 8 }} />}
                <View style={{ flex: 1, padding: 10 }}>
                  <AppText variant="bodyBold">{item.name}</AppText>
                  <AppText variant="caption" tone="muted" numberOfLines={2}>
                    {item.description}
                  </AppText>
                  <AppText variant="bodyBold" style={{ marginTop: 4 }}>
                    ₹{item.price} <AppText variant="caption" tone="muted">• {item.category}</AppText>
                  </AppText>
                  {!item.isAvailable && (
                    <AppText variant="caption" tone="error">
                      Unavailable
                    </AppText>
                  )}
                </View>
                <PaperButton
                  mode="contained"
                  disabled={disabled}
                  onPress={() => add(item)}
                  style={{ marginRight: 10, borderRadius: 10 }}
                  accessibilityLabel={`Add ${item.name} to cart`}
                >
                  ADD
                </PaperButton>
              </View>
            </AppCard>
          );
        }}
      />

      {cart.items.length > 0 && (
        <PaperButton
          mode="contained"
          onPress={() => navigation.navigate('Checkout')}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, borderRadius: 0, paddingBottom: insets.bottom + 4, backgroundColor: '#1A1A1A' }}
          contentStyle={{ minHeight: 56 }}
          accessibilityLabel="Go to cart"
        >
          {cart.items.reduce((a: number, b: any) => a + b.quantity, 0)} items • Go to Cart →
        </PaperButton>
      )}
    </View>
  );
}
