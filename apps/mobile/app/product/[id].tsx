import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DimensionValueButton } from '@/components/product/dimension-value-button';
import { AutoshipSavingsCard } from '@/components/AutoshipSavingsCard';
import { getProductWithDetails } from '@/lib/products';
import { getImageUrl } from '@/lib/images';
import { getFamily } from '@/lib/families';
import { getProductsByFamily } from '@/lib/families';
import {
  findProductByVariantCombination,
  checkValuesAvailability,
  findFirstAvailableCombination,
} from '@/lib/product-variant-values';
import { computeProductPrice } from '@/lib/pricing';
import { formatPriceIDR } from '@/lib/utils';
import type { ProductWithDetails, VariantValue, Product, PriceQuote } from '@/lib/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type LoadingState = 'loading' | 'success' | 'error';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<ProductWithDetails | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [isSwitchingVariant, setIsSwitchingVariant] = useState(false);
  const [pendingVariantValues, setPendingVariantValues] = useState<string[] | null>(null);
  const [availabilityCache, setAvailabilityCache] = useState<Record<string, boolean>>({});
  const carouselRef = useRef<FlatList>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isOptimisticUpdateRef = useRef(false);
  // Ref for immediate visual feedback (0ms delay, synchronous)
  const pendingSelectionRef = useRef<{ dimensionId: string; valueId: string } | null>(null);
  
  // Pricing state
  const [isAutoship, setIsAutoship] = useState(false);
  const [oneTimePriceQuote, setOneTimePriceQuote] = useState<PriceQuote | null>(null);
  const [autoshipPriceQuote, setAutoshipPriceQuote] = useState<PriceQuote | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);

  useEffect(() => {
    if (!id) {
      setError('Product ID is required');
      setLoadingState('error');
      return;
    }

    // Skip refetch if we're doing an optimistic update (prevent remount)
    // This must be checked FIRST before any other logic
    if (isOptimisticUpdateRef.current) {
      isOptimisticUpdateRef.current = false;
      return;
    }

    // Skip refetch if we already have this product loaded
    // Note: product.id might differ from URL param id after optimistic update
    // That's okay - we have the correct product in state
    if (product && product.id === id && loadingState === 'success') {
      return;
    }

    const fetchProduct = async () => {
      try {
        setError(null);
        setLoadingState('loading');
        const data = await getProductWithDetails(id);
        setProduct(data);
        setLoadingState('success');

        // Fetch related products if product has a family
        if (data.family_id) {
          setLoadingRelated(true);
          try {
            const related = await getProductsByFamily(data.family_id);
            // Filter out current product
            const filtered = related.filter((p) => p.id !== id);
            setRelatedProducts(filtered);
          } catch (err) {
            console.error('Failed to load related products:', err);
            // Don't fail the whole page if related products fail
          } finally {
            setLoadingRelated(false);
          }
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to load product';
        setError(errorMessage);
        setLoadingState('error');
      }
    };

    fetchProduct();
  }, [id, product, loadingState]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/(tabs)/shop');
    }
  };

  // Optimistic UI variant switching
  const switchToProductVariant = useCallback(async (
    dimensionId: string,
    selectedValueId: string
  ) => {
    if (!product || !product.family || !product.family_id) {
      return;
    }

    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Get current variant values, but replace the one for this dimension
    const currentValueIds = product.variant_values.map((vv) => vv.id);
    const dimensionValueIds = product.variant_values
      .filter((vv) => {
        // Find which dimension this value belongs to
        const dimension = product.family?.dimensions.find(
          (dim) => dim.values.some((val) => val.id === vv.id)
        );
        return dimension?.id === dimensionId;
      })
      .map((vv) => vv.id);

    // Replace the value for this dimension with the selected one
    const newValueIds = currentValueIds.map((id) => {
      if (dimensionValueIds.includes(id)) {
        return selectedValueId;
      }
      return id;
    });

    // Check if the selected value is already the current one
    // Check ref first (for instant feedback), then check product variant values
    if (pendingSelectionRef.current?.dimensionId === dimensionId && 
        pendingSelectionRef.current?.valueId === selectedValueId) {
      return; // Already selected (from ref)
    }
    if (dimensionValueIds.includes(selectedValueId)) {
      return; // Already selected (from product variant values)
    }

    // 1. INSTANTANEOUS optimistic UI update (synchronous, 0ms delay)
    // Set ref FIRST for immediate visual feedback (before any async operations)
    pendingSelectionRef.current = { dimensionId, valueId: selectedValueId };
    
    // Then update state (triggers re-render, but ref is already set)
    // Note: We set isSwitchingVariant AFTER ref to allow rapid clicks (abort controller handles cancellation)
    setPendingVariantValues(newValueIds);
    setIsSwitchingVariant(true);

    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // 2. Find product with this variant combination
      const foundProduct = await findProductByVariantCombination(
        product.family_id,
        newValueIds
      );

      // Check if request was aborted
      if (abortController.signal.aborted) {
        return;
      }

      if (!foundProduct) {
        // Smart switching: Try to find first available combination
        // Build current selections map (excluding the dimension being changed)
        const currentSelections: Record<string, string> = {};
        product.family?.dimensions.forEach((dim) => {
          // Skip the dimension being changed
          if (dim.id === dimensionId) {
            return;
          }
          const currentValue = product.variant_values.find((vv) => {
            return dim.values.some((val) => val.id === vv.id);
          });
          if (currentValue) {
            currentSelections[dim.id] = currentValue.id;
          }
        });

        const availableCombination = await findFirstAvailableCombination(
          product.family_id,
          dimensionId,
          selectedValueId,
          currentSelections
        );

        // Check if request was aborted
        if (abortController.signal.aborted) {
          return;
        }

        if (!availableCombination) {
          // No available combination - revert optimistic update
          setPendingVariantValues(null);
          pendingSelectionRef.current = null;
          setIsSwitchingVariant(false);
          // Could show toast here: "This combination is not available"
          return;
        }

        // Found available combination - use it instead
        const availableProduct = await findProductByVariantCombination(
          product.family_id,
          availableCombination
        );

        if (!availableProduct || abortController.signal.aborted) {
          setPendingVariantValues(null);
          pendingSelectionRef.current = null;
          setIsSwitchingVariant(false);
          return;
        }

        // Continue with the available product
        const newProductData = await getProductWithDetails(availableProduct.id);

        if (abortController.signal.aborted) {
          return;
        }

        // Set flag and update state
        isOptimisticUpdateRef.current = true;

        setProduct((prevProduct) => {
          if (!prevProduct) return newProductData;

          return {
            ...prevProduct,
            id: newProductData.id,
            name: newProductData.name,
            base_price_idr: newProductData.base_price_idr,
            sku: newProductData.sku,
            primary_image_path: newProductData.primary_image_path,
            images: newProductData.images,
            description: newProductData.description,
            tags: newProductData.tags,
            variant_values: newProductData.variant_values,
            family: prevProduct.family,
          };
        });

        // Update URL on web
        if (typeof window !== 'undefined' && window.history) {
          const newUrl = `/product/${availableProduct.id}`;
          window.history.replaceState(
            { ...window.history.state, as: newUrl, url: newUrl },
            '',
            newUrl
          );
        }

        setCurrentImageIndex(0);
        setTimeout(() => {
          carouselRef.current?.scrollToIndex({ index: 0, animated: false });
        }, 0);

        // Update availability cache for new selections (immediate for smooth UX)
        updateAvailabilityCache(newProductData.variant_values);

        setPendingVariantValues(null);
        pendingSelectionRef.current = null;
        setIsSwitchingVariant(false);
        return;
      }

      // 3. Fetch new product data in background
      const newProductData = await getProductWithDetails(foundProduct.id);

      // Check if request was aborted
      if (abortController.signal.aborted) {
        return;
      }

      // 4. Set flag to prevent useEffect from refetching
      isOptimisticUpdateRef.current = true;

      // 5. Partial state update - update product title, price, images, and other fields
      setProduct((prevProduct) => {
        if (!prevProduct) return newProductData;
        
        return {
          ...prevProduct,
          // Update product title
          id: newProductData.id,
          name: newProductData.name,
          // Update price and SKU
          base_price_idr: newProductData.base_price_idr,
          sku: newProductData.sku,
          // Update images (carousel will update automatically)
          primary_image_path: newProductData.primary_image_path,
          images: newProductData.images,
          // Update other fields
          description: newProductData.description,
          tags: newProductData.tags,
          variant_values: newProductData.variant_values,
          // Keep family and related products intact
          family: prevProduct.family,
        };
      });

      // 6. Update URL on web only (Chewy-style)
      // Web: Use History API to update URL without triggering expo-router navigation/remount
      // iOS/Android: Skip URL update - prioritize smooth UX over URL sync
      if (typeof window !== 'undefined' && window.history) {
        const newUrl = `/product/${foundProduct.id}`;
        window.history.replaceState(
          { ...window.history.state, as: newUrl, url: newUrl },
          '',
          newUrl
        );
      }

      // 7. Reset image carousel to first image (after images update)
      setCurrentImageIndex(0);
      // Use setTimeout to ensure images state has updated
      setTimeout(() => {
        carouselRef.current?.scrollToIndex({ index: 0, animated: false });
      }, 0);

      // 8. Update availability cache for new selections (immediate for smooth UX)
      updateAvailabilityCache(newProductData.variant_values);

      // 9. Clear pending state
      setPendingVariantValues(null);
      pendingSelectionRef.current = null;
      setIsSwitchingVariant(false);
    } catch (err) {
      // Check if request was aborted
      if (abortController.signal.aborted) {
        return;
      }

      // Error handling - revert optimistic update
      setPendingVariantValues(null);
      pendingSelectionRef.current = null;
      setIsSwitchingVariant(false);
      console.error('Failed to switch variant:', err);
      // Could show error toast here
    } finally {
      abortControllerRef.current = null;
    }
  }, [product, isSwitchingVariant]);

  // Update availability cache based on current selections
  // Unified logic: all dimensions treated the same
  const updateAvailabilityCache = useCallback(
    async (currentVariantValues: VariantValue[]) => {
      if (!product?.family_id || !product.family) {
        return;
      }

      try {
        // Build current selections map
        const currentSelections: Record<string, string> = {};
        product.family.dimensions.forEach((dim) => {
          const currentValue = currentVariantValues.find((vv) => {
            return dim.values.some((val) => val.id === vv.id);
          });
          if (currentValue) {
            currentSelections[dim.id] = currentValue.id;
          }
        });

        // Check availability for ALL dimensions (unified logic)
        const newCache: Record<string, boolean> = {};

        for (const dimension of product.family.dimensions) {
          // Build selections excluding current dimension
          const selectionsWithoutCurrent: Record<string, string> = {
            ...currentSelections,
          };
          delete selectionsWithoutCurrent[dimension.id];

          // Check all values in this dimension
          const valueIds = dimension.values.map((v) => v.id);
          const availability = await checkValuesAvailability(
            product.family_id!,
            dimension.id,
            valueIds,
            selectionsWithoutCurrent
          );

          // Merge into cache
          Object.assign(newCache, availability);
        }

        setAvailabilityCache(newCache);
      } catch (err) {
        console.error('Failed to update availability cache:', err);
      }
    },
    [product?.family_id, product?.family]
  );

  // Load availability cache on mount and when product/family changes
  useEffect(() => {
    if (product?.family_id && product?.family && product?.variant_values && loadingState === 'success') {
      updateAvailabilityCache(product.variant_values);
    }
  }, [product?.family_id, product?.family?.id, product?.variant_values, loadingState, updateAvailabilityCache]);

  // Compute prices when product changes
  useEffect(() => {
    if (!product || !product.base_price_idr) {
      return;
    }

    const computePrices = async () => {
      setLoadingPrice(true);
      try {
        const [oneTime, autoship] = await Promise.all([
          computeProductPrice(product.id, false, 1),
          product.autoship_eligible
            ? computeProductPrice(product.id, true, 1)
            : Promise.resolve(null),
        ]);
        setOneTimePriceQuote(oneTime);
        setAutoshipPriceQuote(autoship);
      } catch (err) {
        console.error('Failed to compute prices:', err);
      } finally {
        setLoadingPrice(false);
      }
    };

    computePrices();
  }, [product?.id, product?.base_price_idr, product?.autoship_eligible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      pendingSelectionRef.current = null;
    };
  }, []);

  // Get current value for a dimension (with optimistic update support)
  // INSTANT: Checks ref FIRST (synchronous, 0ms delay) before state
  const getCurrentValueForDimension = useCallback((dimensionId: string): VariantValue | null => {
    if (!product || !product.variant_values) {
      return null;
    }

    // INSTANT: Check ref FIRST (synchronous, 0ms delay - highest priority)
    if (pendingSelectionRef.current?.dimensionId === dimensionId && product.family) {
      const dimension = product.family.dimensions.find((dim) => dim.id === dimensionId);
      if (dimension) {
        const value = dimension.values.find((val) => val.id === pendingSelectionRef.current!.valueId);
        if (value) {
          return value;
        }
      }
    }

    // Fallback: If we have pending variant values (optimistic update), use those
    if (pendingVariantValues && product.family) {
      const dimension = product.family.dimensions.find((dim) => dim.id === dimensionId);
      if (dimension) {
        const pendingValueId = pendingVariantValues.find((valueId) => {
          return dimension.values.some((val) => val.id === valueId);
        });
        if (pendingValueId) {
          return dimension.values.find((val) => val.id === pendingValueId) || null;
        }
      }
    }

    // Finally: use actual product variant values
    const dimension = product.family?.dimensions.find(
      (dim) => dim.id === dimensionId
    );
    if (!dimension) {
      return null;
    }

    return (
      product.variant_values.find((vv) =>
        dimension.values.some((val) => val.id === vv.id)
      ) || null
    );
  }, [product, pendingVariantValues]);

  // Memoized button states for performance (pre-compute selection/availability)
  const dimensionButtonStates = useMemo(() => {
    if (!product?.family) return {};
    
    const states: Record<string, Record<string, { isSelected: boolean; isAvailable: boolean }>> = {};
    
    product.family.dimensions.forEach((dimension) => {
      const currentValue = getCurrentValueForDimension(dimension.id);
      states[dimension.id] = {};
      
      dimension.values.forEach((value) => {
        const isSelected = currentValue?.id === value.id;
        const isAvailable = availabilityCache[value.id] !== false;
        states[dimension.id][value.id] = { isSelected, isAvailable };
      });
    });
    
    return states;
  }, [product?.family, getCurrentValueForDimension, availabilityCache, pendingVariantValues]);

  // Loading state
  if (loadingState === 'loading') {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" />
          <ThemedText style={styles.loadingText}>Loading product...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  // Error state
  if (loadingState === 'error') {
    const isNotFound = error?.includes('not found') || error?.includes('not published');
    const isNetworkError =
      error?.toLowerCase().includes('network') ||
      error?.toLowerCase().includes('fetch') ||
      error?.toLowerCase().includes('connection');
    const isRLSError = error?.toLowerCase().includes('permission') || error?.toLowerCase().includes('access');
    
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <ThemedText style={styles.backButtonText}>← Back</ThemedText>
          </TouchableOpacity>
        </View>
        <View style={styles.centerContent}>
          <ThemedText type="title" style={styles.errorTitle}>
            {isNotFound
              ? 'Product Not Found'
              : isNetworkError
              ? 'Connection Error'
              : isRLSError
              ? 'Access Denied'
              : 'Error'}
          </ThemedText>
          <ThemedText style={styles.errorMessage}>
            {isNotFound
              ? 'This product is not available or does not exist.'
              : isNetworkError
              ? 'Unable to connect to the server. Please check your internet connection.'
              : isRLSError
              ? 'You do not have permission to view this product.'
              : error || 'An unexpected error occurred'}
          </ThemedText>
          <View style={styles.errorActions}>
            {!isNotFound && (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => {
                  setLoadingState('loading');
                  setError(null);
                  if (id) {
                    // Retry fetch
                    getProductWithDetails(id)
                      .then((data) => {
                        setProduct(data);
                        setLoadingState('success');
                      })
                      .catch((err) => {
                        const errorMessage =
                          err instanceof Error ? err.message : 'Failed to load product';
                        setError(errorMessage);
                        setLoadingState('error');
                      });
                  }
                }}>
                <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.backToShopButton}
              onPress={() => router.push('/(tabs)/shop')}>
              <ThemedText style={styles.backToShopButtonText}>Back to Shop</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </ThemedView>
    );
  }

  // Success state
  if (!product) {
    return null;
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ThemedText style={styles.backButtonText}>← Back</ThemedText>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Images Carousel */}
        <View style={styles.section}>
          {product.images && product.images.length > 0 ? (
            <>
              <View style={styles.imageCarouselContainer}>
                <FlatList
                  ref={carouselRef}
                  key={`images-${product.id}`}
                  data={product.images}
                  renderItem={({ item }) => {
                    const imageUrl = getImageUrl(item.path);
                    return (
                      <View style={styles.imageContainer}>
                        <Image
                          source={{ uri: imageUrl }}
                          style={styles.carouselImage}
                          contentFit="cover"
                          transition={200}
                          cachePolicy="memory-disk"
                          onError={() => {
                            // Image load error handled gracefully by expo-image
                            // Falls back to placeholder automatically
                          }}
                        />
                      </View>
                    );
                  }}
                  keyExtractor={(item) => item.id}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(event) => {
                    const index = Math.round(
                      event.nativeEvent.contentOffset.x / SCREEN_WIDTH
                    );
                    setCurrentImageIndex(index);
                  }}
                  getItemLayout={(_, index) => ({
                    length: SCREEN_WIDTH,
                    offset: SCREEN_WIDTH * index,
                    index,
                  })}
                />
                {/* Loading overlay for variant switching */}
                {isSwitchingVariant && (
                  <View style={styles.imageLoadingOverlay}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                )}
              </View>
              {/* Image Indicators */}
              {product.images.length > 1 && (
                <View style={styles.indicatorContainer}>
                  {product.images.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.indicator,
                        index === currentImageIndex && styles.indicatorActive,
                      ]}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={styles.placeholderImageContainer}>
              {product.primary_image_path ? (
                      <Image
                        source={{ uri: getImageUrl(product.primary_image_path) }}
                        style={styles.placeholderImage}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        onError={() => {
                          // Image load error handled gracefully
                        }}
                      />
              ) : (
                <ThemedView
                  style={styles.placeholderImage}
                  lightColor="#E0E0E0"
                  darkColor="#2C2C2E">
                  <ThemedText style={styles.placeholderImageText}>
                    No Image Available
                  </ThemedText>
                </ThemedView>
              )}
            </View>
          )}
        </View>

        {/* Product Name */}
        <ThemedText type="title" style={styles.productName}>
          {product.name}
        </ThemedText>

        {/* SKU */}
        {product.sku && (
          <ThemedText style={styles.sku}>
            SKU: {product.sku}
          </ThemedText>
        )}

        {/* Price Breakdown Section */}
        {product.base_price_idr !== null && product.base_price_idr !== undefined && (
          <View style={styles.section}>
            {/* Purchase Type Toggle */}
            {product.autoship_eligible && (
              <View style={styles.purchaseTypeToggle}>
                <TouchableOpacity
                  style={[
                    styles.toggleOption,
                    !isAutoship && styles.toggleOptionActive,
                  ]}
                  onPress={() => setIsAutoship(false)}>
                  <ThemedText
                    style={[
                      styles.toggleOptionText,
                      !isAutoship && styles.toggleOptionTextActive,
                    ]}>
                    One-Time Purchase
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleOption,
                    isAutoship && styles.toggleOptionActive,
                  ]}
                  onPress={() => setIsAutoship(true)}>
                  <ThemedText
                    style={[
                      styles.toggleOptionText,
                      isAutoship && styles.toggleOptionTextActive,
                    ]}>
                    Autoship
                  </ThemedText>
                </TouchableOpacity>
              </View>
            )}

            {/* Price Breakdown Card */}
            {loadingPrice ? (
              <View style={styles.priceCard}>
                <ActivityIndicator size="small" />
                <ThemedText style={styles.loadingPriceText}>
                  Calculating price...
                </ThemedText>
              </View>
            ) : (
              (() => {
                const currentQuote = isAutoship ? autoshipPriceQuote : oneTimePriceQuote;
                if (!currentQuote) {
                  return (
                    <View style={styles.priceCard}>
                      <ThemedText style={styles.priceUnavailable}>
                        Price unavailable
                      </ThemedText>
                    </View>
                  );
                }

                const hasDiscount = currentQuote.discount_total_idr > 0;
                const savingsPercentage = hasDiscount
                  ? Math.round((currentQuote.discount_total_idr / currentQuote.base_price_idr) * 100)
                  : 0;

                return (
                  <ThemedView style={styles.priceCard} lightColor="#F5F5F5" darkColor="#2C2C2E">
                    {isAutoship && (
                      <ThemedText type="defaultSemiBold" style={styles.priceCardTitle}>
                        Autoship (Save {savingsPercentage}% every order!)
                      </ThemedText>
                    )}
                    {!isAutoship && (
                      <ThemedText type="defaultSemiBold" style={styles.priceCardTitle}>
                        One-Time Purchase
                      </ThemedText>
                    )}

                    <View style={styles.priceBreakdown}>
                      <View style={styles.priceRow}>
                        <ThemedText style={styles.priceLabel}>Base Price:</ThemedText>
                        <ThemedText
                          style={[
                            styles.priceValue,
                            hasDiscount && styles.priceValueStrikethrough,
                          ]}>
                          {formatPriceIDR(currentQuote.base_price_idr)}
                        </ThemedText>
                      </View>

                      {hasDiscount && currentQuote.discounts_applied.length > 0 && (
                        <>
                          {currentQuote.discounts_applied.map((discount, index) => (
                            <View key={index} style={styles.priceRow}>
                              <ThemedText style={styles.discountLabel}>
                                {discount.name}:
                              </ThemedText>
                              <ThemedText style={styles.discountValue}>
                                -{formatPriceIDR(discount.amount)}
                                {discount.type === 'percentage' && ` (${discount.value}%)`}
                              </ThemedText>
                            </View>
                          ))}
                        </>
                      )}

                      <View style={[styles.priceRow, styles.finalPriceRow]}>
                        <ThemedText type="defaultSemiBold" style={styles.finalPriceLabel}>
                          Final Price:
                        </ThemedText>
                        <ThemedText type="defaultSemiBold" style={styles.finalPriceValue}>
                          {formatPriceIDR(currentQuote.final_price_idr)}
                        </ThemedText>
                      </View>

                      {hasDiscount && (
                        <View style={styles.savingsRow}>
                          <ThemedText style={styles.savingsText}>
                            Total Savings: {formatPriceIDR(currentQuote.discount_total_idr)} ({savingsPercentage}%)
                          </ThemedText>
                        </View>
                      )}
                    </View>
                  </ThemedView>
                );
              })()
            )}
          </View>
        )}

        {/* Autoship Savings Card */}
        {product.autoship_eligible &&
          oneTimePriceQuote &&
          autoshipPriceQuote &&
          oneTimePriceQuote.final_price_idr > autoshipPriceQuote.final_price_idr && (
            <View style={styles.section}>
              <AutoshipSavingsCard
                basePrice={oneTimePriceQuote.base_price_idr}
                autoshipPrice={autoshipPriceQuote.final_price_idr}
                savingsPercentage={Math.round(
                  ((oneTimePriceQuote.final_price_idr - autoshipPriceQuote.final_price_idr) /
                    oneTimePriceQuote.final_price_idr) *
                    100
                )}
                savingsAmount={
                  oneTimePriceQuote.final_price_idr - autoshipPriceQuote.final_price_idr
                }
                onEnrollPress={() => {
                  // TODO: Navigate to autoship enrollment (Phase 5)
                  console.log('Navigate to autoship enrollment');
                }}
              />
            </View>
          )}

        {/* Category and Autoship Badge */}
        <View style={styles.metaRow}>
          {product.category && (
            <ThemedText style={styles.category}>{product.category}</ThemedText>
          )}
          {product.autoship_eligible && (
            <View style={styles.autoshipBadge}>
              <ThemedText style={styles.autoshipText}>Autoship Eligible</ThemedText>
            </View>
          )}
        </View>

        {/* Variant Dimension Selectors */}
        {product.family && product.family.dimensions.length > 0 && (
          <View style={styles.section}>
            {product.family.dimensions.map((dimension) => {
              const currentValue = getCurrentValueForDimension(dimension.id);

              // Show all values for all dimensions (unified logic - no filtering)
              return (
                <View key={dimension.id} style={styles.dimensionSection}>
                  <ThemedText type="defaultSemiBold" style={styles.dimensionLabel}>
                    {dimension.name}: {currentValue?.value || '—'}
                  </ThemedText>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.dimensionValuesContainer}>
                    {dimension.values.map((value) => {
                      // Calculate selection directly using getCurrentValueForDimension (checks ref first)
                      const currentValue = getCurrentValueForDimension(dimension.id);
                      const isSelected = currentValue?.id === value.id;
                      
                      // Use memoized availability state for performance
                      const isAvailable = dimensionButtonStates[dimension.id]?.[value.id]?.isAvailable !== false;
                      const isUnavailable = !isAvailable;

                      return (
                        <DimensionValueButton
                          key={value.id}
                          value={value}
                          dimensionId={dimension.id}
                          isSelected={isSelected}
                          isUnavailable={isUnavailable}
                          onPress={() => switchToProductVariant(dimension.id, value.id)}
                        />
                      );
                    })}
                  </ScrollView>
                </View>
              );
            })}
          </View>
        )}

        {/* Description */}
        {product.description && (
          <View style={styles.section}>
            <ThemedText style={styles.description}>{product.description}</ThemedText>
          </View>
        )}

        {/* Tags */}
        {product.tags && product.tags.length > 0 && (
          <View style={styles.section}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              Tags
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tagsContainer}>
              {product.tags.map((tag) => (
                <View key={tag.id} style={styles.tag}>
                  <ThemedText style={styles.tagText}>{tag.name}</ThemedText>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Related Products Section */}
        {product.family_id && relatedProducts.length > 0 && (
          <View style={styles.section}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              Other Options in This Family
            </ThemedText>
            {loadingRelated ? (
              <ActivityIndicator size="small" style={styles.relatedProductsLoading} />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.relatedProductsContainer}>
                {relatedProducts.map((relatedProduct) => (
                  <TouchableOpacity
                    key={relatedProduct.id}
                    style={styles.relatedProductCard}
                    onPress={() => router.push(`/product/${relatedProduct.id}`)}>
                    {relatedProduct.primary_image_path ? (
                      <Image
                        source={{ uri: getImageUrl(relatedProduct.primary_image_path) }}
                        style={styles.relatedProductImage}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        onError={() => {
                          // Image load error handled gracefully
                        }}
                      />
                    ) : (
                      <ThemedView
                        style={styles.relatedProductImagePlaceholder}
                        lightColor="#E0E0E0"
                        darkColor="#2C2C2E">
                        <ThemedText style={styles.relatedProductImagePlaceholderText}>
                          No Image
                        </ThemedText>
                      </ThemedView>
                    )}
                    <ThemedText
                      style={styles.relatedProductName}
                      numberOfLines={2}>
                      {relatedProduct.name}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    opacity: 0.7,
  },
  errorTitle: {
    marginBottom: 8,
  },
  errorMessage: {
    marginBottom: 24,
    textAlign: 'center',
    opacity: 0.7,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  backToShopButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backToShopButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 16,
  },
  productName: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 8,
  },
  category: {
    fontSize: 16,
    opacity: 0.6,
  },
  autoshipBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  autoshipText: {
    fontSize: 10,
    color: '#1976D2',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.8,
  },
  tagsContainer: {
    marginTop: 8,
  },
  tag: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  tagText: {
    fontSize: 14,
  },
  placeholderText: {
    fontSize: 14,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  imageCarouselContainer: {
    position: 'relative',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    backgroundColor: '#F5F5F5',
  },
  carouselImage: {
    width: '100%',
    height: '100%',
  },
  imageLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CCCCCC',
  },
  indicatorActive: {
    backgroundColor: '#007AFF',
    width: 24,
  },
  placeholderImageContainer: {
    width: '100%',
    aspectRatio: 1,
    marginTop: 8,
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderImageText: {
    opacity: 0.5,
    fontSize: 14,
  },
  sku: {
    fontSize: 14,
    fontFamily: 'monospace',
    opacity: 0.6,
  },
  dimensionSection: {
    marginBottom: 20,
  },
  dimensionLabel: {
    fontSize: 16,
    marginBottom: 12,
  },
  dimensionValuesContainer: {
    marginTop: 8,
  },
  relatedProductsContainer: {
    marginTop: 8,
  },
  relatedProductsLoading: {
    marginVertical: 20,
  },
  relatedProductCard: {
    width: 120,
    marginRight: 12,
  },
  relatedProductImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  relatedProductImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  relatedProductImagePlaceholderText: {
    fontSize: 12,
    opacity: 0.5,
  },
  relatedProductName: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  // Price breakdown styles
  purchaseTypeToggle: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  toggleOptionActive: {
    backgroundColor: '#007AFF',
  },
  toggleOptionText: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.7,
  },
  toggleOptionTextActive: {
    color: '#FFFFFF',
    opacity: 1,
    fontWeight: '600',
  },
  priceCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  loadingPriceText: {
    marginTop: 8,
    fontSize: 14,
    opacity: 0.7,
  },
  priceCardTitle: {
    fontSize: 16,
    marginBottom: 12,
  },
  priceBreakdown: {
    gap: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  priceValueStrikethrough: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  discountLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  discountValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#34C759',
  },
  finalPriceRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  finalPriceLabel: {
    fontSize: 18,
  },
  finalPriceValue: {
    fontSize: 20,
    color: '#007AFF',
  },
  savingsRow: {
    marginTop: 8,
    paddingTop: 8,
  },
  savingsText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
  },
  priceUnavailable: {
    fontSize: 14,
    opacity: 0.6,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
});

