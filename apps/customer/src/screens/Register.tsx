import { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';
import { AuthContext } from '../context/AppContext';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const { setUser } = useContext(AuthContext);
  const submit = async () => {
    try {
      const { data } = await api.post('/auth/register', { ...form, role: 'customer' });
      await AsyncStorage.setItem('token', data.token);
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
    } catch (e: any) {
      Alert.alert('Failed', e.response?.data?.message || 'Error');
    }
  };
  return (
    <View style={s.container}>
      <Text style={s.title}>Create Account</Text>
      <Text style={s.sub}>Order before you arrive.</Text>
      <TextInput style={s.input} placeholder="Full Name" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
      <TextInput style={s.input} placeholder="Email" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} autoCapitalize="none" />
      <TextInput style={s.input} placeholder="Phone" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} />
      <TextInput style={s.input} placeholder="Password" value={form.password} onChangeText={(v) => setForm({ ...form, password: v })} secureTextEntry />
      <TouchableOpacity style={s.btn} onPress={submit}><Text style={s.btnText}>Register</Text></TouchableOpacity>
    </View>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F5', padding: 24, justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '700' }, sub: { color: '#666', marginBottom: 16 },
  input: { backgroundColor: 'white', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#FFE8DE' },
  btn: { backgroundColor: '#FF6B35', padding: 16, borderRadius: 12, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '700' }
});
