/**
 * Checkout Flow Screen
 * Phase 5: Checkout with Autoship Enrollment (Chewy-style)
 *
 * Flow:
 * 1. Review cart + autoship enrollment + select/add address
 * 2. Order confirmation + subscription confirmation
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
  Modal,
  Pressable,
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
import { createAutoshipWithOrder } from '@/lib/autoships';
import { getImageUrl } from '@/lib/images';
import { formatPriceIDR } from '@/lib/utils';
import type { Address, AddressInput } from '@/lib/types';
import type { CartPricing } from '@/contexts/CartContext';

type CheckoutStep = 'checkout' | 'confirmation';

// Chewy-style frequency options
const FREQUENCY_OPTIONS = [
  { value: 1, label: 'Every week' },
  { value: 2, label: 'Every 2 weeks' },
  { value: 3, label: 'Every 3 weeks' },
  { value: 4, label: 'Every 4 weeks' },
  { value: 5, label: 'Every 5 weeks' },
  { value: 6, label: 'Every 6 weeks' },
  { value: 7, label: 'Every 7 weeks' },
  { value: 8, label: 'Every 8 weeks' },
  { value: 10, label: 'Every 10 weeks' },
  { value: 12, label: 'Every 12 weeks' },
  { value: 16, label: 'Every 16 weeks' },
  { value: 20, label: 'Every 20 weeks' },
  { value: 24, label: 'Every 24 weeks' },
];

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

  // Autoship enrollment state
  const [autoshipSelections, setAutoshipSelections] = useState<Record<string, {
    enabled: boolean;
    frequency: number;
  }>>({});

  // Frequency picker state
  const [showFrequencyPicker, setShowFrequencyPicker] = useState<string | null>(null);

  // Autoship results for confirmation screen
  const [autoshipResults, setAutoshipResults] = useState<Array<{
    product_name: string;
    frequency: number;
    next_run_at: string;
    order_id: string;
  }>>([]);

  // Load pricing and addresses on mount
  useEffect(() => {
    if (items.length > 0) {
      loadPricing();
    }
    if (user) {
      loadAddresses();
    }
  }, [items, user]);

  // Initialize autoship selections for eligible products
  useEffect(() => {
    const selections: Record<string, { enabled: boolean; frequency: number }> = {};
    items.forEach(item => {
      if (item.product.autoship_eligible) {
        if (!(item.product_id in autoshipSelections)) {
          selections[item.product_id] = {
            enabled: false,
            frequency: 4, // Default to 4 weeks
          };
        }
      }
    });
    if (Object.keys(selections).length > 0) {
      setAutoshipSelections(prev => ({ ...prev, ...selections }));
    }
  }, [items]);

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
      if (data.length === 1) {
        setSelectedAddressId(data[0].id);
      }
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

  // Calculate autoship savings (assuming 10% discount)
  const calculateAutoshipSavings = (basePrice: number): {
    autoshipPrice: number;
    savings: number;
    percentage: number;
  } => {
    const discountPercentage = 10;
    const savings = Math.round(basePrice * (discountPercentage / 100));
    const autoshipPrice = basePrice - savings;
    return {
      autoshipPrice,
      savings,
      percentage: discountPercentage,
    };
  };

  // Get today's order total (including autoship discounts)
  const getTodaysOrderTotal = (): number => {
    return items.reduce((total, item) => {
      const selection = autoshipSelections[item.product_id];
      const isAutoship = item.product.autoship_eligible && selection?.enabled;

      if (isAutoship) {
        const { autoshipPrice } = calculateAutoshipSavings(item.product.base_price_idr);
        return total + (autoshipPrice * item.quantity);
      } else {
        return total + (item.product.base_price_idr * item.quantity);
      }
    }, 0);
  };

  // Get total autoship savings
  const getTotalAutoshipSavings = (): number => {
    return items.reduce((total, item) => {
      const selection = autoshipSelections[item.product_id];
      const isAutoship = item.product.autoship_eligible && selection?.enabled;

      if (isAutoship) {
        const { savings } = calculateAutoshipSavings(item.product.base_price_idr);
        return total + (savings * item.quantity);
      }
      return total;
    }, 0);
  };

  // Format next delivery date
  const formatNextDeliveryDate = (frequencyWeeks: number): string => {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + (frequencyWeeks * 7));
    return nextDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddressId || items.length === 0) {
      Alert.alert('Error', 'Please select a shipping address');
      return;
    }

    try {
      setPlacingOrder(true);

      // Separate items into autoship and one-time
      const autoshipItems: Array<{
        product_id: string;
        quantity: number;
        frequency: number;
        product_name: string;
      }> = [];
      const oneTimeItems: Array<{ product_id: string; quantity: number }> = [];

      items.forEach(item => {
        const selection = autoshipSelections[item.product_id];
        if (item.product.autoship_eligible && selection?.enabled) {
          autoshipItems.push({
            product_id: item.product_id,
            quantity: item.quantity,
            frequency: selection.frequency,
            product_name: item.product.name,
          });
        } else {
          oneTimeItems.push({
            product_id: item.product_id,
            quantity: item.quantity,
          });
        }
      });

      const results = {
        autoshipOrders: [] as Array<{
          product_name: string;
          order_id: string;
          autoship_id: string;
          next_run_at: string;
          frequency: number;
        }>,
        autoshipErrors: [] as string[],
        oneTimeOrderCreated: false,
        oneTimeOrderId: null as string | null,
        oneTimeOrderError: null as string | null,
      };

      // Process autoship items - each creates subscription + immediate order
      for (const autoshipItem of autoshipItems) {
        try {
          console.log('[Checkout] Creating autoship for:', autoshipItem.product_name, {
            productId: autoshipItem.product_id,
            quantity: autoshipItem.quantity,
            frequency: autoshipItem.frequency,
            addressId: selectedAddressId,
          });

          const result = await createAutoshipWithOrder({
            productId: autoshipItem.product_id,
            quantity: autoshipItem.quantity,
            frequencyWeeks: autoshipItem.frequency,
            addressId: selectedAddressId,
          });

          console.log('[Checkout] Autoship result:', JSON.stringify(result, null, 2));

          if (result.success && result.order_id && result.autoship_id) {
            results.autoshipOrders.push({
              product_name: autoshipItem.product_name,
              order_id: result.order_id,
              autoship_id: result.autoship_id,
              next_run_at: result.next_run_at || '',
              frequency: autoshipItem.frequency,
            });
            console.log('[Checkout] Autoship created successfully for:', autoshipItem.product_name);
          } else {
            const errorMsg = result.error 
              ? `${result.error}: ${result.message || 'Failed to create subscription'}`
              : result.message || 'Failed to create subscription';
            console.error('[Checkout] Autoship creation failed:', errorMsg, result);
            results.autoshipErrors.push(
              `${autoshipItem.product_name}: ${errorMsg}`
            );
          }
        } catch (error: any) {
          console.error('[Checkout] Exception creating autoship:', error);
          results.autoshipErrors.push(
            `${autoshipItem.product_name}: ${error.message || 'Error creating subscription'}`
          );
        }
      }

      // Process one-time items (if any)
      if (oneTimeItems.length > 0) {
        try {
          const orderResult = await createOrder(oneTimeItems, selectedAddressId);
          if (orderResult.success && orderResult.order_id) {
            results.oneTimeOrderCreated = true;
            results.oneTimeOrderId = orderResult.order_id;
          } else {
            results.oneTimeOrderError = orderResult.error || 'Failed to create order';
          }
        } catch (error: any) {
          results.oneTimeOrderError = error.message || 'Failed to create order';
        }
      }

      // Determine overall success
      const hasAutoshipSuccess = results.autoshipOrders.length > 0;
      const hasOneTimeSuccess = results.oneTimeOrderCreated || oneTimeItems.length === 0;
      const hasErrors = results.autoshipErrors.length > 0 || results.oneTimeOrderError;
      const hasAnySuccess = hasAutoshipSuccess || results.oneTimeOrderCreated;

      if (!hasAnySuccess) {
        // Complete failure
        const errorMessages = [
          ...results.autoshipErrors,
          ...(results.oneTimeOrderError ? [results.oneTimeOrderError] : []),
        ];
        
        // Check if any errors are inventory-related
        const hasInventoryError = errorMessages.some(msg => 
          msg.includes('INSUFFICIENT_INVENTORY') || 
          msg.includes('insufficient inventory') ||
          msg.toLowerCase().includes('inventory')
        );
        
        if (hasInventoryError) {
          Alert.alert(
            'Checkout Failed - Insufficient Inventory',
            `${errorMessages.join('\n')}\n\nPlease contact support or try again later.`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('Checkout Failed', errorMessages.join('\n'));
        }
      } else if (hasErrors) {
        // Partial success - show warning but proceed
        const errorMessages = [
          ...results.autoshipErrors,
          ...(results.oneTimeOrderError ? [results.oneTimeOrderError] : []),
        ];

        Alert.alert(
          'Partial Success',
          `Some items were processed successfully, but there were errors:\n\n${errorMessages.join('\n')}`,
          [{ text: 'Continue', onPress: () => proceedToConfirmation(results) }]
        );
      } else {
        // Complete success
        proceedToConfirmation(results);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to complete checkout');
    } finally {
      setPlacingOrder(false);
    }
  };

  const proceedToConfirmation = (results: {
    autoshipOrders: Array<{
      product_name: string;
      order_id: string;
      autoship_id: string;
      next_run_at: string;
      frequency: number;
    }>;
    oneTimeOrderCreated: boolean;
    oneTimeOrderId: string | null;
  }) => {
    // Store autoship results for confirmation screen
    setAutoshipResults(results.autoshipOrders.map(order => ({
      product_name: order.product_name,
      frequency: order.frequency,
      next_run_at: order.next_run_at,
      order_id: order.order_id,
    })));

    // Set order ID (use first autoship order ID if no one-time order)
    const mainOrderId = results.oneTimeOrderId || results.autoshipOrders[0]?.order_id;
    if (mainOrderId) {
      setOrderId(mainOrderId);
    }

    // Clear cart and show confirmation
    clearCart();
    setStep('confirmation');
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

            {/* Order Items with Autoship Options */}
            <View style={styles.section}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                Order Items ({items.length})
              </ThemedText>
              {items.map((item) => {
                const isAutoshipEligible = item.product.autoship_eligible ?? false;
                const selection = autoshipSelections[item.product_id];
                const isAutoship = isAutoshipEligible && selection?.enabled;
                const { autoshipPrice, savings, percentage } = calculateAutoshipSavings(item.product.base_price_idr);

                const displayPrice = isAutoship ? autoshipPrice : item.product.base_price_idr;
                const lineTotal = displayPrice * item.quantity;

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

                      {/* Autoship Toggle - Only for eligible products */}
                      {isAutoshipEligible && (
                        <View style={styles.autoshipSection}>
                          {/* Subscribe & Save Toggle */}
                          <TouchableOpacity
                            style={styles.autoshipToggle}
                            onPress={() => {
                              setAutoshipSelections(prev => ({
                                ...prev,
                                [item.product_id]: {
                                  enabled: !prev[item.product_id]?.enabled,
                                  frequency: prev[item.product_id]?.frequency || 4,
                                }
                              }));
                            }}
                          >
                            <View style={[styles.checkbox, isAutoship && styles.checkboxChecked]}>
                              {isAutoship && <MaterialIcons name="check" size={14} color="#fff" />}
                            </View>
                            <View style={styles.toggleTextContainer}>
                              <ThemedText style={[styles.toggleLabel, isAutoship && styles.toggleLabelActive]}>
                                Subscribe & Save {percentage}%
                              </ThemedText>
                              {!isAutoship && (
                                <ThemedText style={styles.toggleHint}>
                                  {formatPriceIDR(autoshipPrice)}/delivery
                                </ThemedText>
                              )}
                            </View>
                          </TouchableOpacity>

                          {/* Frequency Selector - Only when autoship is enabled */}
                          {isAutoship && selection && (
                            <View style={styles.frequencyContainer}>
                              <ThemedText style={styles.frequencyLabel}>Deliver:</ThemedText>

                              <TouchableOpacity
                                style={styles.frequencyDropdown}
                                onPress={() => setShowFrequencyPicker(item.product_id)}
                              >
                                <ThemedText style={styles.frequencyDropdownText}>
                                  {FREQUENCY_OPTIONS.find(opt => opt.value === selection.frequency)?.label || 'Every 4 weeks'}
                                </ThemedText>
                                <MaterialIcons name="keyboard-arrow-down" size={20} color="#666" />
                              </TouchableOpacity>

                              <ThemedText style={styles.nextDeliveryText}>
                                Next delivery: {formatNextDeliveryDate(selection.frequency)}
                              </ThemedText>
                            </View>
                          )}

                          {/* Savings callout when enabled */}
                          {isAutoship && (
                            <View style={styles.savingsCallout}>
                              <MaterialIcons name="local-offer" size={14} color="#4CAF50" />
                              <ThemedText style={styles.savingsText}>
                                You save {formatPriceIDR(savings * item.quantity)} on this item
                              </ThemedText>
                            </View>
                          )}
                        </View>
                      )}
                    </View>

                    {/* Price Display */}
                    <View style={styles.priceContainer}>
                      {isAutoship && (
                        <ThemedText style={styles.originalPrice}>
                          {formatPriceIDR(item.product.base_price_idr * item.quantity)}
                        </ThemedText>
                      )}
                      <ThemedText type="defaultSemiBold" style={isAutoship ? styles.autoshipPrice : undefined}>
                        {formatPriceIDR(lineTotal)}
                      </ThemedText>
                      {isAutoship && (
                        <View style={styles.autoshipBadge}>
                          <ThemedText style={styles.autoshipBadgeText}>Autoship</ThemedText>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Order Summary */}
            <View style={styles.summaryCard}>
              <ThemedText type="subtitle" style={styles.summaryTitle}>Order Summary</ThemedText>

              <View style={styles.summarySection}>
                <View style={styles.summaryRow}>
                  <ThemedText>Subtotal ({items.length} items)</ThemedText>
                  <ThemedText>{formatPriceIDR(getTodaysOrderTotal())}</ThemedText>
                </View>

                {getTotalAutoshipSavings() > 0 && (
                  <View style={styles.summaryRow}>
                    <ThemedText style={styles.savingsLabel}>Autoship Savings</ThemedText>
                    <ThemedText style={styles.savingsValue}>
                      -{formatPriceIDR(getTotalAutoshipSavings())}
                    </ThemedText>
                  </View>
                )}

                <View style={styles.summaryRow}>
                  <ThemedText>Shipping</ThemedText>
                  <ThemedText style={styles.freeShipping}>FREE</ThemedText>
                </View>

                <View style={[styles.summaryRow, styles.totalRow]}>
                  <ThemedText type="defaultSemiBold" style={styles.totalLabel}>
                    Today's Total
                  </ThemedText>
                  <ThemedText type="defaultSemiBold" style={styles.totalValue}>
                    {formatPriceIDR(getTodaysOrderTotal())}
                  </ThemedText>
                </View>
              </View>

              {/* Future Deliveries Summary */}
              {items.some(item => autoshipSelections[item.product_id]?.enabled) && (
                <View style={styles.futureDeliveriesSection}>
                  <ThemedText type="subtitle" style={styles.futureDeliveriesTitle}>
                    Your Subscriptions
                  </ThemedText>
                  {items
                    .filter(item => autoshipSelections[item.product_id]?.enabled)
                    .map(item => {
                      const selection = autoshipSelections[item.product_id];
                      const { autoshipPrice } = calculateAutoshipSavings(item.product.base_price_idr);
                      return (
                        <View key={item.product_id} style={styles.futureDeliveryItem}>
                          <View style={styles.futureDeliveryInfo}>
                            <ThemedText numberOfLines={1} style={styles.futureDeliveryName}>
                              {item.product.name}
                            </ThemedText>
                            <ThemedText style={styles.futureDeliverySchedule}>
                              Every {selection.frequency} weeks - {formatPriceIDR(autoshipPrice * item.quantity)}
                            </ThemedText>
                          </View>
                          <ThemedText style={styles.futureDeliveryDate}>
                            Next: {formatNextDeliveryDate(selection.frequency)}
                          </ThemedText>
                        </View>
                      );
                    })}
                </View>
              )}
            </View>

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
                <ThemedText style={styles.placeOrderText}>
                  {items.some(item => autoshipSelections[item.product_id]?.enabled)
                    ? 'Place Order & Start Subscriptions'
                    : 'Place Order'}
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* Frequency Picker Modal */}
        {showFrequencyPicker && (
          <Modal
            visible={true}
            transparent
            animationType="slide"
            onRequestClose={() => setShowFrequencyPicker(null)}
          >
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setShowFrequencyPicker(null)}
            >
              <View style={styles.frequencyPickerContainer}>
                <View style={styles.frequencyPickerHeader}>
                  <ThemedText type="subtitle">Delivery Frequency</ThemedText>
                  <TouchableOpacity onPress={() => setShowFrequencyPicker(null)}>
                    <MaterialIcons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.frequencyPickerList}>
                  {FREQUENCY_OPTIONS.map(option => {
                    const isSelected = autoshipSelections[showFrequencyPicker]?.frequency === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.frequencyPickerOption,
                          isSelected && styles.frequencyPickerOptionSelected
                        ]}
                        onPress={() => {
                          setAutoshipSelections(prev => ({
                            ...prev,
                            [showFrequencyPicker]: {
                              ...prev[showFrequencyPicker],
                              frequency: option.value,
                            }
                          }));
                          setShowFrequencyPicker(null);
                        }}
                      >
                        <ThemedText style={[
                          styles.frequencyPickerOptionText,
                          isSelected && styles.frequencyPickerOptionTextSelected
                        ]}>
                          {option.label}
                        </ThemedText>
                        {isSelected && (
                          <MaterialIcons name="check" size={20} color="#007AFF" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </Pressable>
          </Modal>
        )}
      </ThemedView>
    );
  }

  // Confirmation step
  if (step === 'confirmation') {
    return (
      <ThemedView style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.confirmationContainer}>
          {/* Success Icon */}
          <View style={styles.confirmationHeader}>
            <View style={styles.successIconContainer}>
              <MaterialIcons name="check-circle" size={64} color="#4CAF50" />
            </View>
            <ThemedText type="title" style={styles.confirmationTitle}>
              Order Placed!
            </ThemedText>
            <ThemedText style={styles.confirmationSubtitle}>
              Thank you for your order
            </ThemedText>
          </View>

          {/* Order Summary Card */}
          <View style={styles.confirmationCard}>
            <ThemedText type="subtitle">Order Details</ThemedText>
            {orderId && (
              <ThemedText style={styles.orderIdText}>
                Order #{orderId.slice(0, 8).toUpperCase()}
              </ThemedText>
            )}
            <ThemedText style={styles.confirmationNote}>
              You'll receive a confirmation email shortly.
            </ThemedText>
          </View>

          {/* Subscriptions Created */}
          {autoshipResults.length > 0 && (
            <View style={styles.confirmationCard}>
              <View style={styles.subscriptionHeader}>
                <MaterialIcons name="autorenew" size={24} color="#007AFF" />
                <ThemedText type="subtitle" style={styles.subscriptionTitle}>
                  Subscriptions Created
                </ThemedText>
              </View>

              <ThemedText style={styles.subscriptionNote}>
                Your first delivery is on its way! Future deliveries are scheduled below:
              </ThemedText>

              {autoshipResults.map((result, index) => (
                <View key={index} style={styles.subscriptionItem}>
                  <ThemedText style={styles.subscriptionProductName}>
                    {result.product_name}
                  </ThemedText>
                  <View style={styles.subscriptionDetails}>
                    <ThemedText style={styles.subscriptionFrequency}>
                      Every {result.frequency} weeks
                    </ThemedText>
                    {result.next_run_at && (
                      <ThemedText style={styles.subscriptionNextDate}>
                        Next delivery: {new Date(result.next_run_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </ThemedText>
                    )}
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={styles.manageSubscriptionsButton}
                onPress={() => router.push('/(tabs)/orders')}
              >
                <ThemedText style={styles.manageSubscriptionsText}>
                  Manage Subscriptions
                </ThemedText>
                <MaterialIcons name="chevron-right" size={20} color="#007AFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.confirmationActions}>
            <TouchableOpacity
              style={styles.viewOrderButton}
              onPress={() => {
                if (orderId) {
                  router.push(`/orders/${orderId}` as any);
                } else {
                  router.push('/(tabs)/orders');
                }
              }}
            >
              <ThemedText style={styles.viewOrderButtonText}>View Order</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.continueShoppingButton}
              onPress={() => router.push('/(tabs)')}
            >
              <ThemedText style={styles.continueShoppingText}>Continue Shopping</ThemedText>
            </TouchableOpacity>
          </View>
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
    alignItems: 'flex-start',
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

  // Autoship Section Styles
  autoshipSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  autoshipToggle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 4,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
  },
  toggleTextContainer: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  toggleLabelActive: {
    color: '#007AFF',
  },
  toggleHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },

  // Frequency Selector
  frequencyContainer: {
    marginTop: 12,
    marginLeft: 32,
  },
  frequencyLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  frequencyDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  frequencyDropdownText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  nextDeliveryText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },

  // Frequency Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  frequencyPickerContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
  },
  frequencyPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  frequencyPickerList: {
    paddingHorizontal: 16,
    paddingBottom: 34,
  },
  frequencyPickerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  frequencyPickerOptionSelected: {
    backgroundColor: '#F0F8FF',
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  frequencyPickerOptionText: {
    fontSize: 16,
    color: '#333',
  },
  frequencyPickerOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },

  // Savings Callout
  savingsCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginLeft: 32,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  savingsText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '500',
  },

  // Price Container
  priceContainer: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    minWidth: 90,
  },
  originalPrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  autoshipPrice: {
    color: '#007AFF',
  },
  autoshipBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 4,
  },
  autoshipBadgeText: {
    fontSize: 10,
    color: '#007AFF',
    fontWeight: '600',
  },

  // Summary Styles
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  summaryTitle: {
    marginBottom: 16,
  },
  summarySection: {
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
  },
  totalValue: {
    fontSize: 18,
    color: '#007AFF',
  },
  savingsLabel: {
    color: '#4CAF50',
  },
  savingsValue: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  freeShipping: {
    color: '#4CAF50',
    fontWeight: '500',
  },

  // Future Deliveries
  futureDeliveriesSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  futureDeliveriesTitle: {
    marginBottom: 12,
    color: '#007AFF',
  },
  futureDeliveryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  futureDeliveryInfo: {
    flex: 1,
  },
  futureDeliveryName: {
    fontSize: 13,
    fontWeight: '500',
  },
  futureDeliverySchedule: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  futureDeliveryDate: {
    fontSize: 11,
    color: '#007AFF',
  },

  // Address Section (keeping existing styles)
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
    marginBottom: 16,
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

  // Confirmation Styles
  confirmationContainer: {
    padding: 20,
  },
  confirmationHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  successIconContainer: {
    marginBottom: 16,
  },
  confirmationTitle: {
    marginBottom: 8,
  },
  confirmationSubtitle: {
    color: '#666',
  },
  confirmationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  orderIdText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  confirmationNote: {
    fontSize: 13,
    color: '#999',
    marginTop: 8,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  subscriptionTitle: {
    color: '#007AFF',
  },
  subscriptionNote: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
  },
  subscriptionItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  subscriptionProductName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  subscriptionDetails: {
    gap: 2,
  },
  subscriptionFrequency: {
    fontSize: 13,
    color: '#666',
  },
  subscriptionNextDate: {
    fontSize: 12,
    color: '#007AFF',
  },
  manageSubscriptionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  manageSubscriptionsText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  confirmationActions: {
    gap: 12,
    marginTop: 8,
  },
  viewOrderButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  viewOrderButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  continueShoppingButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueShoppingText: {
    color: '#007AFF',
    fontWeight: '600',
  },
});
