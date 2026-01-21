import { getLowStockProducts } from '@/lib/inventory-server';
import { LowStockAlerts } from './low-stock-alerts';

interface LowStockProduct {
  id: string;
  name: string;
  sku: string;
  stock_quantity: number;
  low_stock_threshold: number;
  status: 'out_of_stock' | 'low_stock' | 'in_stock';
}

/**
 * Async Low Stock Alerts - Fetches and displays low stock products
 *
 * Server Component that fetches its own data.
 * Wrap with Suspense for streaming.
 */
export async function LowStockAlertsAsync() {
  let products: LowStockProduct[] = [];

  try {
    products = await getLowStockProducts(5);
  } catch (error) {
    console.error('Failed to fetch low stock products:', error);
    // Return empty products on error
  }

  return <LowStockAlerts products={products} />;
}
