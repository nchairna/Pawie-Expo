/**
 * Checkout Flow Screen
 * Phase 4: Orders & Checkout
 *
 * Simplified checkout:
 * 1. Review cart + select/add address
 * 2. Order confirmation
 */

import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Image } from 'expo-image';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { getUserAddresses, createAddress } from '@/lib/addresses';
import { createOrder } from '@/lib/orders';
import { getImageUrl } from '@/lib/images';
import { formatPriceIDR } from '@/lib/utils';
import type { Address, AddressInput } from '@/lib/types';
import type { CartPricing } from '@/contexts/CartContext';

type CheckoutStep = 'checkout' | 'confirmation';

export default function CheckoutScreen() {
  const { user, loading: authLoading } = useAuth();
  const { items, getCartPricing, clearCart } = useCart();

  const [step, setStep] = useState<CheckoutStep>('checkout');
  const [pricing, setPricing] = useState<CartPricing | null>(null);
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  // Inline address form state
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressForm, setAddressForm] = useState<AddressInput>({
    label: '',
    address_line: '',
    city: '',
    province: '',
    postal_code: '',
  });

  // Load pricing and addresses on mount
  useEffect(() => {
    if (items.length > 0) {
      loadPricing();
    }
    if (user) {
      loadAddresses();
    }
  }, [items, user]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      Alert.alert('Sign In Required', 'Please sign in to checkout', [
        { text: 'Cancel', onPress: () => router.back() },
        { text: 'Sign In', onPress: () => router.push('/login') },
      ]);
    }
  }, [user, authLoading]);

  const loadPricing = async () => {
    try {
      setLoadingPricing(true);
      const cartPricing = await getCartPricing(false);
      setPricing(cartPricing);
    } catch (error) {
      console.error('Failed to load pricing:', error);
    } finally {
      setLoadingPricing(false);
    }
  };

  const loadAddresses = async () => {
    try {
      setLoadingAddresses(true);
      const data = await getUserAddresses();
      setAddresses(data);
      // Auto-select first address if only one
      if (data.length === 1) {
        setSelectedAddressId(data[0].id);
      }
      // Show form if no addresses
      if (data.length === 0) {
        setShowAddressForm(true);
      }
    } catch (error: any) {
      console.error('Failed to load addresses:', error);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const validateAddressForm = (): boolean => {
    if (!addressForm.label.trim()) {
      Alert.alert('Required', 'Please enter a label (e.g., Home, Office)');
      return false;
    }
    if (!addressForm.address_line.trim()) {
      Alert.alert('Required', 'Please enter your address');
      return false;
    }
    if (!addressForm.city.trim()) {
      Alert.alert('Required', 'Please enter your city');
      return false;
    }
    if (!addressForm.province.trim()) {
      Alert.alert('Required', 'Please enter your province');
      return false;
    }
    if (!addressForm.postal_code.trim()) {
      Alert.alert('Required', 'Please enter your postal code');
      return false;
    }
    return true;
  };

  const handleSaveAddress = async () => {
    if (!validateAddressForm()) return;

    try {
      setSavingAddress(true);
      const newAddress = await createAddress(addressForm);
      setAddresses((prev) => [newAddress, ...prev]);
      setSelectedAddressId(newAddress.id);
      setShowAddressForm(false);
      setAddressForm({
        label: '',
        address_line: '',
        city: '',
        province: '',
        postal_code: '',
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save address');
    } finally {
      setSavingAddress(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddressId || !pricing || items.length === 0) {
      Alert.alert('Error', 'Please select a shipping address');
      return;
    }

    try {
      setPlacingOrder(true);
      const orderItems = items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
      }));

      const result = await createOrder(orderItems, selectedAddressId);

      if (result.success && result.order_id) {
        setOrderId(result.order_id);
        clearCart();
        setStep('confirmation');
      } else {
        Alert.alert('Order Failed', result.error || 'Failed to place order');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to place order');
    } finally {
      setPlacingOrder(false);
    }
  };

  // Loading state
  if (authLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" />
        </View>
      </ThemedView>
    );
  }

  // Checkout step
  if (step === 'checkout') {
    return (
      <ThemedView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <MaterialIcons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
            <ThemedText type="title" style={styles.title}>Checkout</ThemedText>
            <View style={styles.placeholder} />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled">

            {/* Order Items */}
            <View style={styles.section}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                Order Items ({items.length})
              </ThemedText>
              {items.map((item) => {
                const itemPricing = pricing?.items.find((p) => p.product_id === item.product_id);
                return (
                  <View key={item.product_id} style={styles.cartItem}>
                    {item.product.primary_image_path && (
                      <Image
                        source={{ uri: getImageUrl(item.product.primary_image_path) }}
                        style={styles.productImage}
                        contentFit="cover"
                      />
                    )}
                    <View style={styles.productInfo}>
                      <ThemedText type="defaultSemiBold" numberOfLines={2}>
                        {item.product.name}
                      </ThemedText>
                      <ThemedText style={styles.quantityText}>Qty: {item.quantity}</ThemedText>
                    </View>
                    <ThemedText type="defaultSemiBold">
                      {itemPricing ? formatPriceIDR(itemPricing.line_total_idr) : '-'}
                    </ThemedText>
                  </View>
                );
              })}
            </View>

            {/* Price Summary */}
            {pricing && (
              <View style={styles.summaryCard}>
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
                  <ThemedText type="defaultSemiBold" style={styles.totalLabel}>Total</ThemedText>
                  <ThemedText type="defaultSemiBold" style={styles.totalValue}>
                    {formatPriceIDR(pricing.total_idr)}
                  </ThemedText>
                </View>
              </View>
            )}

            {/* Shipping Address Section */}
            <View style={styles.section}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                Shipping Address
              </ThemedText>

              {loadingAddresses ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" />
                  <ThemedText style={styles.loadingText}>Loading addresses...</ThemedText>
                </View>
              ) : (
                <>
                  {/* Address List */}
                  {addresses.length > 0 && !showAddressForm && (
                    <View style={styles.addressList}>
                      {addresses.map((address) => (
                        <TouchableOpacity
                          key={address.id}
                          style={[
                            styles.addressCard,
                            selectedAddressId === address.id && styles.addressCardSelected,
                          ]}
                          onPress={() => setSelectedAddressId(address.id)}>
                          <View style={styles.radioContainer}>
                            <View
                              style={[
                                styles.radio,
                                selectedAddressId === address.id && styles.radioSelected,
                              ]}>
                              {selectedAddressId === address.id && (
                                <View style={styles.radioInner} />
                              )}
                            </View>
                          </View>
                          <View style={styles.addressContent}>
                            {address.label && (
                              <ThemedText type="defaultSemiBold">{address.label}</ThemedText>
                            )}
                            <ThemedText style={styles.addressText}>{address.address_line}</ThemedText>
                            <ThemedText style={styles.addressText}>
                              {[address.city, address.province, address.postal_code]
                                .filter(Boolean)
                                .join(', ')}
                            </ThemedText>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Add Address Button / Form Toggle */}
                  {!showAddressForm && (
                    <TouchableOpacity
                      style={styles.addAddressButton}
                      onPress={() => setShowAddressForm(true)}>
                      <MaterialIcons name="add" size={20} color="#007AFF" />
                      <ThemedText style={styles.addAddressText}>
                        {addresses.length === 0 ? 'Add Shipping Address' : 'Add New Address'}
                      </ThemedText>
                    </TouchableOpacity>
                  )}

                  {/* Inline Address Form */}
                  {showAddressForm && (
                    <View style={styles.addressForm}>
                      <View style={styles.formHeader}>
                        <ThemedText type="defaultSemiBold">New Address</ThemedText>
                        {addresses.length > 0 && (
                          <TouchableOpacity onPress={() => setShowAddressForm(false)}>
                            <ThemedText style={styles.cancelText}>Cancel</ThemedText>
                          </TouchableOpacity>
                        )}
                      </View>

                      <TextInput
                        style={styles.input}
                        placeholder="Label (e.g., Home, Office)"
                        placeholderTextColor="#999"
                        value={addressForm.label}
                        onChangeText={(text) => setAddressForm({ ...addressForm, label: text })}
                      />
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Street address"
                        placeholderTextColor="#999"
                        value={addressForm.address_line}
                        onChangeText={(text) => setAddressForm({ ...addressForm, address_line: text })}
                        multiline
                        numberOfLines={2}
                      />
                      <View style={styles.formRow}>
                        <TextInput
                          style={[styles.input, styles.halfInput]}
                          placeholder="City"
                          placeholderTextColor="#999"
                          value={addressForm.city}
                          onChangeText={(text) => setAddressForm({ ...addressForm, city: text })}
                        />
                        <TextInput
                          style={[styles.input, styles.halfInput]}
                          placeholder="Province"
                          placeholderTextColor="#999"
                          value={addressForm.province}
                          onChangeText={(text) => setAddressForm({ ...addressForm, province: text })}
                        />
                      </View>
                      <TextInput
                        style={styles.input}
                        placeholder="Postal Code"
                        placeholderTextColor="#999"
                        value={addressForm.postal_code}
                        onChangeText={(text) => setAddressForm({ ...addressForm, postal_code: text })}
                        keyboardType="numeric"
                      />
                      <TouchableOpacity
                        style={[styles.saveAddressButton, savingAddress && styles.buttonDisabled]}
                        onPress={handleSaveAddress}
                        disabled={savingAddress}>
                        {savingAddress ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <ThemedText style={styles.saveAddressText}>Save Address</ThemedText>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </View>

            {/* Payment Notice */}
            <View style={styles.noticeCard}>
              <MaterialIcons name="info-outline" size={20} color="#ff9800" />
              <ThemedText style={styles.noticeText}>
                Orders are placed with pending status. We will contact you for payment.
              </ThemedText>
            </View>
          </ScrollView>

          {/* Place Order Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.placeOrderButton,
                (!selectedAddressId || placingOrder || loadingPricing) && styles.buttonDisabled,
              ]}
              onPress={handlePlaceOrder}
              disabled={!selectedAddressId || placingOrder || loadingPricing}>
              {placingOrder ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <ThemedText style={styles.placeOrderText}>Place Order</ThemedText>
                  {pricing && (
                    <ThemedText style={styles.placeOrderPrice}>
                      {formatPriceIDR(pricing.total_idr)}
                    </ThemedText>
                  )}
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </ThemedView>
    );
  }

  // Confirmation step
  if (step === 'confirmation' && orderId) {
    return (
      <ThemedView style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.confirmationContent}>
          <View style={styles.successIcon}>
            <MaterialIcons name="check-circle" size={80} color="#4CAF50" />
          </View>
          <ThemedText type="title" style={styles.successTitle}>Order Placed!</ThemedText>
          <ThemedText style={styles.successMessage}>
            Thank you for your order. We will contact you for payment instructions.
          </ThemedText>

          <View style={styles.orderIdCard}>
            <ThemedText style={styles.orderIdLabel}>Order ID</ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.orderIdValue}>
              {orderId.substring(0, 8).toUpperCase()}
            </ThemedText>
          </View>

          {pricing && (
            <View style={styles.orderIdCard}>
              <ThemedText style={styles.orderIdLabel}>Total</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.orderIdValue}>
                {formatPriceIDR(pricing.total_idr)}
              </ThemedText>
            </View>
          )}

          <TouchableOpacity
            style={styles.viewOrderButton}
            onPress={() => router.push(`/orders/${orderId}` as any)}>
            <ThemedText style={styles.viewOrderText}>View Order Details</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.continueShoppingButton}
            onPress={() => router.replace('/(tabs)/shop')}>
            <ThemedText style={styles.continueShoppingText}>Continue Shopping</ThemedText>
          </TouchableOpacity>
        </ScrollView>
      </ThemedView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: 12,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  productImage: {
    width: 50,
    height: 50,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
  },
  productInfo: {
    flex: 1,
    gap: 2,
  },
  quantityText: {
    fontSize: 13,
    opacity: 0.6,
  },
  summaryCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  discountText: {
    color: '#4CAF50',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  totalLabel: {
    fontSize: 16,
  },
  totalValue: {
    fontSize: 16,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
  },
  loadingText: {
    opacity: 0.6,
  },
  addressList: {
    gap: 8,
    marginBottom: 12,
  },
  addressCard: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    alignItems: 'center',
  },
  addressCardSelected: {
    borderWidth: 2,
    borderColor: '#007AFF',
    backgroundColor: '#e3f2fd',
  },
  radioContainer: {
    padding: 4,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: '#007AFF',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
  addressContent: {
    flex: 1,
    gap: 2,
  },
  addressText: {
    fontSize: 13,
    opacity: 0.7,
  },
  addAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  addAddressText: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '500',
  },
  addressForm: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cancelText: {
    color: '#007AFF',
    fontSize: 14,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  saveAddressButton: {
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  saveAddressText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  noticeCard: {
    flexDirection: 'row',
    backgroundColor: '#fff8e1',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    alignItems: 'center',
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: '#795548',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  placeOrderButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  placeOrderText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  placeOrderPrice: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.9,
  },
  confirmationContent: {
    flex: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIcon: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  orderIdCard: {
    width: '100%',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  orderIdLabel: {
    fontSize: 13,
    opacity: 0.6,
    marginBottom: 4,
  },
  orderIdValue: {
    fontSize: 20,
  },
  viewOrderButton: {
    width: '100%',
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  viewOrderText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  continueShoppingButton: {
    width: '100%',
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  continueShoppingText: {
    color: '#007AFF',
    fontSize: 16,
  },
});
