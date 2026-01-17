import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <CartProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="product/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            <Stack.Screen name="test-supabase" options={{ title: 'Test Supabase Connection' }} />
            <Stack.Screen name="login" options={{ title: 'Sign In', presentation: 'modal' }} />
            <Stack.Screen name="register" options={{ title: 'Sign Up', presentation: 'modal' }} />
            <Stack.Screen name="checkout/index" options={{ title: 'Checkout', presentation: 'modal' }} />
            <Stack.Screen name="cart" options={{ title: 'Cart', presentation: 'modal' }} />
            <Stack.Screen name="addresses/index" options={{ title: 'Addresses' }} />
            <Stack.Screen name="addresses/new" options={{ title: 'New Address' }} />
            <Stack.Screen name="addresses/[id]/edit" options={{ title: 'Edit Address' }} />
            <Stack.Screen name="orders/[id]" options={{ title: 'Order Details' }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </CartProvider>
    </AuthProvider>
  );
}
