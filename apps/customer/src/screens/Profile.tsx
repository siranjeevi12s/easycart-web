import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Modal, TextInput, Switch, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useContext, useState, useEffect, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../context/AppContext';
import { api } from '../services/api';

function initials(name?: string, email?: string) {
  if (name) return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  if (email) return email[0].toUpperCase();
  return 'U';
}

export default function Profile({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user, setUser } = useContext(AuthContext);
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // overflow
  const [menuOpen, setMenuOpen] = useState(false);

  // edit
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

  // prefs & addresses
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [addresses, setAddresses] = useState<any[]>([]);
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
  useEffect(() => { loadMe(); loadPrefs(); }, []);
  useFocusEffect(useCallback(() => { loadMe(); }, []));

  const displayUser = me || user;
  const avatarText = initials(displayUser?.name, displayUser?.email);

  const openEdit = () => { setMenuOpen(false); setEditName(displayUser?.name || ''); setEditPhone(displayUser?.phone || ''); setEditOpen(true); };
  const saveEdit = async () => {
    if (!editName.trim()) return Alert.alert('Validation', 'Name required');
    setSaving(true);
    try {
      const { data } = await api.put('/auth/me', { name: editName.trim(), phone: editPhone.trim() });
      setMe(data); const merged = { ...user, ...data }; setUser(merged);
      await AsyncStorage.setItem('user', JSON.stringify(merged));
      setEditOpen(false); Alert.alert('Saved', 'Profile updated');
    } catch (e: any) { Alert.alert('Error', e.response?.data?.message || 'Update failed'); }
    finally { setSaving(false); }
  };
  const savePassword = async () => {
    if (!curPwd || !newPwd || !confirmPwd) return Alert.alert('Validation', 'All fields required');
    if (newPwd !== confirmPwd) return Alert.alert('Validation', 'Passwords do not match');
    if (newPwd.length < 6) return Alert.alert('Validation', 'Min 6 characters');
    setPwdSaving(true);
    try { await api.post('/auth/change-password', { currentPassword: curPwd, newPassword: newPwd }); Alert.alert('Success', 'Password changed'); setPwdOpen(false); setCurPwd(''); setNewPwd(''); setConfirmPwd(''); }
    catch (e: any) { Alert.alert('Error', e.response?.data?.message || 'Failed'); }
    finally { setPwdSaving(false); }
  };
  const saveAddresses = async (next: any[]) => { setAddresses(next); await AsyncStorage.setItem('easycart_addresses', JSON.stringify(next)); };
  const openAddAddr = () => { setMenuOpen(false); setAddrLabel('Home'); setAddrText(''); setEditingAddrIndex(null); setAddrOpen(true); };
  const openEditAddr = (idx: number) => { setAddrLabel(addresses[idx].label); setAddrText(addresses[idx].text); setEditingAddrIndex(idx); setAddrOpen(true); };
  const confirmSaveAddr = async () => {
    if (!addrText.trim()) return Alert.alert('Validation', 'Address required');
    if (editingAddrIndex !== null) { const next = [...addresses]; next[editingAddrIndex] = { label: addrLabel, text: addrText.trim() }; await saveAddresses(next); }
    else await saveAddresses([...addresses, { label: addrLabel, text: addrText.trim() }]);
    setAddrOpen(false);
  };
  const deleteAddr = (idx: number) => Alert.alert('Delete', `Delete ${addresses[idx].label}?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => saveAddresses(addresses.filter((_, i) => i !== idx)) }]);
  const toggleNotif = async (v: boolean) => { setNotifEnabled(v); await AsyncStorage.setItem('pref_notif', String(v)); };
  const comingSoon = (t: string) => { setMenuOpen(false); setTimeout(() => Alert.alert(t, 'Coming soon!'), 200); };
  const goOrders = () => { setMenuOpen(false); (navigation as any).navigate('Orders'); };
  const openAddrList = () => { setMenuOpen(false); setTimeout(() => { if (addresses.length === 0) openAddAddr(); else Alert.alert('Saved Addresses', `${addresses.length} saved\n\n${addresses.map(a => `• ${a.label}: ${a.text}`).join('\n')}`, [{ text: 'Add', onPress: openAddAddr }, { text: 'OK' }]); }, 200); };
  const logout = () => Alert.alert('Logout', 'You will be signed out.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Logout', style: 'destructive', onPress: async () => { await AsyncStorage.removeItem('token'); await AsyncStorage.removeItem('user'); setUser(null); } }]);

  if (loading && !displayUser) return <View style={[s.center, { paddingTop: insets.top + 16 }]}><ActivityIndicator color="#FF6B35" /></View>;

  return (
    <View style={[s.container, { paddingTop: insets.top + 12 }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
        {/* Header with overflow */}
        <View style={s.headerCard}>
          <View style={s.avatar}><Text style={s.avatarText}>{avatarText}</Text></View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={s.name} numberOfLines={1}>{displayUser?.name || 'Guest'}</Text>
            <Text style={s.email} numberOfLines={1}>{displayUser?.email}</Text>
            <Text style={displayUser?.phone ? s.phone : s.phoneMuted}>{displayUser?.phone || 'No phone added'}</Text>
          </View>
          <TouchableOpacity onPress={() => setMenuOpen(true)} style={s.overflowBtn} hitSlop={12}><Text style={s.overflowIcon}>⋮</Text></TouchableOpacity>
        </View>

        {/* Important info - compact */}
        <View style={s.infoCard}>
          <Text style={s.infoTitle}>Pre-order & quick pickup</Text>
          <Text style={s.infoSub}>Order before you arrive • Pick up without waiting</Text>
        </View>

        {/* Support - important */}
        <Text style={s.sectionTitle}>SUPPORT</Text>
        <View style={s.card}>
          <TouchableOpacity onPress={() => comingSoon('Help Center')} style={r.row}><Text style={r.icon}>❓</Text><View style={{ flex: 1, marginLeft: 12 }}><Text style={r.rowTitle}>Help Center</Text><Text style={r.rowSub}>FAQs & guides</Text></View><Text style={r.chev}>›</Text></TouchableOpacity>
          <View style={s.sep} />
          <TouchableOpacity onPress={() => comingSoon('Contact Support')} style={r.row}><Text style={r.icon}>💬</Text><View style={{ flex: 1, marginLeft: 12 }}><Text style={r.rowTitle}>Contact Support</Text><Text style={r.rowSub}>Chat with us</Text></View><Text style={r.chev}>›</Text></TouchableOpacity>
        </View>

        <TouchableOpacity style={s.logoutBtn} onPress={logout}><Text style={s.logoutText}>Logout</Text></TouchableOpacity>
        <Text style={s.version}>EasyCart v1.0.0</Text>
      </ScrollView>

      {/* Overflow Menu */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setMenuOpen(false)}>
          <View style={[s.menuCard, { marginTop: insets.top + 60 }]}>
            <Text style={s.menuTitle}>Account</Text>
            <TouchableOpacity onPress={openEdit} style={s.menuRow}><Text style={s.menuIcon}>👤</Text><Text style={s.menuText}>Edit Profile</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => { setMenuOpen(false); setTimeout(() => setPwdOpen(true), 200); }} style={s.menuRow}><Text style={s.menuIcon}>🔒</Text><Text style={s.menuText}>Change Password</Text></TouchableOpacity>
            <TouchableOpacity onPress={goOrders} style={s.menuRow}><Text style={s.menuIcon}>🧾</Text><Text style={s.menuText}>My Orders</Text></TouchableOpacity>
            <TouchableOpacity onPress={openAddrList} style={s.menuRow}><Text style={s.menuIcon}>📍</Text><Text style={s.menuText}>Saved Addresses</Text><Text style={s.menuBadge}>{addresses.length}</Text></TouchableOpacity>
            <View style={s.menuSep} />
            <Text style={s.menuTitle}>Preferences</Text>
            <View style={s.menuRow}>
              <Text style={s.menuIcon}>🔔</Text><Text style={[s.menuText, { flex: 1 }]}>Notifications</Text>
              <Switch value={notifEnabled} onValueChange={toggleNotif} trackColor={{ true: '#FF6B35' }} />
            </View>
            <View style={s.menuSep} />
            <Text style={s.menuTitle}>More</Text>
            <TouchableOpacity onPress={() => comingSoon('Payment Methods')} style={s.menuRow}><Text style={s.menuIcon}>💳</Text><Text style={s.menuText}>Payment Methods</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => comingSoon('Privacy Policy')} style={s.menuRow}><Text style={s.menuIcon}>🔒</Text><Text style={s.menuText}>Privacy Policy</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => comingSoon('Terms')} style={s.menuRow}><Text style={s.menuIcon}>📄</Text><Text style={s.menuText}>Terms & Conditions</Text></TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={editOpen} animationType="slide" transparent><View style={s.modalOverlay}><View style={s.modalCard}>
        <Text style={s.modalTitle}>Edit Profile</Text>
        <Text style={s.inputLabel}>Name</Text><TextInput value={editName} onChangeText={setEditName} style={s.input} placeholder="Full name" />
        <Text style={s.inputLabel}>Phone</Text><TextInput value={editPhone} onChangeText={setEditPhone} style={s.input} placeholder="Phone" keyboardType="phone-pad" />
        <Text style={s.inputLabel}>Email</Text><TextInput value={displayUser?.email} editable={false} style={[s.input, { backgroundColor: '#F3F4F6', color: '#666' }]} />
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
          <TouchableOpacity onPress={() => setEditOpen(false)} style={[s.modalBtn, s.modalCancel]}><Text style={s.modalCancelText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity onPress={saveEdit} disabled={saving} style={[s.modalBtn, s.modalSave]}><Text style={s.modalSaveText}>{saving ? 'Saving...' : 'Save'}</Text></TouchableOpacity>
        </View>
      </View></View></Modal>

      <Modal visible={pwdOpen} animationType="slide" transparent><View style={s.modalOverlay}><View style={s.modalCard}>
        <Text style={s.modalTitle}>Change Password</Text>
        <Text style={s.inputLabel}>Current</Text><TextInput value={curPwd} onChangeText={setCurPwd} style={s.input} secureTextEntry placeholder="Current" />
        <Text style={s.inputLabel}>New</Text><TextInput value={newPwd} onChangeText={setNewPwd} style={s.input} secureTextEntry placeholder="Min 6" />
        <Text style={s.inputLabel}>Confirm</Text><TextInput value={confirmPwd} onChangeText={setConfirmPwd} style={s.input} secureTextEntry placeholder="Confirm" />
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
          <TouchableOpacity onPress={() => setPwdOpen(false)} style={[s.modalBtn, s.modalCancel]}><Text style={s.modalCancelText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity onPress={savePassword} disabled={pwdSaving} style={[s.modalBtn, s.modalSave]}><Text style={s.modalSaveText}>{pwdSaving ? 'Saving...' : 'Update'}</Text></TouchableOpacity>
        </View>
      </View></View></Modal>

      <Modal visible={addrOpen} animationType="slide" transparent><View style={s.modalOverlay}><View style={s.modalCard}>
        <Text style={s.modalTitle}>{editingAddrIndex !== null ? 'Edit' : 'Add'} Address</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {['Home', 'Work', 'Other'].map(l => (
            <TouchableOpacity key={l} onPress={() => setAddrLabel(l)} style={[s.chip, addrLabel === l && s.chipActive]}><Text style={[s.chipText, addrLabel === l && s.chipTextActive]}>{l}</Text></TouchableOpacity>
          ))}
        </View>
        <TextInput value={addrText} onChangeText={setAddrText} style={[s.input, { height: 80, textAlignVertical: 'top' }]} placeholder="Full address" multiline />
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
          <TouchableOpacity onPress={() => setAddrOpen(false)} style={[s.modalBtn, s.modalCancel]}><Text style={s.modalCancelText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity onPress={confirmSaveAddr} style={[s.modalBtn, s.modalSave]}><Text style={s.modalSaveText}>Save</Text></TouchableOpacity>
        </View>
      </View></View></Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF8F5' },
  headerCard: { backgroundColor: 'white', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FF6B35', justifyContent: 'center', alignItems: 'center' }, avatarText: { color: 'white', fontWeight: '800', fontSize: 20 },
  name: { fontWeight: '800', fontSize: 16 }, email: { color: '#666', fontSize: 13, marginTop: 2 }, phone: { color: '#1A1A1A', fontSize: 13, marginTop: 2, fontWeight: '600' }, phoneMuted: { color: '#999', fontSize: 12, marginTop: 2, fontStyle: 'italic' },
  overflowBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF2EC', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FFE8DE', marginLeft: 8 }, overflowIcon: { fontSize: 18, fontWeight: '800', color: '#FF6B35', marginTop: -2 },
  infoCard: { backgroundColor: '#FFF2EC', borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#FFE8DE' }, infoTitle: { fontWeight: '700', fontSize: 13 }, infoSub: { color: '#6B7280', fontSize: 11, marginTop: 2 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginTop: 16, marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' },
  card: { backgroundColor: 'white', borderRadius: 14, overflow: 'hidden', elevation: 1 },
  sep: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 48 },
  logoutBtn: { backgroundColor: 'white', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA', marginTop: 16 }, logoutText: { color: '#DC2626', fontWeight: '800' },
  version: { textAlign: 'center', color: '#9CA3AF', fontSize: 11, marginTop: 10 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  menuCard: { position: 'absolute', right: 16, width: 260, backgroundColor: 'white', borderRadius: 14, padding: 12, elevation: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12 },
  menuTitle: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 8, marginBottom: 4, marginLeft: 4 },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8 },
  menuIcon: { fontSize: 16, width: 28, textAlign: 'center' }, menuText: { fontSize: 14, fontWeight: '600', color: '#1F2937', flex: 1, marginLeft: 8 }, menuBadge: { backgroundColor: '#FFF2EC', color: '#FF6B35', fontWeight: '700', fontSize: 11, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  menuSep: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }, modalCard: { backgroundColor: 'white', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 }, inputLabel: { fontSize: 12, fontWeight: '700', color: '#374151', marginTop: 8, marginBottom: 4 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, fontSize: 14 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' }, modalCancel: { backgroundColor: '#F3F4F6' }, modalCancelText: { fontWeight: '700', color: '#374151' }, modalSave: { backgroundColor: '#FF6B35' }, modalSaveText: { fontWeight: '800', color: 'white' },
  chip: { flex: 1, padding: 10, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' }, chipActive: { backgroundColor: '#FF6B35', borderColor: '#FF6B35' }, chipText: { fontWeight: '600', color: '#6B7280' }, chipTextActive: { color: 'white' },
});
const r = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: 'white', minHeight: 52 },
  icon: { fontSize: 18, width: 28, textAlign: 'center' },
  rowTitle: { fontWeight: '600', fontSize: 14, color: '#1F2937' },
  rowSub: { color: '#6B7280', fontSize: 11, marginTop: 1 },
  chev: { color: '#D1D5DB', fontSize: 16, marginLeft: 8 },
});
