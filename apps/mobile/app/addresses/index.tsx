/**
 * Address List Screen
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
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { getUserAddresses, deleteAddress } from '@/lib/addresses';
import type { Address } from '@/lib/types';

export default function AddressListScreen() {
  const { user, loading: authLoading } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user && !authLoading) {
      loadAddresses();
    }
  }, [user, authLoading]);

  const loadAddresses = async () => {
    try {
      setLoading(true);
      const data = await getUserAddresses();
      setAddresses(data);
    } catch (error: any) {
      console.error('Failed to load addresses:', error);
      Alert.alert('Error', error.message || 'Failed to load addresses');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAddresses();
    setRefreshing(false);
  };

  const handleDelete = async (address: Address) => {
    if (deletingIds.has(address.id)) return;

    Alert.alert(
      'Delete Address',
      `Are you sure you want to delete "${address.label || 'this address'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingIds((prev) => new Set(prev).add(address.id));
              await deleteAddress(address.id);
              setAddresses((prev) => prev.filter((a) => a.id !== address.id));
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete address');
            } finally {
              setDeletingIds((prev) => {
                const next = new Set(prev);
                next.delete(address.id);
                return next;
              });
            }
          },
        },
      ]
    );
  };

  if (authLoading || loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" />
          <ThemedText style={styles.loadingText}>Loading addresses...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!user) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContent}>
          <ThemedText>Please sign in to manage addresses</ThemedText>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/login')}>
            <ThemedText style={styles.loginButtonText}>Sign In</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

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
          <ThemedText type="title" style={styles.title}>
            Saved Addresses
          </ThemedText>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/addresses/new')}>
            <MaterialIcons name="add" size={24} color="#007AFF" />
            <ThemedText style={styles.addButtonText}>Add New</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Addresses List */}
        {addresses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="location-on" size={64} color="#999" />
            <ThemedText type="title" style={styles.emptyTitle}>
              No addresses saved
            </ThemedText>
            <ThemedText style={styles.emptyMessage}>
              Add an address to use for shipping
            </ThemedText>
            <TouchableOpacity
              style={styles.addFirstButton}
              onPress={() => router.push('/addresses/new')}>
              <ThemedText style={styles.addFirstButtonText}>Add Your First Address</ThemedText>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.addressesContainer}>
            {addresses.map((address) => (
              <View key={address.id} style={styles.addressCard}>
                <View style={styles.addressContent}>
                  {address.label && (
                    <ThemedText type="defaultSemiBold" style={styles.addressLabel}>
                      {address.label}
                    </ThemedText>
                  )}
                  <ThemedText style={styles.addressText}>
                    {address.address_line}
                  </ThemedText>
                  <ThemedText style={styles.addressText}>
                    {[address.city, address.province, address.postal_code]
                      .filter(Boolean)
                      .join(', ')}
                  </ThemedText>
                </View>
                <View style={styles.addressActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => router.push(`/addresses/${address.id}/edit`)}>
                    <MaterialIcons name="edit" size={20} color="#007AFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDelete(address)}
                    disabled={deletingIds.has(address.id)}>
                    {deletingIds.has(address.id) ? (
                      <ActivityIndicator size="small" color="#ff4444" />
                    ) : (
                      <MaterialIcons name="delete-outline" size={20} color="#ff4444" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
  },
  addButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 400,
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
  addFirstButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addFirstButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  addressesContainer: {
    gap: 12,
  },
  addressCard: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  addressContent: {
    flex: 1,
    gap: 4,
  },
  addressLabel: {
    fontSize: 16,
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    opacity: 0.8,
  },
  addressActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  actionButton: {
    padding: 8,
  },
  loginButton: {
    marginTop: 16,
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
