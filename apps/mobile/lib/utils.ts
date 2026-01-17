/**
 * Utility functions for the mobile app
 */

/**
 * Format price as Indonesian Rupiah (no decimals)
 */
export function formatPriceIDR(price: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}





