import { useState, useContext } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';
import { AuthContext } from '../context/AppContext';
import { Screen } from '../components/Screen';
import { AppText } from '../components/AppText';
import { AppButton } from '../components/AppButton';
import { AppTextField } from '../components/AppTextField';

export default function Register({ navigation }: any) {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const { setUser } = useContext(AuthContext);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password) return Alert.alert('Validation', 'Name, email and password required');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/register', { ...form, role: 'customer' });
      await AsyncStorage.setItem('token', data.token);
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
    } catch (e: any) {
      Alert.alert('Failed', e.response?.data?.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center' }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <AppText variant="title">Create Account</AppText>
          <AppText variant="body" tone="muted" style={{ marginBottom: 16 }}>
            Order before you arrive.
          </AppText>
          <AppTextField label="Full Name" value={form.name} onChangeText={set('name')} autoCapitalize="words" />
          <AppTextField label="Email" value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
          <AppTextField label="Phone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
          <AppTextField label="Password" value={form.password} onChangeText={set('password')} secure />
          <AppButton title="Register" onPress={submit} loading={busy} style={{ marginTop: 4 }} />
          <AppButton title="Already have an account? Login" variant="text" onPress={() => navigation.navigate('Login')} style={{ marginTop: 4 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
