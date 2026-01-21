'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getProducts } from '@/lib/products';
import type { Product, PriceQuote } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Calculator } from 'lucide-react';
import Link from 'next/link';

export default function PricingPreviewPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [isAutoship, setIsAutoship] = useState<boolean>(false);
  const [cartTotalIdr, setCartTotalIdr] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [priceQuote, setPriceQuote] = useState<PriceQuote | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch products
  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoadingProducts(true);
        const data = await getProducts();
        // Only show published products with base_price_idr
        const validProducts = data.filter(
          (p) => p.published && p.base_price_idr !== null
        );
        setProducts(validProducts);
      } catch (err: any) {
        toast.error(`Failed to load products: ${err.message}`);
      } finally {
        setLoadingProducts(false);
      }
    }
    fetchProducts();
  }, []);

  const handleCalculate = async () => {
    if (!selectedProductId) {
      toast.error('Please select a product');
      return;
    }

    const selectedProduct = products.find((p) => p.id === selectedProductId);
    if (!selectedProduct) {
      toast.error('Selected product not found');
      return;
    }

    if (!selectedProduct.base_price_idr) {
      toast.error('Selected product does not have a base price');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc(
        'compute_product_price',
        {
          p_product_id: selectedProductId,
          p_user_id: null,
          p_is_autoship: isAutoship,
          p_quantity: quantity,
          p_cart_total_idr: cartTotalIdr,
          p_coupon_code: null,
        }
      );

      if (rpcError) {
        // Handle specific error messages
        let errorMessage = rpcError.message;
        if (rpcError.message.includes('not published')) {
          errorMessage =
            'Product is not published. Only published products can be priced.';
        } else if (rpcError.message.includes('not found')) {
          errorMessage = 'Product not found in database.';
        } else if (rpcError.message.includes('base_price_idr')) {
          errorMessage =
            'Product does not have a base price set. Please set a price first.';
        }
        throw new Error(errorMessage);
      }

      if (!data) {
        throw new Error('No price data returned from server');
      }

      setPriceQuote(data as PriceQuote);
      setError(null);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to calculate price';
      setError(errorMessage);
      toast.error(errorMessage);
      setPriceQuote(null);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="mb-6">
        <Link
          href="/discounts"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Discounts
        </Link>
        <h1 className="text-3xl font-bold">Pricing Preview Tool</h1>
        <p className="text-muted-foreground mt-2">
          Test pricing scenarios for products with discounts
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Calculate Price
            </CardTitle>
            <CardDescription>
              Select a product and calculate its price with discounts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="product">Product *</Label>
              <Select
                value={selectedProductId}
                onValueChange={setSelectedProductId}
                disabled={loading || loadingProducts}
              >
                <SelectTrigger id="product">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.length === 0 ? (
                    <SelectItem value="__empty__" disabled>
                      {loadingProducts
                        ? 'Loading products...'
                        : 'No published products available'}
                    </SelectItem>
                  ) : (
                    products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                        {product.base_price_idr
                          ? ` - ${formatCurrency(product.base_price_idr)}`
                          : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) =>
                  setQuantity(Math.max(1, parseInt(e.target.value) || 1))
                }
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cart-total">
                Cart Total (Optional)
                <span className="text-xs text-muted-foreground ml-2">
                  For testing min order threshold discounts
                </span>
              </Label>
              <Input
                id="cart-total"
                type="number"
                min="0"
                step="1"
                placeholder="e.g., 200000"
                value={cartTotalIdr ?? ''}
                onChange={(e) =>
                  setCartTotalIdr(
                    e.target.value === ''
                      ? null
                      : parseInt(e.target.value) || null
                  )
                }
                disabled={loading}
              />
            </div>

            <div className="flex items-center space-x-3 rounded-md border p-4">
              <Switch
                id="autoship"
                checked={isAutoship}
                onCheckedChange={setIsAutoship}
                disabled={loading}
              />
              <div className="space-y-1">
                <Label htmlFor="autoship" className="cursor-pointer">
                  Autoship Purchase
                </Label>
                <p className="text-sm text-muted-foreground">
                  Enable to include autoship discounts
                </p>
              </div>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> This preview automatically applies all
                active discounts configured in the system that match the product
                and context (autoship, cart total, time windows).
              </p>
            </div>

            <Button
              onClick={handleCalculate}
              disabled={loading || !selectedProductId || loadingProducts}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Calculating...
                </>
              ) : (
                <>
                  <Calculator className="h-4 w-4 mr-2" />
                  Calculate Price
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results Card */}
        <Card>
          <CardHeader>
            <CardTitle>Price Breakdown</CardTitle>
            <CardDescription>
              Detailed pricing with all discounts applied
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm font-medium text-destructive mb-1">
                  Error
                </p>
                <p className="text-sm text-destructive/80">{error}</p>
              </div>
            )}
            {!priceQuote && !error ? (
              <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
                <Calculator className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Select a product and click "Calculate Price" to see the
                  breakdown
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  The preview will automatically apply all applicable discounts
                  from your discount configuration
                </p>
              </div>
            ) : priceQuote ? (
              <div className="space-y-6">
                {/* Purchase Type Header */}
                <div className="p-4 bg-muted rounded-lg">
                  <h3 className="font-semibold text-lg mb-1">
                    {isAutoship ? 'Autoship Purchase' : 'One-Time Purchase'}
                  </h3>
                  {isAutoship && (
                    <p className="text-sm text-muted-foreground">
                      Includes autoship discounts
                    </p>
                  )}
                </div>

                {/* Base Price */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Base Price:</span>
                    <span className="font-medium">
                      {formatCurrency(priceQuote.base_price_idr)}
                    </span>
                  </div>
                  {priceQuote.discount_total_idr > 0 && (
                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                      <span>Per unit</span>
                      <span>
                        {formatCurrency(
                          priceQuote.base_price_idr / quantity
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* Discounts Applied */}
                {priceQuote.discounts_applied.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">
                      Discounts Applied:
                    </div>
                    <div className="space-y-2 pl-4 border-l-2">
                      {priceQuote.discounts_applied.map((discount, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-sm">
                              {discount.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {discount.type === 'percentage'
                                ? `${discount.value}% off`
                                : `${formatCurrency(discount.value)} off`}
                            </div>
                          </div>
                          <div className="text-destructive font-medium">
                            -{formatCurrency(discount.amount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No discounts applied
                  </div>
                )}

                {/* Total Discount */}
                {priceQuote.discount_total_idr > 0 && (
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-muted-foreground">
                      Total Discount:
                    </span>
                    <span className="font-semibold text-destructive">
                      -{formatCurrency(priceQuote.discount_total_idr)}
                    </span>
                  </div>
                )}

                {/* Final Price */}
                <div className="space-y-2 pt-4 border-t-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Final Price:</span>
                    <span className="text-2xl font-bold">
                      {formatCurrency(priceQuote.final_price_idr)}
                    </span>
                  </div>
                  {quantity > 1 && (
                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                      <span>Per unit</span>
                      <span>
                        {formatCurrency(priceQuote.final_price_idr / quantity)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Line Total */}
                {quantity > 1 && (
                  <div className="pt-4 border-t">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">
                        Line Total ({quantity} ×{' '}
                        {formatCurrency(priceQuote.final_price_idr)}):
                      </span>
                      <span className="text-xl font-bold">
                        {formatCurrency(priceQuote.line_total_idr)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Savings Summary */}
                {priceQuote.discount_total_idr > 0 && (
                  <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-green-800 dark:text-green-200">
                        Total Savings:
                      </span>
                      <span className="text-lg font-bold text-green-700 dark:text-green-300">
                        {formatCurrency(priceQuote.discount_total_idr)}
                      </span>
                    </div>
                    <div className="text-sm text-green-700 dark:text-green-400 mt-1">
                      (
                      {(
                        (priceQuote.discount_total_idr /
                          priceQuote.base_price_idr) *
                        100
                      ).toFixed(1)}
                      % off)
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
