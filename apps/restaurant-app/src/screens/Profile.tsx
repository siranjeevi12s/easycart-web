import { useCallback, useContext, useEffect, useState } from 'react';
import { Alert, Image, RefreshControl, View } from 'react-native';
import { ActivityIndicator, Switch, useTheme } from 'react-native-paper';
import { api, clearSession } from '../services/api';
import { getCurrentAddress } from '../utils/location';
import { pickGalleryImage } from '../utils/image';
import { AuthContext } from '../context/AppContext';
import { useAppThemeMode } from '../theme/ThemeContext';
import { Screen } from '../components/Screen';
import { AppText } from '../components/AppText';
import { AppButton } from '../components/AppButton';
import { AppTextField } from '../components/AppTextField';
import { AppCard } from '../components/AppCard';
import { StatusChip } from '../components/StatusChip';
import { EmptyState } from '../components/EmptyState';
import { useSnackbar } from '../components/Snackbar';

const EMPTY_FORM = { name: '', description: '', address: '', phone: '', image: '' };

export default function Profile() {
  const theme = useTheme();
  const { user, setUser } = useContext(AuthContext);
  const { mode, toggle } = useAppThemeMode();
  const { show } = useSnackbar();
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [locBusy, setLocBusy] = useState(false);

  const load = useCallback(async (quiet = false) => {
    try {
      const { data } = await api.get('/restaurants/my');
      setRestaurants(data || []);
    } catch (e: any) {
      if (!quiet) show(e.response?.data?.message || 'Failed to load restaurants');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [show]);

  useEffect(() => { load(); }, [load]);
  // Live status: reflect admin approvals/suspensions without manual reload
  useEffect(() => {
    const t = setInterval(() => { load(true).catch(() => {}); }, 20000);
    return () => clearInterval(t);
  }, [load]);

  const create = async () => {
    if (!form.name.trim()) return Alert.alert('Validation', 'Restaurant name required');
    setCreating(true);
    try {
      await api.post('/restaurants', form);
      show('Restaurant profile created');
      setForm(EMPTY_FORM);
      load();
    } catch (e: any) {
      Alert.alert('Failed', e.response?.data?.message || 'Error');
    } finally {
      setCreating(false);
    }
  };

  const toggleField = async (r: any, field: 'isOpen' | 'isActive') => {
    try {
      await api.put(`/restaurants/${r._id}`, { [field]: !r[field] });
      load(true);
    } catch (e: any) {
      Alert.alert('Update failed', e.response?.data?.message || 'Error');
    }
  };

  const logout = async () => {
    await clearSession();
    setUser(null);
  };

  const useMyLocation = async () => {
    setLocBusy(true);
    try {
      const loc = await getCurrentAddress();
      setForm((f) => ({ ...f, address: loc.address }));
      show('Location filled from GPS');
    } catch (e: any) {
      Alert.alert('Location failed', e.message || 'Could not determine location');
    } finally {
      setLocBusy(false);
    }
  };

  const choosePhoto = async () => {
    const uri = await pickGalleryImage();
    if (uri) {
      setForm((f) => ({ ...f, image: uri }));
      show('Photo attached');
    }
  };

  if (loading) {
    return (
      <Screen scroll={false} style={{ justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      <AppText variant="title">Profile</AppText>
      <AppText variant="body" tone="muted" style={{ marginBottom: 12 }}>
        Signed in as {user?.name} ({user?.email})
      </AppText>

      <AppCard outlined>
        <AppText variant="subheading" style={{ marginBottom: 12 }}>New restaurant</AppText>
        <AppTextField label="Restaurant Name *" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
        <AppTextField label="Description" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} multiline lines={2} />
        <AppTextField label="Address" value={form.address} onChangeText={(v) => setForm({ ...form, address: v })} multiline lines={2} />
        <AppButton title="Use my location" variant="outline" icon="crosshairs-gps" onPress={useMyLocation} loading={locBusy} style={{ marginBottom: 12 }} />
        <AppTextField label="Phone" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" />
        <AppTextField label="Image URL" value={form.image.startsWith('data:') ? '' : form.image} onChangeText={(v) => setForm({ ...form, image: v })} autoCapitalize="none" placeholder="https://… or choose below" />
        <AppButton title="Choose photo from gallery" variant="outline" icon="image" onPress={choosePhoto} style={{ marginBottom: 12 }} />
        {!!form.image && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <Image source={{ uri: form.image }} style={{ width: 72, height: 72, borderRadius: 10 }} />
            <AppButton title="Clear" variant="text" compact onPress={() => setForm({ ...form, image: '' })} />
          </View>
        )}
        <AppButton title="Create Profile" onPress={create} loading={creating} />
      </AppCard>

      <AppText variant="subheading" style={{ marginTop: 8, marginBottom: 8 }}>Your Restaurants</AppText>
      {restaurants.map((r) => (
        <AppCard key={r._id} outlined>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <AppText variant="bodyBold" style={{ flex: 1 }}>{r.name}</AppText>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <StatusChip status={r.approvalStatus || 'pending'} />
              <StatusChip status={r.isActive ? 'Active' : 'Hidden'} kind={r.isActive ? 'success' : 'muted'} />
            </View>
          </View>
          {(r.approvalStatus === 'pending' || r.approvalStatus === 'under_review') && (
            <AppText variant="caption" tone="info" style={{ marginTop: 4 }}>
              {r.approvalStatus === 'pending' ? 'Submitted — waiting for admin approval.' : 'Under review by the admin team.'}
            </AppText>
          )}
          {(r.approvalStatus === 'rejected' || r.approvalStatus === 'suspended') && (
            <AppText variant="caption" tone="error" style={{ marginTop: 4 }}>
              {r.approvalStatus === 'rejected' ? 'Application rejected' : 'Suspended by admin'}
              {r.approvalNote ? `: ${r.approvalNote}` : ''} — not visible to customers.
            </AppText>
          )}
          <AppText variant="caption" tone="muted" style={{ marginTop: 4 }}>{r.address} • {r.phone}</AppText>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <AppText variant="body">{r.isOpen ? 'Open' : 'Closed'}</AppText>
            <Switch value={!!r.isOpen} onValueChange={() => toggleField(r, 'isOpen')} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <AppText variant="body">{r.isActive ? 'Visible to Customers' : 'Hidden'}</AppText>
            <Switch value={!!r.isActive} onValueChange={() => toggleField(r, 'isActive')} />
          </View>
        </AppCard>
      ))}
      {restaurants.length === 0 && (
        <EmptyState icon="storefront-outline" message="No profiles yet" hint="Create your first restaurant above." />
      )}

      <AppCard outlined>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText variant="bodyBold">Dark mode</AppText>
          <Switch value={mode === 'dark'} onValueChange={toggle} />
        </View>
      </AppCard>
      <AppButton title="Logout" variant="outline" onPress={logout} style={{ marginBottom: 16 }} />
    </Screen>
  );
}
