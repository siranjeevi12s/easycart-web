import { useEffect, useState, useContext } from 'react';
import { View, FlatList, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button as PaperButton, IconButton, Modal, Portal, useTheme } from 'react-native-paper';
import { api } from '../services/api';
import { CartContext } from '../context/AppContext';
import { useSnackbar } from '../components/Snackbar';
import { AppText } from '../components/AppText';
import { AppCard } from '../components/AppCard';
import { FoodImage } from '../components/FoodImage';
import { QtyStepper } from '../components/QtyStepper';
import { EmptyState } from '../components/EmptyState';
import { ListSkeleton } from '../components/Skeleton';
import { getFavDishes, getFavRestaurants, toggleFavDish, toggleFavRestaurant, type FavDish } from '../utils/favorites';

export default function Restaurant({ route, navigation }: any) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const snack = useSnackbar();
  const { restaurant } = route.params;
  const [menu, setMenu] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { cart, addToCart } = useContext(CartContext);
  const [favRest, setFavRest] = useState(false);
  const [favDishIds, setFavDishIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [selQty, setSelQty] = useState(1);

  useEffect(() => {
    api.get(`/restaurants/${restaurant._id}/menu`).then(({ data }) => setMenu(data)).catch(() => {}).finally(() => setLoading(false));
    getFavRestaurants().then((f) => setFavRest(f.includes(restaurant._id)));
    getFavDishes().then((f) => setFavDishIds(f.map((d) => d.id)));
  }, [restaurant._id]);

  const quickAdd = (item: any, qty = 1) => {
    if (!restaurant.isOpen) return snack.show('Restaurant is closed right now');
    for (let i = 0; i < qty; i++) addToCart(restaurant._id, item, restaurant.name);
    snack.show(`Added ${item.name} ×${qty}`);
  };

  const openDish = (item: any) => {
    setSelected(item);
    setSelQty(1);
  };

  const toggleRest = async () => {
    const { added } = await toggleFavRestaurant(restaurant._id);
    setFavRest(added);
    snack.show(added ? 'Saved to favorites' : 'Removed from favorites');
  };

  const toggleDish = async (item: any) => {
    const dish: FavDish = { id: item._id, name: item.name, price: item.price, restaurantId: restaurant._id, restaurantName: restaurant.name, image: item.image };
    const { favs, added } = await toggleFavDish(dish);
    setFavDishIds(favs.map((d) => d.id));
    snack.show(added ? `Saved ${item.name}` : `Removed ${item.name}`);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top, padding: 16 }}>
        <ListSkeleton rows={5} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {!!restaurant.image && <Image source={{ uri: restaurant.image }} style={{ width: '100%', height: 180 }} />}
      <View style={{ padding: 16, paddingBottom: 0, flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <AppText variant="title">{restaurant.name}</AppText>
          <AppText variant="caption" tone="muted" style={{ marginTop: 2 }}>
            {restaurant.address} • {restaurant.isOpen ? 'Open' : 'Closed'}
          </AppText>
          {!!restaurant.description && (
            <AppText variant="body" style={{ marginTop: 4 }}>
              {restaurant.description}
            </AppText>
          )}
        </View>
        <IconButton
          icon={favRest ? 'heart' : 'heart-outline'}
          iconColor={favRest ? theme.colors.error : theme.colors.onSurfaceVariant}
          onPress={toggleRest}
          accessibilityLabel={favRest ? 'Remove restaurant from favorites' : 'Save restaurant to favorites'}
        />
      </View>

      <FlatList
        data={menu}
        keyExtractor={(i) => i._id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <AppText variant="subheading" style={{ marginBottom: 8 }}>
            Menu — tap a dish for details
          </AppText>
        }
        ListEmptyComponent={<EmptyState icon="food" message="No menu items yet." />}
        renderItem={({ item }) => {
          const disabled = !item.isAvailable || !restaurant.isOpen;
          const faved = favDishIds.includes(item._id);
          return (
            <AppCard padded={false} onPress={() => openDish(item)} accessibilityLabel={`${item.name}, ₹${item.price}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ margin: 8 }}>
                  <FoodImage uri={item.image} width={90} height={90} />
                </View>
                <View style={{ flex: 1, padding: 10, paddingLeft: 2 }}>
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
                <IconButton
                  icon={faved ? 'heart' : 'heart-outline'}
                  size={18}
                  iconColor={faved ? theme.colors.error : theme.colors.outline}
                  onPress={() => toggleDish(item)}
                  style={{ margin: 0 }}
                  accessibilityLabel={faved ? `Unsave ${item.name}` : `Save ${item.name}`}
                />
                <PaperButton
                  mode="contained"
                  disabled={disabled}
                  onPress={() => quickAdd(item)}
                  style={{ marginRight: 10, borderRadius: 12 }}
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
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, borderRadius: 0, paddingBottom: insets.bottom + 4, backgroundColor: theme.colors.primary }}
          contentStyle={{ minHeight: 56 }}
          textColor={theme.colors.onPrimary}
          accessibilityLabel="Go to cart"
        >
          {cart.items.reduce((a: number, b: any) => a + b.quantity, 0)} items • Go to Cart →
        </PaperButton>
      )}

      {/* Food detail modal */}
      <Portal>
        <Modal visible={!!selected} onDismiss={() => setSelected(null)} contentContainerStyle={{ backgroundColor: theme.colors.surface, margin: 20, borderRadius: 16, overflow: 'hidden' }}>
          {selected && (
            <View>
              {!!selected.image && <FoodImage uri={selected.image} width={9999} height={220} rounded={false} style={{ width: '100%' }} />}
              <View style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <AppText variant="heading" style={{ flex: 1 }}>
                    {selected.name}
                  </AppText>
                  <IconButton
                    icon={favDishIds.includes(selected._id) ? 'heart' : 'heart-outline'}
                    iconColor={theme.colors.error}
                    onPress={() => toggleDish(selected)}
                    accessibilityLabel="Toggle favorite"
                  />
                </View>
                <AppText variant="caption" tone="muted" style={{ marginTop: 2 }}>
                  {selected.category} • {restaurant.name}
                </AppText>
                {!!selected.description && (
                  <AppText variant="body" tone="muted" style={{ marginTop: 8 }}>
                    {selected.description}
                  </AppText>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                  <AppText variant="title">₹{selected.price * selQty}</AppText>
                  <QtyStepper quantity={selQty} onChange={(d) => setSelQty((q) => Math.max(1, q + d))} />
                </View>
                <PaperButton
                  mode="contained"
                  disabled={!selected.isAvailable || !restaurant.isOpen}
                  onPress={() => { quickAdd(selected, selQty); setSelected(null); }}
                  style={{ marginTop: 16 }}
                  contentStyle={{ minHeight: 48 }}
                >
                  Add {selQty > 1 ? `${selQty} ` : ''}to cart • ₹{selected.price * selQty}
                </PaperButton>
              </View>
            </View>
          )}
        </Modal>
      </Portal>
    </View>
  );
}
