/**
 * AutoshipSavingsCard Component
 * Phase 3: Pricing Engine & Discounts
 * 
 * Promotes autoship by showing savings compared to one-time purchase
 */

import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { formatPriceIDR } from '@/lib/utils';

interface AutoshipSavingsCardProps {
  basePrice: number;
  autoshipPrice: number;
  savingsPercentage: number;
  savingsAmount: number;
  onEnrollPress?: () => void;
}

export function AutoshipSavingsCard({
  basePrice,
  autoshipPrice,
  savingsPercentage,
  savingsAmount,
  onEnrollPress,
}: AutoshipSavingsCardProps) {
  // Don't show if there's no savings
  if (savingsAmount <= 0) {
    return null;
  }

  return (
    <ThemedView style={styles.card} lightColor="#E3F2FD" darkColor="#1E3A5F">
      <View style={styles.content}>
        <ThemedText type="defaultSemiBold" style={styles.title}>
          💰 Save with Autoship!
        </ThemedText>
        <ThemedText style={styles.description}>
          Get this item delivered automatically and save {formatPriceIDR(savingsAmount)} ({savingsPercentage}%) every order.
        </ThemedText>
        {onEnrollPress && (
          <TouchableOpacity
            style={styles.enrollButton}
            onPress={onEnrollPress}
            activeOpacity={0.7}>
            <ThemedText style={styles.enrollButtonText}>
              Enroll in Autoship →
            </ThemedText>
          </TouchableOpacity>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
  },
  content: {
    gap: 8,
  },
  title: {
    fontSize: 18,
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.9,
  },
  enrollButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1976D2',
    borderRadius: 8,
  },
  enrollButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
