/**
 * Cart Screen - Simple and Reliable
 * Phase 4: Orders & Checkout
 */

import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useCart, CartPricing } from '@/contexts/CartContext';
import { getImageUrl } from '@/lib/images';
import { formatPriceIDR } from '@/lib/utils';

export default function CartScreen() {
  const {
    items,
    isLoading,
    updateQuantity,
    removeItem,
    clearCart,
    getCartPricing,
    refreshCart,
  } = useCart();

  const [pricing, setPricing] = useState<CartPricing | null>(null);
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Load pricing when items change
  useEffect(() => {
    if (items.length > 0) {
      loadPricing();
    } else {
      setPricing(null);
    }
  }, [items]);

  const loadPricing = async () => {
    try {
      setLoadingPricing(true);
      const result = await getCartPricing(false);
      setPricing(result);
    } catch (error) {
      console.error('Failed to load pricing:', error);
    } finally {
      setLoadingPricing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshCart();
    setRefreshing(false);
  };

  // Direct remove - no confirmation for faster UX
  const handleRemove = (productId: string) => {
    removeItem(productId);
  };

  // Quantity change - removes if going to 0
  const handleQuantityChange = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(productId);
    } else {
      updateQuantity(productId, newQuantity);
    }
  };

  const handleClearCart = () => {
    Alert.alert('Clear Cart', 'Remove all items?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => clearCart() },
    ]);
  };

  const handleCheckout = () => {
    if (items.length === 0) {
      Alert.alert('Empty Cart', 'Add items before checkout.');
      return;
    }
    router.push('/checkout');
  };

  // Loading state
  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <ThemedText style={styles.loadingText}>Loading cart...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  // Empty cart
  if (items.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }>
          <MaterialIcons name="shopping-cart" size={64} color="#999" />
          <ThemedText type="title" style={styles.emptyTitle}>
            Your cart is empty
          </ThemedText>
          <ThemedText style={styles.emptyText}>
            Start shopping to add items
          </ThemedText>
          <TouchableOpacity
            style={styles.shopButton}
            onPress={() => router.push('/(tabs)/shop')}>
            <ThemedText style={styles.shopButtonText}>Go Shopping</ThemedText>
          </TouchableOpacity>
        </ScrollView>
      </ThemedView>
    );
  }

  // Cart with items
  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <ThemedText type="title">Shopping Cart</ThemedText>
            <ThemedText style={styles.itemCount}>
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </ThemedText>
          </View>
          <TouchableOpacity onPress={handleClearCart}>
            <ThemedText style={styles.clearText}>Clear All</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Cart Items */}
        {items.map((item) => {
          const itemPricing = pricing?.items.find(
            (p) => p.product_id === item.product_id
          );

          return (
            <View key={item.product_id} style={styles.cartItem}>
              {/* Image */}
              {item.product.primary_image_path ? (
                <Image
                  source={{ uri: getImageUrl(item.product.primary_image_path) }}
                  style={styles.productImage}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.productImage, styles.placeholderImage]}>
                  <MaterialIcons name="image" size={24} color="#ccc" />
                </View>
              )}

              {/* Info */}
              <View style={styles.productInfo}>
                <ThemedText type="defaultSemiBold" numberOfLines={2}>
                  {item.product.name}
                </ThemedText>

                {/* Price */}
                <ThemedText style={styles.price}>
                  {itemPricing
                    ? formatPriceIDR(itemPricing.final_price_idr)
                    : formatPriceIDR(item.product.base_price_idr)}
                </ThemedText>

                {/* Quantity Controls */}
                <View style={styles.quantityRow}>
                  <TouchableOpacity
                    style={styles.qtyButton}
                    onPress={() =>
                      handleQuantityChange(item.product_id, item.quantity - 1)
                    }>
                    <MaterialIcons
                      name={item.quantity === 1 ? 'delete' : 'remove'}
                      size={18}
                      color={item.quantity === 1 ? '#ff4444' : '#333'}
                    />
                  </TouchableOpacity>

                  <ThemedText style={styles.qtyText}>{item.quantity}</ThemedText>

                  <TouchableOpacity
                    style={styles.qtyButton}
                    onPress={() =>
                      handleQuantityChange(item.product_id, item.quantity + 1)
                    }>
                    <MaterialIcons name="add" size={18} color="#333" />
                  </TouchableOpacity>

                  {/* Line Total */}
                  <ThemedText type="defaultSemiBold" style={styles.lineTotal}>
                    {itemPricing ? formatPriceIDR(itemPricing.line_total_idr) : '-'}
                  </ThemedText>
                </View>
              </View>

              {/* Delete Button */}
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleRemove(item.product_id)}>
                <MaterialIcons name="close" size={20} color="#999" />
              </TouchableOpacity>
            </View>
          );
        })}

        {/* Summary */}
        {pricing && (
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <ThemedText>Subtotal</ThemedText>
              <ThemedText>{formatPriceIDR(pricing.subtotal_idr)}</ThemedText>
            </View>
            {pricing.discount_total_idr > 0 && (
              <View style={styles.summaryRow}>
                <ThemedText style={styles.discountText}>Discounts</ThemedText>
                <ThemedText style={styles.discountText}>
                  -{formatPriceIDR(pricing.discount_total_idr)}
                </ThemedText>
              </View>
            )}
            <View style={[styles.summaryRow, styles.totalRow]}>
              <ThemedText type="defaultSemiBold" style={styles.totalText}>
                Total
              </ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.totalText}>
                {formatPriceIDR(pricing.total_idr)}
              </ThemedText>
            </View>
          </View>
        )}

        {/* Continue Shopping */}
        <TouchableOpacity
          style={styles.continueButton}
          onPress={() => router.push('/(tabs)/shop')}>
          <ThemedText style={styles.continueText}>Continue Shopping</ThemedText>
        </TouchableOpacity>
      </ScrollView>

      {/* Checkout Button */}
      <View style={styles.checkoutBar}>
        <TouchableOpacity
          style={[styles.checkoutButton, loadingPricing && styles.disabled]}
          onPress={handleCheckout}
          disabled={loadingPricing}>
          {loadingPricing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <ThemedText style={styles.checkoutText}>Checkout</ThemedText>
              {pricing && (
                <ThemedText style={styles.checkoutPrice}>
                  {formatPriceIDR(pricing.total_idr)}
                </ThemedText>
              )}
            </>
          )}
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    opacity: 0.6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 22,
  },
  emptyText: {
    marginTop: 8,
    opacity: 0.6,
    marginBottom: 24,
  },
  shopButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  shopButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  itemCount: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 2,
  },
  clearText: {
    color: '#ff4444',
    fontSize: 14,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  productImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
  },
  price: {
    color: '#007AFF',
    marginTop: 4,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  qtyButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    marginHorizontal: 12,
    fontWeight: '600',
    minWidth: 20,
    textAlign: 'center',
  },
  lineTotal: {
    marginLeft: 'auto',
    fontSize: 14,
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8,
  },
  summary: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  discountText: {
    color: '#4CAF50',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginBottom: 0,
  },
  totalText: {
    fontSize: 18,
  },
  continueButton: {
    alignItems: 'center',
    padding: 16,
    marginTop: 8,
  },
  continueText: {
    color: '#007AFF',
  },
  checkoutBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  checkoutButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  disabled: {
    opacity: 0.6,
  },
  checkoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  checkoutPrice: {
    color: '#fff',
    fontSize: 16,
    opacity: 0.9,
  },
});
