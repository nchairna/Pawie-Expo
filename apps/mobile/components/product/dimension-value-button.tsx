/**
 * Memoized dimension value button component
 * Prevents unnecessary re-renders for better performance
 */

import { memo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import type { VariantValue } from '@/lib/types';

export interface DimensionValueButtonProps {
  value: VariantValue;
  dimensionId: string;
  isSelected: boolean;
  isUnavailable: boolean;
  onPress: () => void;
}

export const DimensionValueButton = memo<DimensionValueButtonProps>(({
  value,
  isSelected,
  isUnavailable,
  onPress,
}) => {
  return (
    <View style={styles.dimensionValueWrapper}>
      <TouchableOpacity
        style={[
          styles.dimensionValueButton,
          isSelected && styles.dimensionValueButtonSelected,
          isUnavailable && styles.dimensionValueButtonDisabled,
        ]}
        onPress={onPress}
        disabled={isSelected}>
        <ThemedText
          style={[
            styles.dimensionValueText,
            isSelected && styles.dimensionValueTextSelected,
            isUnavailable && styles.dimensionValueTextDisabled,
          ]}>
          {value.value}
        </ThemedText>
      </TouchableOpacity>
      {isUnavailable && (
        <ThemedText style={styles.unavailableText}>
          See available options
        </ThemedText>
      )}
    </View>
  );
});

DimensionValueButton.displayName = 'DimensionValueButton';

const styles = StyleSheet.create({
  dimensionValueWrapper: {
    marginRight: 8,
    alignItems: 'center',
  },
  dimensionValueButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  dimensionValueButtonSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  dimensionValueText: {
    fontSize: 14,
    color: '#000000',
  },
  dimensionValueTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  dimensionValueButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  dimensionValueTextDisabled: {
    opacity: 0.6,
  },
  unavailableText: {
    fontSize: 10,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 4,
    textAlign: 'center',
  },
});





