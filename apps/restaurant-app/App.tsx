import { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View } from 'react-native';
import { Icon, useTheme } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onAuthLost } from './src/services/api';
import { AppThemeProvider, useNavTheme } from './src/theme/ThemeContext';
import { SnackProvider } from './src/components/Snackbar';

import LoginScreen from './src/screens/Login';
import RegisterScreen from './src/screens/Register';
import DashboardScreen from './src/screens/Dashboard';
import OrdersScreen from './src/screens/Orders';
import MenuScreen from './src/screens/Menu';
import PaymentsScreen from './src/screens/Payments';
import PromoteScreen from './src/screens/Promote';
import PromoPayScreen from './src/screens/PromoPay';
import ProfileScreen from './src/screens/Profile';
import { AuthContext } from './src/context/AppContext';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, string> = {
  Dashboard: 'view-dashboard',
  Orders: 'receipt-text',
  Menu: 'book-open-variant',
  Payments: 'bank',
  Promote: 'bullhorn',
  Profile: 'store',
};

function Tabs() {
  const theme = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outline },
        tabBarIcon: ({ color, size }) => <Icon source={TAB_ICONS[route.name] || 'circle'} size={size} color={color} />,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Orders" component={OrdersScreen} />
      <Tab.Screen name="Menu" component={MenuScreen} />
      <Tab.Screen name="Payments" component={PaymentsScreen} />
      <Tab.Screen name="Promote" component={PromoteScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function InnerApp() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const theme = useTheme();
  const navTheme = useNavTheme();

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem('token');
      const u = await AsyncStorage.getItem('user');
      if (token && u) {
        try {
          setUser(JSON.parse(u));
        } catch {}
      }
      setLoading(false);
    })();
  }, []);

  // Refresh token died (rotated elsewhere / revoked) → drop to login
  useEffect(() => onAuthLost(() => setUser(null)), []);

  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!user ? (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="Main" component={Tabs} />
              <Stack.Screen name="PromoPay" component={PromoPayScreen} options={{ headerShown: true, title: 'Secure Payment' }} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <SnackProvider>
          <InnerApp />
        </SnackProvider>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}

export default App;
