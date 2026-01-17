/**
 * Order History Screen
 * Phase 4: Orders & Checkout
 */

import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CartHeaderButton } from '@/components/cart-header-button';
import { useAuth } from '@/contexts/AuthContext';
import { getUserOrders } from '@/lib/orders';
import { formatPriceIDR } from '@/lib/utils';
import type { Order } from '@/lib/types';

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

function truncateOrderId(orderId: string): string {
  return orderId.substring(0, 8).toUpperCase();
}

export default function OrdersScreen() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (user) {
      loadOrders(true);
    }
  }, [user, authLoading]);

  const loadOrders = async (reset: boolean = false) => {
    if (!reset && (loading || loadingMore)) return;

    try {
      if (reset) {
        setLoading(true);
        setOffset(0);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      const currentOffset = reset ? 0 : offset;
      const data = await getUserOrders({
        limit: 20,
        offset: currentOffset,
      });

      if (reset) {
        setOrders(data);
      } else {
        setOrders((prev) => [...prev, ...data]);
      }

      setHasMore(data.length === 20);
      setOffset(currentOffset + data.length);
      setError(null);
    } catch (error: any) {
      console.error('Failed to load orders:', error);
      const errorMessage = error?.message || 'Failed to load orders';
      setError(errorMessage);
      if (reset) {
        setOrders([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOrders(true);
    setRefreshing(false);
  };

  const handleLoadMore = () => {
    if (hasMore && !loadingMore) {
      loadOrders(false);
    }
  };

  if (authLoading || loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" />
          <ThemedText style={styles.loadingText}>Loading orders...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  // Error state
  if (error && orders.length === 0) {
    const isNetworkError =
      error.toLowerCase().includes('network') ||
      error.toLowerCase().includes('fetch') ||
      error.toLowerCase().includes('connection');
    const isRLSError =
      error.toLowerCase().includes('permission') ||
      error.toLowerCase().includes('access') ||
      error.toLowerCase().includes('authenticated');

    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <ThemedText type="title" style={styles.headerTitle}>Orders</ThemedText>
          <CartHeaderButton />
        </View>
        <View style={styles.centerContent}>
          <MaterialIcons name="error-outline" size={64} color="#f44336" />
          <ThemedText type="title" style={styles.errorTitle}>
            {isNetworkError ? 'Connection Error' : isRLSError ? 'Authentication Error' : 'Error'}
          </ThemedText>
          <ThemedText style={styles.errorMessage}>
            {isNetworkError
              ? 'Unable to connect to the server. Please check your internet connection.'
              : isRLSError
              ? 'Please sign in to view your orders.'
              : error || 'An unexpected error occurred'}
          </ThemedText>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadOrders(true)}>
            <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <ThemedText type="title" style={styles.headerTitle}>Orders</ThemedText>
        <CartHeaderButton />
      </View>

      {orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="receipt-long" size={64} color="#999" />
          <ThemedText type="title" style={styles.emptyTitle}>
            No orders yet
          </ThemedText>
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
          renderItem={({ item }) => (
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
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={() => {
            if (!loadingMore || !hasMore) return null;
            return (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" />
                <ThemedText style={styles.footerLoaderText}>Loading more orders...</ThemedText>
              </View>
            );
          }}
        />
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
  footerLoader: {
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  footerLoaderText: {
    fontSize: 14,
    opacity: 0.6,
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
