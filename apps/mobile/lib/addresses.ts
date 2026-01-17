/**
 * Address data access functions for mobile app
 * Phase 4: Orders & Checkout
 */

import { supabase } from './supabase';
import type { Address, AddressInput } from './types';

/**
 * Get user's addresses
 */
export async function getUserAddresses(): Promise<Address[]> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated to view addresses');
  }

  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch addresses: ${error.message}`);
  }

  return data || [];
}

/**
 * Create new address
 */
export async function createAddress(data: AddressInput): Promise<Address> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated to create addresses');
  }

  const { data: address, error } = await supabase
    .from('addresses')
    .insert({
      user_id: user.id,
      label: data.label,
      address_line: data.address_line,
      city: data.city,
      province: data.province,
      postal_code: data.postal_code,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create address: ${error.message}`);
  }

  return address;
}

/**
 * Update address
 */
export async function updateAddress(
  id: string,
  data: Partial<AddressInput>
): Promise<Address> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated to update addresses');
  }

  // Verify address belongs to user
  const { data: existingAddress } = await supabase
    .from('addresses')
    .select('user_id')
    .eq('id', id)
    .single();

  if (!existingAddress || existingAddress.user_id !== user.id) {
    throw new Error('Address not found or access denied');
  }

  const { data: address, error } = await supabase
    .from('addresses')
    .update({
      ...(data.label !== undefined && { label: data.label }),
      ...(data.address_line !== undefined && { address_line: data.address_line }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.province !== undefined && { province: data.province }),
      ...(data.postal_code !== undefined && { postal_code: data.postal_code }),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update address: ${error.message}`);
  }

  return address;
}

/**
 * Delete address
 */
export async function deleteAddress(id: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated to delete addresses');
  }

  // Verify address belongs to user
  const { data: existingAddress } = await supabase
    .from('addresses')
    .select('user_id')
    .eq('id', id)
    .single();

  if (!existingAddress || existingAddress.user_id !== user.id) {
    throw new Error('Address not found or access denied');
  }

  const { error } = await supabase
    .from('addresses')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete address: ${error.message}`);
  }
}
