import { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';
import { AuthContext } from '../context/AppContext';

export default function Login({ navigation }: any) {
  const [email, setEmail] = useState('customer@test.com');
  const [password, setPassword] = useState('password123');
  const { setUser } = useContext(AuthContext);
  const submit = async () => {
    try {
      const { data } = await api.post('/auth/login', { email, password });
      await AsyncStorage.setItem('token', data.token);
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
    } catch (e: any) {
      Alert.alert('Login failed', e.response?.data?.message || 'Error');
    }
  };
  return (
    <View style={s.container}>
      <Text style={s.title}>Welcome back 👋</Text>
      <Text style={s.sub}>Pre-order • Pay • Pick up without waiting</Text>
      <TextInput style={s.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <TextInput style={s.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={s.btn} onPress={submit}><Text style={s.btnText}>Login</Text></TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Register')}><Text style={s.link}>No account? Register</Text></TouchableOpacity>
      <View style={s.hint}><Text style={s.hintText}>Demo: customer@test.com / password123</Text></View>
    </View>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F5', padding: 24, justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '700' },
  sub: { color: '#666', marginBottom: 20 },
  input: { backgroundColor: 'white', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#FFE8DE' },
  btn: { backgroundColor: '#FF6B35', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  btnText: { color: 'white', fontWeight: '700', fontSize: 16 },
  link: { textAlign: 'center', color: '#FF6B35', marginTop: 12, fontWeight: '600' },
  hint: { backgroundColor: '#FFF2EC', padding: 12, borderRadius: 10, marginTop: 16 },
  hintText: { color: '#FF6B35', textAlign: 'center', fontSize: 12 }
});
