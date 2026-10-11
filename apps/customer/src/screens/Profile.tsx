import { useState, useEffect, useCallback, useContext } from 'react';
import { View, ScrollView, Alert } from 'react-native';
import { Divider, IconButton, List, Menu, Switch, useTheme } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext, CartContext } from '../context/AppContext';
import { api, clearSession, saveSession } from '../services/api';
import { useAppThemeMode } from '../theme/ThemeContext';
import { useSnackbar } from '../components/Snackbar';
import { getFavDishes, getFavRestaurants, toggleFavDish, type FavDish } from '../utils/favorites';
import { Screen } from '../components/Screen';
import { AppText } from '../components/AppText';
import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { AppTextField } from '../components/AppTextField';
import { Avatar } from '../components/Avatar';
import { FormModal } from '../components/FormModal';
import { LoadingView } from '../components/LoadingView';

export default function Profile({ navigation }: any) {
  const theme = useTheme();
  const snack = useSnackbar();
  const { mode, toggle } = useAppThemeMode();
  const insets = useSafeAreaInsets();
  const { user, setUser } = useContext(AuthContext);
  const { addToCart } = useContext(CartContext);
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // overflow menu
  const [menuOpen, setMenuOpen] = useState(false);

  // edit profile
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);

  // password
  const [pwdOpen, setPwdOpen] = useState(false);
  const [curPwd, setCurPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);

  // favorites
  const [favRestIds, setFavRestIds] = useState<string[]>([]);
  const [favRestNames, setFavRestNames] = useState<Record<string, string>>({});
  const [favDishes, setFavDishes] = useState<FavDish[]>([]);

  const loadFavs = async () => {
    const [rids, dishes] = await Promise.all([getFavRestaurants(), getFavDishes()]);
    setFavRestIds(rids);
    setFavDishes(dishes);
    // Resolve names; prune dead restaurant ids quietly
    const names: Record<string, string> = {};
    const alive: string[] = [];
    await Promise.all(
      rids.map(async (id) => {
        try {
          const { data } = await api.get(`/restaurants/${id}`);
          names[id] = data.name;
          alive.push(id);
        } catch {}
      })
    );
    setFavRestNames(names);
    if (alive.length !== rids.length) {
      await AsyncStorage.setItem('easycart_fav_restaurants', JSON.stringify(alive));
      setFavRestIds(alive);
    }
  };
  const [addresses, setAddresses] = useState<any[]>([]);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [addrOpen, setAddrOpen] = useState(false);
  const [addrLabel, setAddrLabel] = useState('Home');
  const [addrText, setAddrText] = useState('');
  const [editingAddrIndex, setEditingAddrIndex] = useState<number | null>(null);

  const loadMe = async () => {
    try {
      const { data } = await api.get('/auth/me');
      setMe(data);
      const merged = { ...user, ...data };
      setUser(merged);
      await AsyncStorage.setItem('user', JSON.stringify(merged));
    } catch {}
    setLoading(false);
  };
  const loadPrefs = async () => {
    const n = await AsyncStorage.getItem('pref_notif');
    if (n !== null) setNotifEnabled(n === 'true');
    const a = await AsyncStorage.getItem('easycart_addresses');
    if (a) setAddresses(JSON.parse(a));
  };
  useEffect(() => { loadMe(); loadPrefs(); loadFavs(); }, []);
  useFocusEffect(useCallback(() => { loadMe(); loadFavs(); }, []));

  const displayUser = me || user;

  const openEdit = () => { setMenuOpen(false); setEditName(displayUser?.name || ''); setEditPhone(displayUser?.phone || ''); setEditOpen(true); };
  const saveEdit = async () => {
    if (!editName.trim()) return Alert.alert('Validation', 'Name required');
    setSaving(true);
    try {
      const { data } = await api.put('/auth/me', { name: editName.trim(), phone: editPhone.trim() });
      setMe(data);
      const merged = { ...user, ...data };
      setUser(merged);
      await AsyncStorage.setItem('user', JSON.stringify(merged));
      setEditOpen(false);
      Alert.alert('Saved', 'Profile updated');
    } catch (e: any) { Alert.alert('Error', e.response?.data?.message || 'Update failed'); }
    finally { setSaving(false); }
  };
  const savePassword = async () => {
    if (!curPwd || !newPwd || !confirmPwd) return Alert.alert('Validation', 'All fields required');
    if (newPwd !== confirmPwd) return Alert.alert('Validation', 'Passwords do not match');
    if (newPwd.length < 6) return Alert.alert('Validation', 'Min 6 characters');
    setPwdSaving(true);
    try {
      const { data } = await api.post('/auth/change-password', { currentPassword: curPwd, newPassword: newPwd });
      // Backend rotates the refresh token on password change — keep the new one
      if (data?.refreshToken) await saveSession((await AsyncStorage.getItem('token')) || '', data.refreshToken);
      Alert.alert('Success', 'Password changed');
      setPwdOpen(false); setCurPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (e: any) { Alert.alert('Error', e.response?.data?.message || 'Failed'); }
    finally { setPwdSaving(false); }
  };
  const saveAddresses = async (next: any[]) => { setAddresses(next); await AsyncStorage.setItem('easycart_addresses', JSON.stringify(next)); };
  const openAddAddr = () => { setMenuOpen(false); setAddrLabel('Home'); setAddrText(''); setEditingAddrIndex(null); setAddrOpen(true); };
  const confirmSaveAddr = async () => {
    if (!addrText.trim()) return Alert.alert('Validation', 'Address required');
    if (editingAddrIndex !== null) {
      const next = [...addresses];
      next[editingAddrIndex] = { label: addrLabel, text: addrText.trim() };
      await saveAddresses(next);
    } else await saveAddresses([...addresses, { label: addrLabel, text: addrText.trim() }]);
    setAddrOpen(false);
  };
  const deleteAddr = (idx: number) =>
    Alert.alert('Delete', `Delete ${addresses[idx].label}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => saveAddresses(addresses.filter((_, i) => i !== idx)) },
    ]);
  const toggleNotif = async (v: boolean) => { setNotifEnabled(v); await AsyncStorage.setItem('pref_notif', String(v)); };
  const openRestaurant = async (id: string) => {
    try {
      const { data } = await api.get(`/restaurants/${id}`);
      navigation.navigate('Restaurant', { restaurant: data });
    } catch {
      snack.show('Restaurant unavailable');
    }
  };
  const addFavDish = (d: FavDish) => {
    addToCart(d.restaurantId, { _id: d.id, name: d.name, price: d.price, image: d.image }, d.restaurantName);
    snack.show(`Added ${d.name} ×1`);
  };
  const removeFavDish = async (id: string) => {
    const cur = favDishes.find((d) => d.id === id);
    if (!cur) return;
    const { favs } = await toggleFavDish(cur);
    setFavDishes(favs);
  };
  const comingSoon = (t: string) => { setMenuOpen(false); setTimeout(() => Alert.alert(t, 'Coming soon!'), 200); };
  const goOrders = () => { setMenuOpen(false); (navigation as any).navigate('Orders'); };
  const openAddrList = () => {
    setMenuOpen(false);
    setTimeout(() => {
      if (addresses.length === 0) openAddAddr();
      else Alert.alert('Saved Addresses', `${addresses.length} saved\n\n${addresses.map((a) => `• ${a.label}: ${a.text}`).join('\n')}`, [{ text: 'Add', onPress: openAddAddr }, { text: 'OK' }]);
    }, 200);
  };
  const logout = () =>
    Alert.alert('Logout', 'You will be signed out.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => { await clearSession(); setUser(null); } },
    ]);

  if (loading && !displayUser) return <LoadingView />;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
        <AppCard>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Avatar name={displayUser?.name} email={displayUser?.email} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <AppText variant="subheading" numberOfLines={1}>
                {displayUser?.name || 'Guest'}
              </AppText>
              <AppText variant="caption" tone="muted" numberOfLines={1}>
                {displayUser?.email}
              </AppText>
              <AppText variant="caption" tone={displayUser?.phone ? 'text' : 'muted'}>
                {displayUser?.phone || 'No phone added'}
              </AppText>
            </View>
            <Menu
              visible={menuOpen}
              onDismiss={() => setMenuOpen(false)}
              anchor={<IconButton icon="dots-vertical" onPress={() => setMenuOpen(true)} accessibilityLabel="Account menu" />}
            >
              <Menu.Item leadingIcon="account-edit" onPress={openEdit} title="Edit Profile" />
              <Menu.Item leadingIcon="lock" onPress={() => { setMenuOpen(false); setTimeout(() => setPwdOpen(true), 200); }} title="Change Password" />
              <Menu.Item leadingIcon="receipt" onPress={goOrders} title="My Orders" />
              <Menu.Item leadingIcon="map-marker" onPress={openAddrList} title={`Saved Addresses (${addresses.length})`} />
              <Divider />
              <Menu.Item leadingIcon="credit-card" onPress={() => comingSoon('Payment Methods')} title="Payment Methods" />
              <Menu.Item leadingIcon="shield-lock" onPress={() => comingSoon('Privacy Policy')} title="Privacy Policy" />
              <Menu.Item leadingIcon="file-document" onPress={() => comingSoon('Terms')} title="Terms & Conditions" />
            </Menu>
          </View>
        </AppCard>

        <AppCard outlined>
          <AppText variant="bodyBold">Pre-order & quick pickup</AppText>
          <AppText variant="caption" tone="muted" style={{ marginTop: 2 }}>
            Order before you arrive • Pick up without waiting
          </AppText>
        </AppCard>

        <AppText variant="tiny" tone="muted" style={{ marginTop: 8, marginBottom: 4, letterSpacing: 0.5 }}>
          APPEARANCE
        </AppText>
        <AppCard>
          <List.Item
            title="Dark mode"
            description={mode === 'dark' ? 'On' : 'Off'}
            left={(props) => <List.Icon {...props} icon={mode === 'dark' ? 'weather-night' : 'weather-sunny'} />}
            right={() => <Switch value={mode === 'dark'} onValueChange={toggle} accessibilityLabel="Toggle dark mode" />}
          />
          <List.Item
            title="Notifications"
            description={notifEnabled ? 'On' : 'Off'}
            left={(props) => <List.Icon {...props} icon="bell" />}
            right={() => <Switch value={notifEnabled} onValueChange={toggleNotif} accessibilityLabel="Toggle notifications" />}
          />
        </AppCard>

        <AppText variant="tiny" tone="muted" style={{ marginTop: 8, marginBottom: 4, letterSpacing: 0.5 }}>
          FAVORITES
        </AppText>
        <AppCard>
          {favRestIds.length === 0 && favDishes.length === 0 ? (
            <AppText variant="body" tone="muted">
              Nothing saved yet — tap the heart on any restaurant or dish.
            </AppText>
          ) : (
            <>
              {favRestIds.map((id) => (
                <List.Item
                  key={`r-${id}`}
                  title={favRestNames[id] || 'Restaurant'}
                  description="Tap to open"
                  left={(props) => <List.Icon {...props} icon="store" />}
                  right={(props) => <List.Icon {...props} icon="chevron-right" />}
                  onPress={() => openRestaurant(id)}
                />
              ))}
              {favDishes.map((d) => (
                <List.Item
                  key={`d-${d.id}`}
                  title={`${d.name} • ₹${d.price}`}
                  description={d.restaurantName}
                  left={(props) => <List.Icon {...props} icon="food" />}
                  right={() => (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <IconButton icon="cart-plus" size={20} onPress={() => addFavDish(d)} accessibilityLabel={`Add ${d.name} to cart`} />
                      <IconButton icon="close" size={18} onPress={() => removeFavDish(d.id)} accessibilityLabel={`Remove ${d.name}`} />
                    </View>
                  )}
                />
              ))}
            </>
          )}
        </AppCard>

        <AppText variant="tiny" tone="muted" style={{ marginTop: 8, marginBottom: 4, letterSpacing: 0.5 }}>
          SUPPORT
        </AppText>
        <AppCard padded={false}>
          <List.Item
            title="Help Center"
            description="FAQs & guides"
            left={(props) => <List.Icon {...props} icon="help-circle" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => comingSoon('Help Center')}
          />
          <Divider />
          <List.Item
            title="Contact Support"
            description="Chat with us"
            left={(props) => <List.Icon {...props} icon="chat" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => comingSoon('Contact Support')}
          />
        </AppCard>

        <AppButton title="Logout" variant="outline" onPress={logout} style={{ marginTop: 16, borderColor: theme.colors.error }} />
        <AppText variant="caption" tone="muted" style={{ textAlign: 'center', marginTop: 10 }}>
          EasyCart v1.0.0
        </AppText>
      </ScrollView>

      <FormModal visible={editOpen} title="Edit Profile" onClose={() => setEditOpen(false)} onSave={saveEdit} saving={saving}>
        <AppTextField label="Name" value={editName} onChangeText={setEditName} placeholder="Full name" autoCapitalize="words" />
        <AppTextField label="Phone" value={editPhone} onChangeText={setEditPhone} placeholder="Phone" keyboardType="phone-pad" />
        <AppTextField label="Email" value={displayUser?.email || ''} onChangeText={() => {}} disabled />
      </FormModal>

      <FormModal visible={pwdOpen} title="Change Password" onClose={() => setPwdOpen(false)} onSave={savePassword} saveLabel="Update" saving={pwdSaving}>
        <AppTextField label="Current password" value={curPwd} onChangeText={setCurPwd} secure secureToggle />
        <AppTextField label="New password" value={newPwd} onChangeText={setNewPwd} secure secureToggle placeholder="Min 6 characters" />
        <AppTextField label="Confirm new password" value={confirmPwd} onChangeText={setConfirmPwd} secure secureToggle />
      </FormModal>

      <FormModal
        visible={addrOpen}
        title={editingAddrIndex !== null ? 'Edit Address' : 'Add Address'}
        onClose={() => setAddrOpen(false)}
        onSave={confirmSaveAddr}
      >
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {['Home', 'Work', 'Other'].map((l) => (
            <View key={l} style={{ flex: 1 }}>
              <AppButton title={l} variant={addrLabel === l ? 'primary' : 'secondary'} compact onPress={() => setAddrLabel(l)} />
            </View>
          ))}
        </View>
        <AppTextField label="Full address" value={addrText} onChangeText={setAddrText} multiline lines={3} placeholder="Full address" />
        {editingAddrIndex !== null && (
          <AppButton title="Delete address" variant="destructive" onPress={() => { setAddrOpen(false); deleteAddr(editingAddrIndex); }} style={{ marginTop: 4 }} />
        )}
      </FormModal>
    </Screen>
  );
}
