import { useContext, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { api, saveSession } from '../services/api';
import { AuthContext } from '../context/AppContext';
import { Screen } from '../components/Screen';
import { AppText } from '../components/AppText';
import { AppButton } from '../components/AppButton';
import { AppTextField } from '../components/AppTextField';
import { useSnackbar } from '../components/Snackbar';

export default function Register({ navigation }: any) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const { setUser } = useContext(AuthContext);
  const { show } = useSnackbar();

  const submit = async () => {
    if (!name.trim() || !email.trim() || !password) return Alert.alert('Validation', 'Name, email and password required');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/register', { name: name.trim(), email: email.trim(), phone: phone.trim(), password, role: 'restaurant' });
      await saveSession(data.token, data.refreshToken, data.user);
      setUser(data.user);
      show('Account created — set up your restaurant profile');
    } catch (e: any) {
      Alert.alert('Register failed', e.response?.data?.errors?.[0]?.msg || e.response?.data?.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center' }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <AppText variant="title">Create Restaurant Account</AppText>
          <AppText variant="body" tone="muted" style={{ marginBottom: 20 }}>
            Start receiving pre-orders in minutes
          </AppText>
          <AppTextField label="Owner Name" value={name} onChangeText={setName} autoCapitalize="words" />
          <AppTextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <AppTextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <AppTextField label="Password" value={password} onChangeText={setPassword} secure secureToggle />
          <AppButton title="Create Account" onPress={submit} loading={busy} style={{ marginTop: 4 }} />
          <AppButton title="Already have account? Login" variant="text" onPress={() => navigation.navigate('Login')} style={{ marginTop: 4 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
