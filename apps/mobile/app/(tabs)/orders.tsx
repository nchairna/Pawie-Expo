/**
 * Orders Screen with Tabs (Order History & Autoships)
 * Phase 5: Autoship System
 */

import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CartHeaderButton } from '@/components/cart-header-button';
import { useAuth } from '@/contexts/AuthContext';
import { getUserOrders } from '@/lib/orders';
import { getUserAutoships } from '@/lib/autoships';
import { formatPriceIDR } from '@/lib/utils';
import type { Order, Autoship } from '@/lib/types';

type Tab = 'orders' | 'autoships';

const statusColors: Record<string, string> = {
  pending: '#ff9800',
  paid: '#2196F3',
  processing: '#9c27b0',
  shipped: '#00bcd4',
  delivered: '#4CAF50',
  cancelled: '#9e9e9e',
  refunded: '#f44336',
};

const autoshipStatusColors: Record<string, string> = {
  active: '#4CAF50',
  paused: '#ff9800',
  cancelled: '#9e9e9e',
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncateOrderId(orderId: string): string {
  return orderId.substring(0, 8).toUpperCase();
}

function formatFrequency(weeks: number): string {
  if (weeks === 1) return 'Weekly';
  if (weeks === 2) return 'Every 2 weeks';
  return `Every ${weeks} weeks`;
}

export default function OrdersScreen() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('orders');

  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersRefreshing, setOrdersRefreshing] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  // Autoships state
  const [autoships, setAutoships] = useState<Autoship[]>([]);
  const [autoshipsLoading, setAutoshipsLoading] = useState(true);
  const [autoshipsRefreshing, setAutoshipsRefreshing] = useState(false);
  const [autoshipsError, setAutoshipsError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (user) {
      loadOrders();
      loadAutoships();
    }
  }, [user, authLoading]);

  const loadOrders = async () => {
    try {
      setOrdersLoading(true);
      setOrdersError(null);
      const data = await getUserOrders({ limit: 50 });
      setOrders(data);
    } catch (error: any) {
      console.error('Failed to load orders:', error);
      setOrdersError(error?.message || 'Failed to load orders');
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  };

  const loadAutoships = async () => {
    try {
      setAutoshipsLoading(true);
      setAutoshipsError(null);
      const data = await getUserAutoships();
      setAutoships(data);
    } catch (error: any) {
      console.error('Failed to load autoships:', error);
      setAutoshipsError(error?.message || 'Failed to load autoships');
      setAutoships([]);
    } finally {
      setAutoshipsLoading(false);
    }
  };

  const handleRefreshOrders = async () => {
    setOrdersRefreshing(true);
    await loadOrders();
    setOrdersRefreshing(false);
  };

  const handleRefreshAutoships = async () => {
    setAutoshipsRefreshing(true);
    await loadAutoships();
    setAutoshipsRefreshing(false);
  };

  if (authLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" />
          <ThemedText style={styles.loadingText}>Loading...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  const renderOrderItem = ({ item }: { item: Order }) => (
    <TouchableOpacity
      style={styles.orderCard}
      onPress={() => router.push(`/orders/${item.id}`)}>
      <View style={styles.orderHeader}>
        <View style={styles.orderIdContainer}>
          <ThemedText style={styles.orderIdLabel}>Order</ThemedText>
          <ThemedText type="defaultSemiBold" style={styles.orderId}>
            {truncateOrderId(item.id)}
          </ThemedText>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: statusColors[item.status] || '#999' },
          ]}>
          <ThemedText style={styles.statusText}>{item.status}</ThemedText>
        </View>
      </View>
      <View style={styles.orderDetails}>
        <View style={styles.orderInfo}>
          <ThemedText style={styles.orderDate}>{formatDate(item.created_at)}</ThemedText>
          <ThemedText style={styles.orderSource}>
            {item.source === 'one_time' ? 'One-Time' : 'Autoship'}
          </ThemedText>
        </View>
        <ThemedText type="defaultSemiBold" style={styles.orderTotal}>
          {formatPriceIDR(item.total_idr)}
        </ThemedText>
      </View>
      <View style={styles.orderFooter}>
        <ThemedText style={styles.viewDetailsText}>View Details</ThemedText>
        <MaterialIcons name="chevron-right" size={20} color="#999" />
      </View>
    </TouchableOpacity>
  );

  const renderAutoshipItem = ({ item }: { item: Autoship }) => {
    const pricePerDelivery = item.product?.base_price_idr
      ? item.product.base_price_idr * item.quantity
      : 0;

    return (
      <TouchableOpacity
        style={styles.autoshipCard}
        onPress={() => router.push(`/autoships/${item.id}`)}>
        <View style={styles.autoshipHeader}>
          {item.product?.primary_image_path && (
            <View style={styles.productImageContainer}>
              <Image
                source={{ uri: item.product.primary_image_path }}
                style={styles.productImage}
              />
            </View>
          )}
          <View style={styles.autoshipInfo}>
            <ThemedText type="defaultSemiBold" style={styles.productName} numberOfLines={2}>
              {item.product?.name}
            </ThemedText>
            <ThemedText style={styles.autoshipFrequency}>
              {item.quantity} × {formatFrequency(item.frequency_weeks)}
            </ThemedText>
          </View>
        </View>
        <View style={styles.autoshipDetails}>
          <View>
            {item.status === 'active' ? (
              <>
                <ThemedText style={styles.nextDeliveryLabel}>Next Delivery</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.nextDeliveryDate}>
                  {formatDateTime(item.next_run_at)}
                </ThemedText>
              </>
            ) : (
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: autoshipStatusColors[item.status] || '#999' },
                ]}>
                <ThemedText style={styles.statusText}>{item.status}</ThemedText>
              </View>
            )}
          </View>
          <View style={styles.priceContainer}>
            <ThemedText style={styles.pricePerDeliveryLabel}>Per Delivery</ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.pricePerDelivery}>
              {formatPriceIDR(pricePerDelivery)}
            </ThemedText>
          </View>
        </View>
        <View style={styles.autoshipFooter}>
          <ThemedText style={styles.viewDetailsText}>Manage Subscription</ThemedText>
          <MaterialIcons name="chevron-right" size={20} color="#999" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <ThemedText type="title" style={styles.headerTitle}>Orders</ThemedText>
        <CartHeaderButton />
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'orders' && styles.activeTab]}
          onPress={() => setActiveTab('orders')}>
          <ThemedText
            style={[styles.tabText, activeTab === 'orders' && styles.activeTabText]}>
            Order History
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'autoships' && styles.activeTab]}
          onPress={() => setActiveTab('autoships')}>
          <ThemedText
            style={[styles.tabText, activeTab === 'autoships' && styles.activeTabText]}>
            Autoships
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'orders' ? (
        ordersLoading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" />
            <ThemedText style={styles.loadingText}>Loading orders...</ThemedText>
          </View>
        ) : ordersError ? (
          <View style={styles.centerContent}>
            <MaterialIcons name="error-outline" size={64} color="#f44336" />
            <ThemedText type="title" style={styles.errorTitle}>Error</ThemedText>
            <ThemedText style={styles.errorMessage}>{ordersError}</ThemedText>
            <TouchableOpacity style={styles.retryButton} onPress={loadOrders}>
              <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
            </TouchableOpacity>
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="receipt-long" size={64} color="#999" />
            <ThemedText type="title" style={styles.emptyTitle}>No orders yet</ThemedText>
            <ThemedText style={styles.emptyMessage}>
              Start shopping to see your orders here
            </ThemedText>
            <TouchableOpacity
              style={styles.shopButton}
              onPress={() => router.push('/(tabs)/shop')}>
              <ThemedText style={styles.shopButtonText}>Start Shopping</ThemedText>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={(item) => item.id}
            renderItem={renderOrderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={ordersRefreshing} onRefresh={handleRefreshOrders} />
            }
          />
        )
      ) : (
        autoshipsLoading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" />
            <ThemedText style={styles.loadingText}>Loading autoships...</ThemedText>
          </View>
        ) : autoshipsError ? (
          <View style={styles.centerContent}>
            <MaterialIcons name="error-outline" size={64} color="#f44336" />
            <ThemedText type="title" style={styles.errorTitle}>Error</ThemedText>
            <ThemedText style={styles.errorMessage}>{autoshipsError}</ThemedText>
            <TouchableOpacity style={styles.retryButton} onPress={loadAutoships}>
              <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
            </TouchableOpacity>
          </View>
        ) : autoships.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="refresh" size={64} color="#999" />
            <ThemedText type="title" style={styles.emptyTitle}>No autoships yet</ThemedText>
            <ThemedText style={styles.emptyMessage}>
              Subscribe to your favorite products for automatic delivery and save!
            </ThemedText>
            <TouchableOpacity
              style={styles.shopButton}
              onPress={() => router.push('/(tabs)/shop')}>
              <ThemedText style={styles.shopButtonText}>Browse Products</ThemedText>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={autoships}
            keyExtractor={(item) => item.id}
            renderItem={renderAutoshipItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={autoshipsRefreshing} onRefresh={handleRefreshAutoships} />
            }
          />
        )
      )}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerSpacer: {
    width: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f5f5f5',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    marginTop: 20,
    marginBottom: 8,
    fontSize: 20,
  },
  emptyMessage: {
    fontSize: 16,
    opacity: 0.6,
    textAlign: 'center',
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
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  orderCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderIdContainer: {
    gap: 2,
  },
  orderIdLabel: {
    fontSize: 12,
    opacity: 0.6,
  },
  orderId: {
    fontSize: 16,
    fontFamily: 'monospace',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  orderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderInfo: {
    gap: 4,
  },
  orderDate: {
    fontSize: 14,
    opacity: 0.7,
  },
  orderSource: {
    fontSize: 12,
    opacity: 0.6,
  },
  orderTotal: {
    fontSize: 18,
  },
  orderFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  viewDetailsText: {
    fontSize: 14,
    color: '#007AFF',
  },
  autoshipCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  autoshipHeader: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 12,
  },
  productImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  autoshipInfo: {
    flex: 1,
    gap: 4,
  },
  productName: {
    fontSize: 16,
  },
  autoshipFrequency: {
    fontSize: 14,
    opacity: 0.7,
  },
  autoshipDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  nextDeliveryLabel: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 4,
  },
  nextDeliveryDate: {
    fontSize: 14,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  pricePerDeliveryLabel: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 4,
  },
  pricePerDelivery: {
    fontSize: 18,
  },
  autoshipFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  errorTitle: {
    marginTop: 20,
    marginBottom: 8,
    fontSize: 20,
    color: '#f44336',
  },
  errorMessage: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
