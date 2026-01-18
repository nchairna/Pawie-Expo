/**
 * Create Address Screen
 * Phase 4: Orders & Checkout
 */

import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { createAddress, updateAddress, getUserAddresses } from '@/lib/addresses';
import type { AddressInput } from '@/lib/types';

export default function AddressFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;
  const { user, loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<AddressInput>({
    label: '',
    address_line: '',
    city: '',
    province: '',
    postal_code: '',
  });

  useEffect(() => {
    if (isEditing && id) {
      loadAddress();
    }
  }, [isEditing, id]);

  const loadAddress = async () => {
    try {
      const addresses = await getUserAddresses();
      const address = addresses.find((a) => a.id === id);
      if (address) {
        setFormData({
          label: address.label || '',
          address_line: address.address_line || '',
          city: address.city || '',
          province: address.province || '',
          postal_code: address.postal_code || '',
        });
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load address');
      router.back();
    }
  };

  const validateForm = (): boolean => {
    if (!formData.label.trim()) {
      Alert.alert('Validation Error', 'Please enter a label (e.g., Home, Office)');
      return false;
    }
    if (!formData.address_line.trim()) {
      Alert.alert('Validation Error', 'Please enter an address');
      return false;
    }
    if (!formData.city.trim()) {
      Alert.alert('Validation Error', 'Please enter a city');
      return false;
    }
    if (!formData.province.trim()) {
      Alert.alert('Validation Error', 'Please enter a province');
      return false;
    }
    if (!formData.postal_code.trim()) {
      Alert.alert('Validation Error', 'Please enter a postal code');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      if (isEditing && id) {
        await updateAddress(id, formData);
        Alert.alert('Success', 'Address updated successfully', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        await createAddress(formData);
        Alert.alert('Success', 'Address created successfully', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save address');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" />
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
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <ThemedText type="title" style={styles.title}>
            {isEditing ? 'Edit Address' : 'New Address'}
          </ThemedText>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Form Fields */}
          <View style={styles.formContainer}>
            <View style={styles.fieldContainer}>
              <ThemedText type="defaultSemiBold" style={styles.label}>
                Label *
              </ThemedText>
              <TextInput
                style={styles.input}
                placeholder="e.g., Home, Office"
                placeholderTextColor="#999"
                value={formData.label}
                onChangeText={(text) => setFormData({ ...formData, label: text })}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.fieldContainer}>
              <ThemedText type="defaultSemiBold" style={styles.label}>
                Address Line *
              </ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Street address, building, etc."
                placeholderTextColor="#999"
                value={formData.address_line}
                onChangeText={(text) => setFormData({ ...formData, address_line: text })}
                multiline
                numberOfLines={3}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.fieldContainer}>
              <ThemedText type="defaultSemiBold" style={styles.label}>
                City *
              </ThemedText>
              <TextInput
                style={styles.input}
                placeholder="City"
                placeholderTextColor="#999"
                value={formData.city}
                onChangeText={(text) => setFormData({ ...formData, city: text })}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.fieldContainer}>
              <ThemedText type="defaultSemiBold" style={styles.label}>
                Province *
              </ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Province"
                placeholderTextColor="#999"
                value={formData.province}
                onChangeText={(text) => setFormData({ ...formData, province: text })}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.fieldContainer}>
              <ThemedText type="defaultSemiBold" style={styles.label}>
                Postal Code *
              </ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Postal code"
                placeholderTextColor="#999"
                value={formData.postal_code}
                onChangeText={(text) => setFormData({ ...formData, postal_code: text })}
                keyboardType="numeric"
              />
            </View>
          </View>
        </ScrollView>

        {/* Save Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.saveButtonText}>
                {isEditing ? 'Update Address' : 'Save Address'}
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  formContainer: {
    gap: 20,
  },
  fieldContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 44,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
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
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 5,
      },
      web: {
        boxShadow: '0 -2px 4px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
