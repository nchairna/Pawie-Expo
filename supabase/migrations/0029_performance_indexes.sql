-- Migration: Performance Indexes for Admin Dashboard
-- Description: Adds indexes to optimize common admin queries
-- Author: Claude Code
-- Date: 2026-01-18

-- Products table indexes
CREATE INDEX IF NOT EXISTS idx_products_published ON products(published);
CREATE INDEX IF NOT EXISTS idx_products_family_id ON products(family_id);
CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_base_price ON products(base_price_idr);

-- Orders table indexes
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);

-- Inventory table indexes
CREATE INDEX IF NOT EXISTS idx_inventory_stock ON inventory(stock_quantity);
CREATE INDEX IF NOT EXISTS idx_inventory_updated ON inventory(updated_at DESC);

-- Inventory movements table indexes
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id, created_at DESC);

-- Comment explaining purpose
COMMENT ON INDEX idx_products_published IS 'Optimizes filtering by published status';
COMMENT ON INDEX idx_products_family_id IS 'Optimizes product family lookups';
COMMENT ON INDEX idx_products_updated_at IS 'Optimizes sorting by update time';
COMMENT ON INDEX idx_products_base_price IS 'Optimizes price-based filtering and sorting';
COMMENT ON INDEX idx_orders_status IS 'Optimizes order status filtering';
COMMENT ON INDEX idx_orders_source IS 'Optimizes filtering by order source (one-time vs autoship)';
COMMENT ON INDEX idx_orders_created_at IS 'Optimizes sorting orders by creation date';
COMMENT ON INDEX idx_orders_user_id IS 'Optimizes user order lookups';
COMMENT ON INDEX idx_inventory_stock IS 'Optimizes low stock and out of stock queries';
COMMENT ON INDEX idx_inventory_updated IS 'Optimizes sorting by inventory update time';
COMMENT ON INDEX idx_inventory_movements_product IS 'Optimizes product movement history queries';
