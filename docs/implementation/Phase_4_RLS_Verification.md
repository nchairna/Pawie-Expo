# Phase 4 RLS Verification & End-to-End Testing

**Date**: 2026-01-09
**Purpose**: Verify order RLS policies and test complete order flow

---

## 1. RLS Policies Status

### Orders Table Policies ✅

**SELECT Policy**: `orders_select_own_or_admin`
```sql
CREATE POLICY "orders_select_own_or_admin" ON public.orders
    FOR SELECT
    TO public
    USING (((select auth.uid()) = user_id) OR (select is_admin()));
```
- ✅ Users can see their own orders (`user_id = auth.uid()`)
- ✅ Admins can see all orders (`is_admin()`)
- ✅ Policy is active and optimized (wrapped in `(select ...)` for performance)

**INSERT Policy**: `orders_insert_own`
```sql
CREATE POLICY "orders_insert_own" ON public.orders
    FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);
```
- ✅ Only authenticated users can insert
- ✅ Users can only insert orders with their own `user_id`
- ✅ Orders are created via `create_order_with_inventory()` function (SECURITY DEFINER)

**UPDATE Policy**: None (intentional)
- ✅ Order status updates are done via `update_order_status()` function
- ✅ Function is SECURITY DEFINER and checks admin permissions internally
- ✅ This is the correct pattern for admin-only operations

### Order Items Table Policies ✅

**SELECT Policy**: `order_items_select_own_orders_or_admin`
```sql
CREATE POLICY "order_items_select_own_orders_or_admin" ON public.order_items
    FOR SELECT
    TO public
    USING (
        (select is_admin()) OR (
            EXISTS (
                SELECT 1
                FROM orders o
                WHERE o.id = order_items.order_id
                    AND o.user_id = (select auth.uid())
            )
        )
    );
```
- ✅ Users can see order_items from their own orders
- ✅ Admins can see all order_items
- ✅ Policy uses EXISTS subquery to check order ownership

---

## 2. End-to-End Test Checklist

### Test 1: Create Order ✅

**Steps**:
1. Sign in as a regular user (not admin)
2. Add products to cart
3. Go to checkout
4. Select/create shipping address
5. Place order

**Expected Results**:
- ✅ Order created with `status = 'pending'`
- ✅ Order `user_id` matches authenticated user
- ✅ Inventory decremented for all items
- ✅ Order items created with price snapshots
- ✅ Cart cleared after successful order
- ✅ Order confirmation screen shows order ID

**Verification Query**:
```sql
-- Check order was created (as admin or the user themselves)
SELECT id, user_id, status, total_price_idr, created_at
FROM orders
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 1;
```

### Test 2: View Orders in Mobile App ✅

**Steps**:
1. Sign in as the user who created the order
2. Navigate to Orders tab
3. Check if order appears in the list

**Expected Results**:
- ✅ Orders page loads without errors
- ✅ Order appears in the list (newest first)
- ✅ Order shows correct status badge
- ✅ Order shows correct total price
- ✅ Order shows correct date
- ✅ Can tap order to view details

**Potential Issues**:
- ❌ If orders don't appear, check:
  1. User is authenticated (`auth.uid()` is not null)
  2. Order `user_id` matches `auth.uid()`
  3. RLS policy is enabled: `SELECT * FROM pg_policies WHERE tablename = 'orders';`
  4. No JavaScript errors in console

### Test 3: View Order Details ✅

**Steps**:
1. From Orders list, tap on an order
2. View order detail screen

**Expected Results**:
- ✅ Order details load correctly
- ✅ Order items display with product info
- ✅ Price breakdown shows subtotal, discounts, total
- ✅ Shipping address displays (if provided)
- ✅ Status timeline shows current status
- ✅ All prices are from locked snapshots (not current prices)

### Test 4: Admin Order Management ✅

**Steps**:
1. Sign in as admin
2. Navigate to Admin → Orders
3. View order list
4. Open order detail
5. Update order status

**Expected Results**:
- ✅ Admin can see all orders (not just their own)
- ✅ Admin can update order status
- ✅ Status transitions are validated
- ✅ Cancellation restores inventory

### Test 5: RLS Security Test ✅

**Steps**:
1. Sign in as User A
2. Create an order
3. Note the order ID
4. Sign out
5. Sign in as User B
6. Try to access User A's order (via direct URL or API)

**Expected Results**:
- ✅ User B cannot see User A's orders in list
- ✅ User B cannot access User A's order detail (returns null/error)
- ✅ RLS policy correctly filters orders by `user_id`

---

## 3. Troubleshooting Guide

### Issue: Orders Not Appearing in Mobile App

**Checklist**:
1. ✅ User is authenticated
   ```typescript
   const { data: { user } } = await supabase.auth.getUser();
   console.log('User ID:', user?.id);
   ```

2. ✅ RLS is enabled on orders table
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public' AND tablename = 'orders';
   -- Should return: rowsecurity = true
   ```

3. ✅ RLS policy exists and is active
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename = 'orders' AND policyname = 'orders_select_own_or_admin';
   ```

4. ✅ Order exists with correct user_id
   ```sql
   SELECT id, user_id, status, created_at 
   FROM orders 
   WHERE user_id = 'YOUR_USER_ID';
   ```

5. ✅ Check Supabase client is using correct key
   - Mobile app should use `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - Not the service role key

6. ✅ Check for JavaScript errors
   - Open React Native debugger
   - Check console for errors
   - Check network tab for failed requests

### Issue: RLS Policy Not Working

**Debug Steps**:
1. Test RLS directly in SQL:
   ```sql
   -- As the user (set role)
   SET ROLE authenticated;
   SET request.jwt.claim.sub = 'YOUR_USER_ID';
   
   -- Try to select orders
   SELECT * FROM orders;
   -- Should only return orders where user_id = YOUR_USER_ID
   ```

2. Check policy definition:
   ```sql
   SELECT 
     schemaname,
     tablename,
     policyname,
     permissive,
     roles,
     cmd,
     qual,
     with_check
   FROM pg_policies
   WHERE tablename = 'orders';
   ```

3. Verify `is_admin()` function works:
   ```sql
   SELECT is_admin();
   -- Should return true for admin users, false for regular users
   ```

---

## 4. Verification Queries

### Check All Orders (Admin Only)
```sql
SELECT 
  o.id,
  o.user_id,
  p.email as user_email,
  o.status,
  o.total_price_idr,
  o.created_at
FROM orders o
LEFT JOIN profiles p ON p.id = o.user_id
ORDER BY o.created_at DESC
LIMIT 10;
```

### Check User's Orders
```sql
-- Replace 'USER_ID' with actual user ID
SELECT 
  id,
  status,
  source,
  subtotal_idr,
  discount_total_idr,
  total_price_idr,
  created_at
FROM orders
WHERE user_id = 'USER_ID'
ORDER BY created_at DESC;
```

### Check Order Items
```sql
SELECT 
  oi.id,
  oi.order_id,
  oi.product_id,
  p.name as product_name,
  oi.quantity,
  oi.unit_final_price_idr,
  oi.line_total_idr
FROM order_items oi
JOIN products p ON p.id = oi.product_id
WHERE oi.order_id = 'ORDER_ID';
```

### Verify RLS Policies
```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('orders', 'order_items');

-- Check policies
SELECT 
  tablename,
  policyname,
  cmd as operation,
  roles
FROM pg_policies
WHERE tablename IN ('orders', 'order_items')
ORDER BY tablename, policyname;
```

---

## 5. Expected Behavior Summary

**Regular User**:
- ✅ Can create orders (INSERT)
- ✅ Can view their own orders (SELECT)
- ✅ Cannot view other users' orders
- ✅ Cannot update order status (must use admin function)

**Admin User**:
- ✅ Can view all orders (SELECT)
- ✅ Can update order status via `update_order_status()` function
- ✅ Can manage inventory
- ✅ Can view all order items

**RLS Enforcement**:
- ✅ All queries automatically filtered by RLS policies
- ✅ No need to manually add `.eq('user_id', user.id)` (but it's safe to keep)
- ✅ Policies use optimized `(select auth.uid())` pattern for performance

---

## 6. Test Results

**Date**: _______________
**Tester**: _______________

- [ ] Test 1: Create Order
- [ ] Test 2: View Orders in Mobile App
- [ ] Test 3: View Order Details
- [ ] Test 4: Admin Order Management
- [ ] Test 5: RLS Security Test

**Notes**:
_________________________________________________
_________________________________________________
_________________________________________________
