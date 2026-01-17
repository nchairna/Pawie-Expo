/**
 * Test script to verify orders RLS is working
 * Run this in your app to debug order visibility issues
 */

import { supabase } from './supabase';

export async function testOrdersRLS() {
  console.log('=== Testing Orders RLS ===');
  
  // 1. Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error('❌ Not authenticated:', authError);
    return;
  }
  console.log('✅ Authenticated as:', user.id, user.email);

  // 2. Check if RLS is enabled (requires admin, but we can try)
  const { data: rlsCheck, error: rlsError } = await supabase
    .rpc('check_rls_enabled', { table_name: 'orders' })
    .catch(() => ({ data: null, error: null }));
  
  // 3. Try to fetch orders directly
  console.log('\n--- Fetching orders with .eq() filter ---');
  const { data: ordersWithFilter, error: errorWithFilter } = await supabase
    .from('orders')
    .select('id, user_id, status, total_price_idr, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);

  if (errorWithFilter) {
    console.error('❌ Error with filter:', errorWithFilter);
  } else {
    console.log(`✅ Found ${ordersWithFilter?.length || 0} orders with filter`);
    console.log('Orders:', ordersWithFilter);
  }

  // 4. Try to fetch orders without explicit filter (RLS should handle it)
  console.log('\n--- Fetching orders without filter (RLS only) ---');
  const { data: ordersNoFilter, error: errorNoFilter } = await supabase
    .from('orders')
    .select('id, user_id, status, total_price_idr, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (errorNoFilter) {
    console.error('❌ Error without filter:', errorNoFilter);
  } else {
    console.log(`✅ Found ${ordersNoFilter?.length || 0} orders without filter`);
    console.log('Orders:', ordersNoFilter);
    
    // Verify all orders belong to user
    const allOwnOrders = ordersNoFilter?.every(o => o.user_id === user.id);
    if (allOwnOrders) {
      console.log('✅ RLS working correctly - only own orders returned');
    } else {
      console.error('❌ RLS issue - found orders from other users!');
    }
  }

  // 5. Check order count
  console.log('\n--- Checking order count ---');
  const { count, error: countError } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (countError) {
    console.error('❌ Error counting orders:', countError);
  } else {
    console.log(`✅ Total orders for user: ${count || 0}`);
  }

  // 6. Summary
  console.log('\n=== Summary ===');
  console.log(`User ID: ${user.id}`);
  console.log(`Orders with filter: ${ordersWithFilter?.length || 0}`);
  console.log(`Orders without filter: ${ordersNoFilter?.length || 0}`);
  console.log(`Total order count: ${count || 0}`);
  
  if (ordersNoFilter && ordersNoFilter.length > 0) {
    console.log('✅ Orders are visible - RLS is working!');
  } else if (count && count > 0) {
    console.log('⚠️ Orders exist but query might have issues');
  } else {
    console.log('ℹ️ No orders found for this user (this is OK if you haven\'t created any)');
  }
}
