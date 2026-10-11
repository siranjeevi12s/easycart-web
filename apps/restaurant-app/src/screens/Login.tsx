import { useContext, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useTheme } from 'react-native-paper';
import { api, saveSession, BASE_URL } from '../services/api';
import { AuthContext } from '../context/AppContext';
import { Screen } from '../components/Screen';
import { AppText } from '../components/AppText';
import { AppButton } from '../components/AppButton';
import { AppTextField } from '../components/AppTextField';
import { AppCard } from '../components/AppCard';

export default function Login({ navigation }: any) {
  const theme = useTheme();
  const [email, setEmail] = useState('restaurant@test.com');
  const [password, setPassword] = useState('password123');
  const [busy, setBusy] = useState(false);
  const { setUser } = useContext(AuthContext);

  const submit = async () => {
    if (!email.trim() || !password) return Alert.alert('Validation', 'Email and password required');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/login', { email: email.trim(), password });
      if (data.user?.role && data.user.role !== 'restaurant' && data.user.role !== 'admin') {
        return Alert.alert('Wrong account', 'This app is for restaurant owners. Please use a restaurant account.');
      }
      await saveSession(data.token, data.refreshToken, data.user);
      setUser(data.user);
    } catch (e: any) {
      const detail = e.response?.data?.message || (e.request ? `No response from server` : e.message) || 'Error';
      Alert.alert('Login failed', `${detail}\n(${BASE_URL})`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center' }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <AppText variant="title">Restaurant Login</AppText>
          <AppText variant="body" tone="muted" style={{ marginBottom: 20 }}>
            Accept orders • Prepare • Mark READY • Verify pickup
          </AppText>
          <AppTextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <AppTextField label="Password" value={password} onChangeText={setPassword} secure secureToggle />
          <AppButton title="Login" onPress={submit} loading={busy} style={{ marginTop: 4 }} />
          <AppButton title="No account? Register" variant="text" onPress={() => navigation.navigate('Register')} style={{ marginTop: 4 }} />
          <AppCard outlined style={{ marginTop: 12, backgroundColor: theme.colors.primaryContainer }}>
            <AppText variant="caption" tone="primary" style={{ textAlign: 'center' }}>
              Demo: restaurant@test.com / password123
            </AppText>
            <AppText variant="tiny" tone="muted" style={{ textAlign: 'center', marginTop: 4 }}>
              Server: {BASE_URL}
            </AppText>
          </AppCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
