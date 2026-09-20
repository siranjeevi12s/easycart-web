import { View, Text, StyleSheet } from 'react-native';
import { useEffect } from 'react';

export default function Splash({ navigation }: any) {
  useEffect(() => {
    const t = setTimeout(() => navigation.replace('Login'), 1200);
    return () => clearTimeout(t);
  }, []);
  return (
    <View style={s.container}>
      <Text style={s.logo}>🍽️ EasyCart</Text>
      <Text style={s.tag}>Order before you arrive. Pick up without waiting.</Text>
    </View>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FF6B35', justifyContent: 'center', alignItems: 'center', padding: 24 },
  logo: { fontSize: 36, fontWeight: '800', color: 'white' },
  tag: { color: 'white', marginTop: 8, textAlign: 'center', opacity: 0.9 }
});
