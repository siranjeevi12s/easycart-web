import { useState } from 'react';
import { View } from 'react-native';
import { Icon, useTheme } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen } from '../components/Screen';
import { AppText } from '../components/AppText';
import { AppButton } from '../components/AppButton';

const SLIDES = [
  { icon: 'store-search', title: 'Discover nearby kitchens', body: 'Browse restaurants, menus and ratings around you.' },
  { icon: 'cart', title: 'Order in seconds', body: 'Add items, pay securely with UPI, cards or netbanking.' },
  { icon: 'package-variant-closed', title: 'Pick up, no waiting', body: 'Get notified the moment your food is READY.' },
];

export default function Onboarding({ navigation }: any) {
  const theme = useTheme();
  const [idx, setIdx] = useState(0);
  const last = idx === SLIDES.length - 1;

  const done = async () => {
    await AsyncStorage.setItem('easycart_onboarded', 'true').catch(() => {});
    navigation.replace('Login');
  };

  const s = SLIDES[idx];
  return (
    <Screen>
      <View style={{ flex: 1 }}>
        <View style={{ alignItems: 'flex-end' }}>
          <AppButton title="Skip" variant="text" compact onPress={done} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
          <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: theme.colors.primaryContainer, justifyContent: 'center', alignItems: 'center' }}>
            <Icon source={s.icon} size={56} color={theme.colors.primary} />
          </View>
          <AppText variant="title" style={{ marginTop: 24, textAlign: 'center' }}>
            {s.title}
          </AppText>
          <AppText variant="body" tone="muted" style={{ marginTop: 8, textAlign: 'center' }}>
            {s.body}
          </AppText>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 24 }} accessibilityRole="adjustable">
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === idx ? 24 : 8, height: 8, borderRadius: 4,
                  backgroundColor: i === idx ? theme.colors.primary : theme.colors.outline,
                }}
              />
            ))}
          </View>
        </View>
        <AppButton
          title={last ? 'Get Started' : 'Next'}
          onPress={() => (last ? done() : setIdx(idx + 1))}
          style={{ marginBottom: 8 }}
        />
      </View>
    </Screen>
  );
}
