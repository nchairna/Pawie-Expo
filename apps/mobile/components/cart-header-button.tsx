import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { useCart } from '@/contexts/CartContext';

export function CartHeaderButton() {
  const { itemCount } = useCart();

  return (
    <TouchableOpacity
      style={styles.cartButton}
      onPress={() => router.push('/cart' as any)}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <MaterialIcons name="shopping-cart" size={24} color="#000" />
      {itemCount > 0 && (
        <View style={styles.cartBadge}>
          <ThemedText style={styles.cartBadgeText}>
            {itemCount > 99 ? '99+' : itemCount}
          </ThemedText>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cartButton: {
    position: 'relative',
    padding: 8,
  },
  cartBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
