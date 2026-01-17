/**
 * Order Detail Screen
 * Phase 4: Orders & Checkout
 */

import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { getOrderById } from '@/lib/orders';
import { getImageUrl } from '@/lib/images';
import { formatPriceIDR } from '@/lib/utils';
import type { OrderWithItems } from '@/lib/types';

const statusOrder = ['pending', 'paid', 'processing', 'shipped', 'delivered'];
const statusLabels: Record<string, string> = {
  pending: 'Pending',
  paid: 'Paid',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

const statusColors: Record<string, string> = {
  pending: '#ff9800',
  paid: '#2196F3',
  processing: '#9c27b0',
  shipped: '#00bcd4',
  delivered: '#4CAF50',
  cancelled: '#9e9e9e',
  refunded: '#f44336',
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (id && user) {
      loadOrder();
    }
  }, [id, user, authLoading]);

  const loadOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getOrderById(id);
      if (!data) {
        setError('Order not found');
        return;
      }
      setOrder(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIndex = (status: string): number => {
    const index = statusOrder.indexOf(status);
    return index >= 0 ? index : -1;
  };

  if (authLoading || loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" />
          <ThemedText style={styles.loadingText}>Loading order...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (error || !order) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <ThemedText type="title" style={styles.title}>Order Details</ThemedText>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.centerContent}>
          <ThemedText style={styles.errorText}>{error || 'Order not found'}</ThemedText>
        </View>
      </ThemedView>
    );
  }

  const currentStatusIndex = getStatusIndex(order.status);
  const isTerminalStatus = ['cancelled', 'refunded'].includes(order.status);

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.title}>Order Details</ThemedText>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Order ID */}
        <View style={styles.orderIdCard}>
          <ThemedText style={styles.orderIdLabel}>Order ID</ThemedText>
          <ThemedText type="defaultSemiBold" style={styles.orderId}>
            {order.id.substring(0, 8).toUpperCase()}...
          </ThemedText>
        </View>

        {/* Status Badge */}
        <View style={styles.statusCard}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusColors[order.status] || '#999' },
            ]}>
            <ThemedText style={styles.statusText}>
              {statusLabels[order.status] || order.status}
            </ThemedText>
          </View>
          <ThemedText style={styles.orderDate}>{formatDate(order.created_at)}</ThemedText>
        </View>

        {/* Status Timeline */}
        {!isTerminalStatus && (
          <View style={styles.timelineCard}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              Order Status
            </ThemedText>
            <View style={styles.timeline}>
              {statusOrder.map((status, index) => {
                const isCompleted = currentStatusIndex >= index;
                const isCurrent = currentStatusIndex === index;
                return (
                  <View key={status} style={styles.timelineStep}>
                    <View style={styles.timelineLine}>
                      {index > 0 && (
                        <View
                          style={[
                            styles.timelineLineSegment,
                            isCompleted && styles.timelineLineCompleted,
                          ]}
                        />
                      )}
                      <View
                        style={[
                          styles.timelineDot,
                          isCompleted && styles.timelineDotCompleted,
                          isCurrent && styles.timelineDotCurrent,
                        ]}>
                        {isCompleted && !isCurrent && (
                          <MaterialIcons name="check" size={12} color="#fff" />
                        )}
                      </View>
                      {index < statusOrder.length - 1 && (
                        <View
                          style={[
                            styles.timelineLineSegment,
                            isCompleted && index < currentStatusIndex && styles.timelineLineCompleted,
                          ]}
                        />
                      )}
                    </View>
                    <ThemedText
                      style={[
                        styles.timelineLabel,
                        isCompleted && styles.timelineLabelCompleted,
                      ]}>
                      {statusLabels[status]}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Shipping Address */}
        {order.address && (
          <View style={styles.sectionCard}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              Shipping Address
            </ThemedText>
            {order.address.label && (
              <ThemedText type="defaultSemiBold" style={styles.addressLabel}>
                {order.address.label}
              </ThemedText>
            )}
            <ThemedText style={styles.addressText}>{order.address.address_line}</ThemedText>
            <ThemedText style={styles.addressText}>
              {[order.address.city, order.address.province, order.address.postal_code]
                .filter(Boolean)
                .join(', ')}
            </ThemedText>
          </View>
        )}

        {/* Order Items */}
        <View style={styles.sectionCard}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Order Items
          </ThemedText>
          {order.items.map((item) => (
            <View key={item.id} style={styles.orderItem}>
              {item.product?.primary_image_path && (
                <Image
                  source={{ uri: getImageUrl(item.product.primary_image_path) }}
                  style={styles.itemImage}
                  contentFit="cover"
                />
              )}
              <View style={styles.itemInfo}>
                <ThemedText type="defaultSemiBold" style={styles.itemName}>
                  {item.product?.name || 'Unknown Product'}
                </ThemedText>
                <ThemedText style={styles.itemQuantity}>Quantity: {item.quantity}</ThemedText>
                <ThemedText style={styles.itemPrice}>
                  {formatPriceIDR(item.unit_final_price_idr)} each
                </ThemedText>
                {item.discount_total_idr > 0 && (
                  <ThemedText style={styles.itemDiscount}>
                    Discount: -{formatPriceIDR(item.discount_total_idr)}
                  </ThemedText>
                )}
              </View>
              <ThemedText type="defaultSemiBold" style={styles.itemTotal}>
                {formatPriceIDR(item.unit_final_price_idr * item.quantity)}
              </ThemedText>
            </View>
          ))}
        </View>

        {/* Price Summary */}
        <View style={styles.sectionCard}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Price Summary
          </ThemedText>
          <View style={styles.summaryRow}>
            <ThemedText>Subtotal</ThemedText>
            <ThemedText>{formatPriceIDR(order.subtotal_idr)}</ThemedText>
          </View>
          {order.discount_total_idr > 0 && (
            <View style={styles.summaryRow}>
              <ThemedText style={styles.discountText}>Discounts</ThemedText>
              <ThemedText style={styles.discountText}>
                -{formatPriceIDR(order.discount_total_idr)}
              </ThemedText>
            </View>
          )}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <ThemedText type="defaultSemiBold">Total</ThemedText>
            <ThemedText type="defaultSemiBold">{formatPriceIDR(order.total_idr)}</ThemedText>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
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
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    opacity: 0.6,
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  orderIdCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  orderIdLabel: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 4,
  },
  orderId: {
    fontSize: 18,
    fontFamily: 'monospace',
  },
  statusCard: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  orderDate: {
    fontSize: 14,
    opacity: 0.6,
  },
  timelineCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: 16,
  },
  timeline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  timelineStep: {
    flex: 1,
    alignItems: 'center',
  },
  timelineLine: {
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
  },
  timelineLineSegment: {
    width: '50%',
    height: 2,
    backgroundColor: '#e0e0e0',
  },
  timelineLineCompleted: {
    backgroundColor: '#4CAF50',
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  timelineDotCompleted: {
    backgroundColor: '#4CAF50',
  },
  timelineDotCurrent: {
    backgroundColor: '#2196F3',
    borderWidth: 3,
  },
  timelineLabel: {
    fontSize: 10,
    textAlign: 'center',
    opacity: 0.6,
    marginTop: 4,
  },
  timelineLabelCompleted: {
    opacity: 1,
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  addressLabel: {
    fontSize: 16,
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 2,
  },
  orderItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
  },
  itemInfo: {
    flex: 1,
    gap: 4,
  },
  itemName: {
    fontSize: 14,
  },
  itemQuantity: {
    fontSize: 12,
    opacity: 0.6,
  },
  itemPrice: {
    fontSize: 12,
    opacity: 0.7,
  },
  itemDiscount: {
    fontSize: 12,
    color: '#4CAF50',
  },
  itemTotal: {
    fontSize: 16,
    alignSelf: 'flex-start',
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
  },
});
