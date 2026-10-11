import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from 'react-native';
import { ActivityIndicator, Chip, Dialog, Portal, Switch, useTheme } from 'react-native-paper';
import { api } from '../services/api';
import { pickGalleryImage } from '../utils/image';
import { Screen } from '../components/Screen';
import { AppText } from '../components/AppText';
import { AppButton } from '../components/AppButton';
import { AppTextField } from '../components/AppTextField';
import { AppCard } from '../components/AppCard';
import { StatusChip } from '../components/StatusChip';
import { EmptyState } from '../components/EmptyState';
import { useSnackbar } from '../components/Snackbar';

const EMPTY_FORM = { name: '', description: '', price: '', category: 'Main', image: '', isAvailable: true };

export default function Menu() {
  const theme = useTheme();
  const { show } = useSnackbar();
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [selected, setSelected] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadRestaurants = useCallback(async () => {
    try {
      const { data } = await api.get('/restaurants/my');
      setRestaurants(data || []);
      if (data?.[0] && !selected) setSelected(data[0]._id);
    } catch (e: any) {
      show(e.response?.data?.message || 'Failed to load restaurants');
    } finally {
      setLoading(false);
    }
  }, [selected, show]);

  const loadMenu = useCallback(async () => {
    if (!selected) return;
    try {
      const { data } = await api.get(`/restaurants/${selected}/menu`);
      setItems(data || []);
    } catch (e: any) {
      show(e.response?.data?.message || 'Failed to load menu');
    } finally {
      setRefreshing(false);
    }
  }, [selected, show]);

  useEffect(() => { loadRestaurants(); }, [loadRestaurants]);
  useEffect(() => { loadMenu(); }, [loadMenu]);

  const openAdd = () => { setForm(EMPTY_FORM); setEditing(null); setOpen(true); };

  const choosePhoto = async () => {
    const uri = await pickGalleryImage();
    if (uri) {
      setForm((f) => ({ ...f, image: uri }));
      show('Photo attached');
    }
  };
  const openEdit = (it: any) => {
    setForm({
      name: it.name || '',
      description: it.description || '',
      price: String(it.price ?? ''),
      category: it.category || 'Main',
      image: it.image || '',
      isAvailable: it.isAvailable !== false,
    });
    setEditing(it._id);
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return Alert.alert('Validation', 'Item name required');
    const price = Number(form.price);
    if (!(price > 0)) return Alert.alert('Validation', 'Price must be greater than zero');
    setSaving(true);
    try {
      const body = { ...form, price };
      if (editing) await api.put(`/menu/${editing}`, body);
      else await api.post(`/restaurants/${selected}/menu`, body);
      setOpen(false);
      setForm(EMPTY_FORM);
      setEditing(null);
      loadMenu();
      show(editing ? 'Item updated' : 'Item created');
    } catch (e: any) {
      Alert.alert('Save failed', e.response?.data?.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  const del = (id: string, name: string) => {
    Alert.alert('Delete item', `Delete "${name}"?`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/menu/${id}`);
            loadMenu();
          } catch (e: any) {
            Alert.alert('Delete failed', e.response?.data?.message || 'Error');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <Screen scroll={false} style={{ justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadMenu(); }} />}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <View style={{ flex: 1 }}>
          <AppText variant="title">Menu</AppText>
          <AppText variant="body" tone="muted">Add • Edit • Disable items.</AppText>
        </View>
        {!!selected && <AppButton title="+ Add" compact onPress={openAdd} />}
      </View>

      {restaurants.length === 0 ? (
        <EmptyState icon="storefront-outline" message="No restaurant profile yet" hint="Create one in the Profile tab." />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8, flexGrow: 0 }}>
          <View style={{ flexDirection: 'row', gap: 6, paddingRight: 16 }}>
            {restaurants.map((r: any) => (
              <Chip key={r._id} selected={selected === r._id} onPress={() => setSelected(r._id)} compact>{r.name}</Chip>
            ))}
          </View>
        </ScrollView>
      )}

      {items.map((it) => (
        <AppCard key={it._id} outlined>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {!!it.image && (
              <Image source={{ uri: it.image }} style={{ width: 72, height: 72, borderRadius: 10 }} />
            )}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <AppText variant="bodyBold" style={{ flex: 1 }}>{it.name}</AppText>
                <StatusChip status={it.isAvailable ? 'Available' : 'Disabled'} kind={it.isAvailable ? 'success' : 'muted'} />
              </View>
              {!!it.description && <AppText variant="caption" tone="muted" numberOfLines={2}>{it.description}</AppText>}
              <AppText variant="bodyBold" style={{ marginTop: 4 }}>₹{it.price} <AppText variant="caption" tone="muted">• {it.category}</AppText></AppText>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <AppButton title="Edit" variant="outline" compact onPress={() => openEdit(it)} />
                <AppButton title="Delete" variant="text" compact onPress={() => del(it._id, it.name)} />
              </View>
            </View>
          </View>
        </AppCard>
      ))}
      {restaurants.length > 0 && items.length === 0 && (
        <EmptyState icon="food-outline" message="No menu items yet" hint="Add your first item to start receiving orders." />
      )}

      <Portal>
        <Dialog
          visible={open}
          onDismiss={() => setOpen(false)}
          style={{ width: '92%', maxWidth: 440, maxHeight: '92%', alignSelf: 'center', borderRadius: 16 }}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Dialog.Title>{editing ? 'Edit Item' : 'Add Menu Item'}</Dialog.Title>
            <Dialog.ScrollArea style={{ paddingHorizontal: 0 }}>
              <ScrollView
                contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: 12 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <AppTextField label="Name *" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
                <AppTextField label="Description" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} multiline lines={2} />
                <AppTextField label="Price (₹) *" value={form.price} onChangeText={(v) => setForm({ ...form, price: v.replace(/[^0-9.]/g, '') })} keyboardType="numeric" />
                <AppTextField label="Category" value={form.category} onChangeText={(v) => setForm({ ...form, category: v })} />
                <AppTextField label="Image URL" value={form.image.startsWith('data:') ? '' : form.image} onChangeText={(v) => setForm({ ...form, image: v })} autoCapitalize="none" placeholder="https://… or choose below" />
                <AppButton title="Choose photo from gallery" variant="outline" icon="image" compact onPress={choosePhoto} style={{ marginBottom: 4 }} />
                {!!form.image && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <Image source={{ uri: form.image }} style={{ width: 72, height: 72, borderRadius: 10 }} />
                    <AppButton title="Clear" variant="text" compact onPress={() => setForm({ ...form, image: '' })} />
                  </View>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <AppText variant="bodyBold">Available</AppText>
                  <Switch value={form.isAvailable} onValueChange={(v) => setForm({ ...form, isAvailable: v })} />
                </View>
              </ScrollView>
            </Dialog.ScrollArea>
            <Dialog.Actions style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
              <AppButton title="Cancel" variant="text" compact onPress={() => setOpen(false)} style={{ flex: 1 }} />
              <AppButton title={editing ? 'Update' : 'Create'} compact onPress={save} loading={saving} style={{ flex: 2 }} />
            </Dialog.Actions>
          </KeyboardAvoidingView>
        </Dialog>
      </Portal>
    </Screen>
  );
}
