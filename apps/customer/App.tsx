import { useEffect, useState, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { useTheme, Icon } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { io } from 'socket.io-client';
import { BASE_URL, onAuthLost } from './src/services/api';
import { AppThemeProvider, useNavTheme } from './src/theme/ThemeContext';
import { AppText } from './src/components/AppText';

import SplashScreen from './src/screens/Splash';
import LoginScreen from './src/screens/Login';
import RegisterScreen from './src/screens/Register';
import HomeScreen from './src/screens/Home';
import RestaurantScreen from './src/screens/Restaurant';
import CartScreen from './src/screens/Cart';
import CheckoutScreen from './src/screens/Checkout';
import PaymentScreen from './src/screens/Payment';
import OrderTrackingScreen from './src/screens/OrderTracking';
import OrderHistoryScreen from './src/screens/OrderHistory';
import ProfileScreen from './src/screens/Profile';
import { AuthContext, CartContext } from './src/context/AppContext';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, string> = {
  Home: 'home',
  Cart: 'cart',
  Orders: 'package-variant',
  Profile: 'account',
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
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Cart" component={CartScreen} />
      <Tab.Screen name="Orders" component={OrderHistoryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function InnerApp() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<{ restaurantId: string | null; items: any[] }>({ restaurantId: null, items: [] });
  const [readyNoti, setReadyNoti] = useState<any | null>(null);
  const navigationRef = useRef<any>(null);
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const navTheme = useNavTheme();

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem('token');
      const u = await AsyncStorage.getItem('user');
      if (token && u) setUser(JSON.parse(u));
      setLoading(false);
    })();
  }, []);

  // Refresh token died (rotated elsewhere / revoked) → drop to login
  useEffect(() => onAuthLost(() => setUser(null)), []);

  // Global real-time notifications for customer: order received by restaurant is server-side, but customer cares about READY
  useEffect(() => {
    if (!user) return;
    let socket: any;
    (async () => {
      const token = await AsyncStorage.getItem('token');
      socket = io(BASE_URL, { auth: { token }, transports: ['websocket', 'polling'] });
      const customerId = user.id || user._id;
      socket.emit('join:customer', customerId);
      socket.on('order:ready', (order: any) => {
        setReadyNoti(order);
        Alert.alert('Order Ready!', `Order ${order.orderNumber} is READY for pickup — please visit the restaurant.`, [
          { text: 'Track', onPress: () => navigationRef.current?.navigate('OrderTracking', { orderId: order._id }) },
          { text: 'OK' },
        ]);
        // auto-hide banner after 8s
        setTimeout(() => setReadyNoti(null), 8000);
      });
      socket.on('order:paid', (order: any) => {
        Alert.alert('Payment confirmed', `Order ${order.orderNumber} is paid — restaurant will start preparing.`);
      });
      socket.on('order:update', (order: any) => {
        if (order.orderStatus === 'READY') {
          setReadyNoti(order);
          setTimeout(() => setReadyNoti(null), 8000);
        }
      });
    })();
    return () => { socket?.disconnect(); };
  }, [user]);

  // Multi-seller cart: items from different restaurants coexist, stamped
  // with their restaurant. Checkout splits them into one order per seller.
  const addToCart = (restaurantId: string, item: any, restaurantName?: string) => {
    setCart((prev) => {
      const existing = prev.items.find((i: any) => i._id === item._id);
      if (existing) {
        return { ...prev, restaurantId: prev.restaurantId || restaurantId, items: prev.items.map((i: any) => (i._id === item._id ? { ...i, quantity: i.quantity + 1 } : i)) };
      }
      return {
        restaurantId: prev.restaurantId || restaurantId,
        items: [...prev.items, { ...item, quantity: 1, restaurantId, restaurantName: restaurantName || item.restaurantName }],
      };
    });
  };
  const clearCart = () => setCart({ restaurantId: null, items: [] });

  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <CartContext.Provider value={{ cart, addToCart, clearCart, setCart }}>
        <NavigationContainer ref={navigationRef} theme={navTheme}>
          {readyNoti && (
            <TouchableOpacity
              style={{ backgroundColor: '#16A34A', padding: 12, alignItems: 'center', paddingTop: insets.top + 12 }}
              activeOpacity={0.9}
              onPress={() => navigationRef.current?.navigate('OrderTracking', { orderId: readyNoti._id })}
              accessibilityRole="button"
              accessibilityLabel={`Order ${readyNoti.orderNumber} is ready, tap to track`}
            >
              <AppText variant="bodyBold" tone="onPrimary">
                Order {readyNoti.orderNumber} is READY!
              </AppText>
              <AppText variant="caption" tone="onPrimary">
                Tap to track • Please visit restaurant for pickup
              </AppText>
            </TouchableOpacity>
          )}
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {!user ? (
              <>
                <Stack.Screen name="Splash" component={SplashScreen} />
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Register" component={RegisterScreen} />
              </>
            ) : (
              <>
                <Stack.Screen name="Main" component={Tabs} />
                <Stack.Screen name="Restaurant" component={RestaurantScreen} options={{ headerShown: true, title: 'Menu' }} />
                <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ headerShown: true, title: 'Checkout' }} />
                <Stack.Screen name="Payment" component={PaymentScreen} options={{ headerShown: true, title: 'Secure Payment' }} />
                <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} options={{ headerShown: true, title: 'Track Order' }} />
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </CartContext.Provider>
    </AuthContext.Provider>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <InnerApp />
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}

export default App;

// Expo registration — fixes "main has not been registered" when main = App.tsx
import { registerRootComponent } from 'expo';
registerRootComponent(App);
