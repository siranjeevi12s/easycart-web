import { View } from 'react-native';
import { useEffect } from 'react';
import { Icon, useTheme } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppText } from '../components/AppText';

export default function Splash({ navigation }: any) {
  const theme = useTheme();
  useEffect(() => {
    let cancelled = false;
    let timer: any = null;
    (async () => {
      const seen = await AsyncStorage.getItem('easycart_onboarded').catch(() => 'true');
      if (cancelled) return;
      timer = setTimeout(() => navigation.replace(seen ? 'Login' : 'Onboarding'), 1200);
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [navigation]);
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Icon source="silverware-fork-knife" size={64} color={theme.colors.onPrimary} />
      <AppText variant="display" tone="onPrimary" style={{ marginTop: 12 }}>
        EasyCart
      </AppText>
      <AppText variant="body" tone="onPrimary" style={{ marginTop: 8, textAlign: 'center', opacity: 0.9 }}>
        Order before you arrive. Pick up without waiting.
      </AppText>
    </View>
  );
}
