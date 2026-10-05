import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, ActivityIndicator, Alert, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { io } from 'socket.io-client';
import { BASE_URL } from './src/services/api';

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

function Tabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: '#FF6B35' }}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: () => <Text>🏠</Text> }} />
      <Tab.Screen name="Cart" component={CartScreen} options={{ tabBarIcon: () => <Text>🛒</Text> }} />
      <Tab.Screen name="Orders" component={OrderHistoryScreen} options={{ tabBarIcon: () => <Text>📦</Text> }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: () => <Text>👤</Text> }} />
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

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem('token');
      const u = await AsyncStorage.getItem('user');
      if (token && u) setUser(JSON.parse(u));
      setLoading(false);
    })();
  }, []);

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
        Alert.alert('🎉 Order Ready!', `Order ${order.orderNumber} is READY for pickup — please visit the restaurant.`, [
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

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color="#FF6B35" /></View>;

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <CartContext.Provider value={{ cart, addToCart, clearCart, setCart }}>
        <NavigationContainer ref={navigationRef}>
          {readyNoti && (
            <TouchableOpacity style={[s.readyBanner, { paddingTop: insets.top + 12 }]} activeOpacity={0.9} onPress={() => navigationRef.current?.navigate('OrderTracking', { orderId: readyNoti._id })}>
              <Text style={s.readyTitle}>✅ Order {readyNoti.orderNumber} is READY!</Text>
              <Text style={s.readySub}>Tap to track • Please visit restaurant for pickup</Text>
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

const s = StyleSheet.create({
  readyBanner: { backgroundColor: '#22c55e', padding: 12, alignItems: 'center' },
  readyTitle: { color: 'white', fontWeight: '800', fontSize: 14 },
  readySub: { color: 'white', fontSize: 11, opacity: 0.9, marginTop: 2 },
});

function App() {
  return (
    <SafeAreaProvider>
      <InnerApp />
    </SafeAreaProvider>
  );
}

export default App;

// Expo registration — fixes "main has not been registered" when main = App.tsx
import { registerRootComponent } from 'expo';
registerRootComponent(App);
