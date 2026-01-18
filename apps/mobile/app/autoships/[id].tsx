/**
 * Autoship Detail/Management Screen
 * Phase 5: Autoship System
 */

import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import {
  getAutoshipById,
  updateAutoship,
  skipNextAutoship,
  pauseAutoship,
  resumeAutoship,
  cancelAutoship,
} from '@/lib/autoships';
import { formatPriceIDR } from '@/lib/utils';
import type { AutoshipWithRuns } from '@/lib/types';

const FREQUENCY_OPTIONS = [
  { value: 1, label: 'Weekly' },
  { value: 2, label: 'Every 2 weeks' },
  { value: 4, label: 'Every 4 weeks' },
  { value: 6, label: 'Every 6 weeks' },
  { value: 8, label: 'Every 8 weeks' },
  { value: 12, label: 'Every 12 weeks' },
];

const statusColors: Record<string, string> = {
  active: '#4CAF50',
  paused: '#ff9800',
  cancelled: '#9e9e9e',
};

const runStatusColors: Record<string, string> = {
  completed: '#4CAF50',
  failed: '#f44336',
  skipped: '#ff9800',
  pending: '#2196F3',
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function AutoshipDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [autoship, setAutoship] = useState<AutoshipWithRuns | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [frequency, setFrequency] = useState(4);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (id) loadAutoship();
  }, [id]);

  const loadAutoship = async () => {
    try {
      setLoading(true);
      const data = await getAutoshipById(id!);
      setAutoship(data);
      if (data) {
        setQuantity(data.quantity);
        setFrequency(data.frequency_weeks);
      }
    } catch (error) {
      console.error('Error loading autoship:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = (delta: number) => {
    const newQty = Math.max(1, quantity + delta);
    setQuantity(newQty);
    setHasChanges(newQty !== autoship?.quantity || frequency !== autoship?.frequency_weeks);
  };

  const handleFrequencyChange = (newFreq: number) => {
    setFrequency(newFreq);
    setHasChanges(quantity !== autoship?.quantity || newFreq !== autoship?.frequency_weeks);
  };

  const handleSaveChanges = async () => {
    if (!autoship) return;
    setActionLoading(true);
    const result = await updateAutoship(autoship.id, {
      quantity: quantity !== autoship.quantity ? quantity : undefined,
      frequencyWeeks: frequency !== autoship.frequency_weeks ? frequency : undefined,
    });
    setActionLoading(false);
    if (result.success) {
      Alert.alert('Success', 'Subscription updated');
      loadAutoship();
      setHasChanges(false);
    } else {
      Alert.alert('Error', result.error || 'Failed to update');
    }
  };

  const handleSkip = async () => {
    Alert.alert('Skip Delivery', 'Skip your next scheduled delivery?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Skip',
        onPress: async () => {
          setActionLoading(true);
          const result = await skipNextAutoship(autoship!.id);
          setActionLoading(false);
          if (result.success) {
            Alert.alert('Success', 'Next delivery skipped');
            loadAutoship();
          } else {
            Alert.alert('Error', result.error || 'Failed to skip');
          }
        },
      },
    ]);
  };

  const handlePause = async () => {
    setActionLoading(true);
    const result = await pauseAutoship(autoship!.id);
    setActionLoading(false);
    if (result.success) {
      Alert.alert('Success', 'Subscription paused');
      loadAutoship();
    } else {
      Alert.alert('Error', result.error || 'Failed to pause');
    }
  };

  const handleResume = async () => {
    setActionLoading(true);
    const result = await resumeAutoship(autoship!.id);
    setActionLoading(false);
    if (result.success) {
      Alert.alert('Success', 'Subscription resumed');
      loadAutoship();
    } else {
      Alert.alert('Error', result.error || 'Failed to resume');
    }
  };

  const handleCancel = async () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure? This cannot be undone and you will lose your autoship discount.',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const result = await cancelAutoship(autoship!.id);
            setActionLoading(false);
            if (result.success) {
              Alert.alert('Cancelled', 'Subscription has been cancelled');
              router.back();
            } else {
              Alert.alert('Error', result.error || 'Failed to cancel');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" />
        </View>
      </ThemedView>
    );
  }

  if (!autoship) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContent}>
          <ThemedText>Subscription not found</ThemedText>
          <TouchableOpacity style={styles.button} onPress={() => router.back()}>
            <ThemedText style={styles.buttonText}>Go Back</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  const pricePerDelivery = (autoship.product?.base_price_idr || 0) * quantity;
  const isActive = autoship.status === 'active';
  const isPaused = autoship.status === 'paused';
  const isCancelled = autoship.status === 'cancelled';

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.headerTitle}>Manage Subscription</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Product Info */}
        <View style={styles.productCard}>
          {autoship.product?.primary_image_path && (
            <Image
              source={{ uri: autoship.product.primary_image_path }}
              style={styles.productImage}
            />
          )}
          <View style={styles.productInfo}>
            <ThemedText type="defaultSemiBold" style={styles.productName}>
              {autoship.product?.name}
            </ThemedText>
            <View style={[styles.statusBadge, { backgroundColor: statusColors[autoship.status] }]}>
              <ThemedText style={styles.statusText}>{autoship.status}</ThemedText>
            </View>
          </View>
        </View>

        {/* Next Delivery */}
        {isActive && (
          <View style={styles.section}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Next Delivery</ThemedText>
            <View style={styles.nextDeliveryCard}>
              <MaterialIcons name="local-shipping" size={24} color="#007AFF" />
              <ThemedText style={styles.nextDeliveryDate}>{formatDate(autoship.next_run_at)}</ThemedText>
              <TouchableOpacity style={styles.skipButton} onPress={handleSkip} disabled={actionLoading}>
                <ThemedText style={styles.skipButtonText}>Skip</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Quantity & Frequency (editable if not cancelled) */}
        {!isCancelled && (
          <View style={styles.section}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Subscription Details</ThemedText>

            {/* Quantity */}
            <View style={styles.row}>
              <ThemedText>Quantity</ThemedText>
              <View style={styles.quantitySelector}>
                <TouchableOpacity style={styles.qtyButton} onPress={() => handleQuantityChange(-1)}>
                  <MaterialIcons name="remove" size={20} color="#007AFF" />
                </TouchableOpacity>
                <ThemedText style={styles.qtyText}>{quantity}</ThemedText>
                <TouchableOpacity style={styles.qtyButton} onPress={() => handleQuantityChange(1)}>
                  <MaterialIcons name="add" size={20} color="#007AFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Frequency */}
            <View style={styles.frequencySection}>
              <ThemedText style={{ marginBottom: 8 }}>Delivery Frequency</ThemedText>
              <View style={styles.frequencyOptions}>
                {FREQUENCY_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.freqOption, frequency === opt.value && styles.freqOptionSelected]}
                    onPress={() => handleFrequencyChange(opt.value)}
                  >
                    <ThemedText style={[styles.freqOptionText, frequency === opt.value && styles.freqOptionTextSelected]}>
                      {opt.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Price */}
            <View style={styles.priceRow}>
              <ThemedText>Price per delivery</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.price}>
                {formatPriceIDR(pricePerDelivery)}
              </ThemedText>
            </View>

            {/* Save Changes */}
            {hasChanges && (
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveChanges} disabled={actionLoading}>
                <ThemedText style={styles.saveButtonText}>
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Delivery History */}
        {autoship.runs && autoship.runs.length > 0 && (
          <View style={styles.section}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Delivery History</ThemedText>
            {autoship.runs.slice(0, 5).map((run) => (
              <View key={run.id} style={styles.historyItem}>
                <View style={[styles.runStatusDot, { backgroundColor: runStatusColors[run.status] }]} />
                <ThemedText style={styles.historyDate}>{formatDate(run.scheduled_at)}</ThemedText>
                <ThemedText style={styles.historyStatus}>{run.status}</ThemedText>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        {!isCancelled && (
          <View style={styles.section}>
            {isActive && (
              <TouchableOpacity style={styles.pauseButton} onPress={handlePause} disabled={actionLoading}>
                <MaterialIcons name="pause" size={20} color="#ff9800" />
                <ThemedText style={styles.pauseButtonText}>Pause Subscription</ThemedText>
              </TouchableOpacity>
            )}
            {isPaused && (
              <TouchableOpacity style={styles.resumeButton} onPress={handleResume} disabled={actionLoading}>
                <MaterialIcons name="play-arrow" size={20} color="#4CAF50" />
                <ThemedText style={styles.resumeButtonText}>Resume Subscription</ThemedText>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} disabled={actionLoading}>
              <MaterialIcons name="cancel" size={20} color="#f44336" />
              <ThemedText style={styles.cancelButtonText}>Cancel Subscription</ThemedText>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {actionLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: { fontSize: 18 },
  content: { flex: 1, padding: 16 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  productCard: { flexDirection: 'row', backgroundColor: '#f5f5f5', borderRadius: 12, padding: 12, marginBottom: 16 },
  productImage: { width: 80, height: 80, borderRadius: 8, backgroundColor: '#fff' },
  productInfo: { flex: 1, marginLeft: 12, justifyContent: 'center', gap: 8 },
  productName: { fontSize: 16 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, marginBottom: 12 },
  nextDeliveryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e3f2fd', padding: 16, borderRadius: 12, gap: 12 },
  nextDeliveryDate: { flex: 1, fontSize: 16 },
  skipButton: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  skipButtonText: { color: '#007AFF', fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  quantitySelector: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e3f2fd', justifyContent: 'center', alignItems: 'center' },
  qtyText: { fontSize: 18, fontWeight: '600', minWidth: 30, textAlign: 'center' },
  frequencySection: { paddingVertical: 12 },
  frequencyOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  freqOption: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f0f0f0' },
  freqOptionSelected: { backgroundColor: '#007AFF' },
  freqOptionText: { fontSize: 13, color: '#333' },
  freqOptionTextSelected: { color: '#fff' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#eee', marginTop: 8 },
  price: { fontSize: 20 },
  saveButton: { backgroundColor: '#007AFF', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  historyItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  runStatusDot: { width: 10, height: 10, borderRadius: 5 },
  historyDate: { flex: 1 },
  historyStatus: { textTransform: 'capitalize', opacity: 0.6 },
  pauseButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#ff9800', gap: 8, marginBottom: 12 },
  pauseButtonText: { color: '#ff9800', fontSize: 16, fontWeight: '600' },
  resumeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#4CAF50', gap: 8, marginBottom: 12 },
  resumeButtonText: { color: '#4CAF50', fontSize: 16, fontWeight: '600' },
  cancelButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#f44336', gap: 8 },
  cancelButtonText: { color: '#f44336', fontSize: 16, fontWeight: '600' },
  button: { backgroundColor: '#007AFF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.8)', justifyContent: 'center', alignItems: 'center' },
});
