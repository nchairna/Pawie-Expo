import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getProducts, searchProducts } from '@/lib/products';
import { getImageUrl } from '@/lib/images';
import { getAllTags, filterProductsByTags } from '@/lib/tags';
import { computeProductPrice } from '@/lib/pricing';
import { formatPriceIDR } from '@/lib/utils';
import type { Product, ProductTag, PriceQuote } from '@/lib/types';

type LoadingState = 'idle' | 'loading' | 'success' | 'error';

const PRODUCTS_PER_PAGE = 20;

export default function ShopScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // Tag filter state
  const [availableTags, setAvailableTags] = useState<ProductTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);

  // Price computation state (cached by product ID)
  const [priceQuotes, setPriceQuotes] = useState<Record<string, PriceQuote>>({});
  const [loadingPrices, setLoadingPrices] = useState<Set<string>>(new Set());

  const fetchProducts = async (reset: boolean = false) => {
    try {
      setError(null);
      setIsSearching(debouncedSearchQuery.length > 0);
      const currentOffset = reset ? 0 : offset;
      
      let data: Product[];
      
      // Priority: Search > Tag Filter > Regular List
      if (debouncedSearchQuery.trim().length > 0) {
        // Search takes priority
        data = await searchProducts(debouncedSearchQuery, {
          limit: PRODUCTS_PER_PAGE,
          offset: currentOffset,
        });
      } else if (selectedTagIds.length > 0) {
        // Filter by tags
        data = await filterProductsByTags(selectedTagIds, {
          limit: PRODUCTS_PER_PAGE,
          offset: currentOffset,
        });
      } else {
        // Regular product list
        data = await getProducts({
          limit: PRODUCTS_PER_PAGE,
          offset: currentOffset,
        });
      }

      if (reset) {
        setProducts(data);
        setOffset(data.length);
      } else {
        setProducts((prev) => [...prev, ...data]);
        setOffset((prev) => prev + data.length);
      }

      // If we got fewer products than requested, we've reached the end
      setHasMore(data.length === PRODUCTS_PER_PAGE);
      setLoadingState('success');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load products';
      setError(errorMessage);
      setLoadingState('error');
    } finally {
      setIsSearching(false);
    }
  };

  // Fetch tags on mount
  useEffect(() => {
    async function loadTags() {
      try {
        setLoadingTags(true);
        const tags = await getAllTags();
        setAvailableTags(tags);
      } catch (err) {
        console.error('Failed to load tags:', err);
        // Don't show error to user, just log it
      } finally {
        setLoadingTags(false);
      }
    }
    loadTags();
  }, []);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch products on initial mount
  useEffect(() => {
    fetchProducts(true);
  }, []);

  // Compute prices for products (with caching)
  const computePricesForProducts = useCallback(async (productList: Product[]) => {
    // Filter out products that already have price quotes or are currently loading
    const productsToPrice = productList.filter(
      (p) => 
        p.base_price_idr !== null && 
        !priceQuotes[p.id] && 
        !loadingPrices.has(p.id)
    );

    if (productsToPrice.length === 0) {
      return;
    }

    // Mark as loading
    setLoadingPrices((prev) => {
      const next = new Set(prev);
      productsToPrice.forEach((p) => next.add(p.id));
      return next;
    });

    try {
      // Compute prices in parallel (batch)
      const pricePromises = productsToPrice.map(async (product) => {
        try {
          const quote = await computeProductPrice(product.id, false, 1);
          return { productId: product.id, quote };
        } catch (err) {
          console.error(`Failed to compute price for product ${product.id}:`, err);
          return null;
        }
      });

      const results = await Promise.all(pricePromises);

      // Update price quotes cache
      setPriceQuotes((prev) => {
        const next = { ...prev };
        results.forEach((result) => {
          if (result) {
            next[result.productId] = result.quote;
          }
        });
        return next;
      });
    } catch (err) {
      console.error('Failed to compute prices:', err);
    } finally {
      // Remove from loading set
      setLoadingPrices((prev) => {
        const next = new Set(prev);
        productsToPrice.forEach((p) => next.delete(p.id));
        return next;
      });
    }
  }, [priceQuotes, loadingPrices]);

  // Compute prices when products change
  useEffect(() => {
    if (products.length > 0 && loadingState === 'success') {
      computePricesForProducts(products);
    }
  }, [products, loadingState, computePricesForProducts]);

  // Refetch when search query changes
  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    fetchProducts(true);
  }, [debouncedSearchQuery]);

  // Refetch when tag selection changes
  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    fetchProducts(true);
  }, [selectedTagIds]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setOffset(0);
    setHasMore(true);
    await fetchProducts(true);
    setRefreshing(false);
  };

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || loadingState === 'loading') {
      return;
    }

    setLoadingMore(true);
    try {
      await fetchProducts(false);
    } catch (err) {
      console.error('Failed to load more products:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleRetry = () => {
    setLoadingState('loading');
    fetchProducts();
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setDebouncedSearchQuery('');
  };

  const handleTagToggle = (tagId: string) => {
    setSelectedTagIds((prev) => {
      if (prev.includes(tagId)) {
        return prev.filter((id) => id !== tagId);
      } else {
        return [...prev, tagId];
      }
    });
  };

  const handleClearTags = () => {
    setSelectedTagIds([]);
  };

  const handleProductPress = useCallback((productId: string) => {
    router.push(`/product/${productId}`);
  }, []);

  const renderProductItem = useCallback(({ item }: { item: Product }) => {
    const imageUrl = item.primary_image_path
      ? getImageUrl(item.primary_image_path)
      : null;

    const priceQuote = priceQuotes[item.id];
    const isLoadingPrice = loadingPrices.has(item.id);
    const hasDiscount = priceQuote && priceQuote.discount_total_idr > 0;

    return (
      <TouchableOpacity
        onPress={() => handleProductPress(item.id)}
        activeOpacity={0.7}
        style={styles.productItemTouchable}>
        <ThemedView style={styles.productItem} lightColor="#FFFFFF" darkColor="#1C1C1E">
          <View style={styles.productImageContainer}>
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={styles.productImage}
                contentFit="cover"
                placeholderContentFit="cover"
                transition={200}
                onError={() => {
                  // Image load error handled gracefully by expo-image
                  // Falls back to placeholder automatically
                }}
                cachePolicy="memory-disk"
              />
            ) : (
              <ThemedView
                style={[styles.productImage, styles.placeholderImage]}
                lightColor="#E0E0E0"
                darkColor="#2C2C2E">
                <ThemedText style={styles.placeholderText}>No Image</ThemedText>
              </ThemedView>
            )}
            {/* Discount Badge */}
            {hasDiscount && (
              <View style={styles.discountBadge}>
                <ThemedText style={styles.discountBadgeText}>
                  {priceQuote.discounts_applied[0]?.type === 'percentage'
                    ? `${Math.round((priceQuote.discount_total_idr / priceQuote.base_price_idr) * 100)}% OFF`
                    : 'SALE'}
                </ThemedText>
              </View>
            )}
          </View>
          <View style={styles.productInfo}>
            <ThemedText type="defaultSemiBold" style={styles.productName}>
              {item.name}
            </ThemedText>
            {item.category && (
              <ThemedText style={styles.productCategory}>{item.category}</ThemedText>
            )}
            
            {/* Price Display */}
            <View style={styles.priceContainer}>
              {isLoadingPrice ? (
                <ActivityIndicator size="small" style={styles.priceLoader} />
              ) : priceQuote ? (
                <>
                  {hasDiscount ? (
                    <>
                      <ThemedText style={styles.basePriceStrikethrough}>
                        {formatPriceIDR(priceQuote.base_price_idr)}
                      </ThemedText>
                      <ThemedText style={styles.finalPrice}>
                        {formatPriceIDR(priceQuote.final_price_idr)}
                      </ThemedText>
                    </>
                  ) : (
                    <ThemedText style={styles.finalPrice}>
                      {formatPriceIDR(priceQuote.final_price_idr)}
                    </ThemedText>
                  )}
                </>
              ) : item.base_price_idr !== null ? (
                <ThemedText style={styles.finalPrice}>
                  {formatPriceIDR(item.base_price_idr)}
                </ThemedText>
              ) : (
                <ThemedText style={styles.priceUnavailable}>Price unavailable</ThemedText>
              )}
            </View>

            {/* Autoship Savings Indicator - Simple message if eligible */}
            {item.autoship_eligible && hasDiscount && (
              <View style={styles.autoshipSavingsIndicator}>
                <ThemedText style={styles.autoshipSavingsText}>
                  💰 Save more with Autoship
                </ThemedText>
              </View>
            )}

            {item.autoship_eligible && (
              <View style={styles.autoshipBadge}>
                <ThemedText style={styles.autoshipText}>Autoship Eligible</ThemedText>
              </View>
            )}
          </View>
        </ThemedView>
      </TouchableOpacity>
    );
  }, [priceQuotes, loadingPrices, handleProductPress]);

  const keyExtractor = useCallback((item: Product) => item.id, []);

  const getItemLayout = useCallback(
    (_: any, index: number) => {
      // Approximate item height for better performance
      const itemHeight = 250; // Approximate height of product card
      return {
        length: itemHeight,
        offset: itemHeight * Math.floor(index / 2),
        index,
      };
    },
    []
  );

  // Loading state
  if (loadingState === 'loading' && products.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" />
          <ThemedText style={styles.loadingText}>Loading products...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  // Error state
  if (loadingState === 'error' && products.length === 0) {
    const isNetworkError =
      error?.toLowerCase().includes('network') ||
      error?.toLowerCase().includes('fetch') ||
      error?.toLowerCase().includes('connection');
    const isRLSError = error?.toLowerCase().includes('permission') || error?.toLowerCase().includes('access');

    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerContent}>
          <ThemedText type="title" style={styles.errorTitle}>
            {isNetworkError ? 'Connection Error' : isRLSError ? 'Access Denied' : 'Error'}
          </ThemedText>
          <ThemedText style={styles.errorMessage}>
            {isNetworkError
              ? 'Unable to connect to the server. Please check your internet connection.'
              : isRLSError
              ? 'You do not have permission to view this content.'
              : error || 'An unexpected error occurred'}
          </ThemedText>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }


  // Success state with products
  return (
    <ThemedView style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <MaterialIcons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={handleClearSearch}
              style={styles.clearButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialIcons name="close" size={18} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tag Filter */}
      {availableTags.length > 0 && (
        <View style={styles.tagFilterContainer}>
          <View style={styles.tagFilterHeader}>
            <ThemedText type="defaultSemiBold" style={styles.tagFilterTitle}>
              Filter by Category
            </ThemedText>
            {selectedTagIds.length > 0 && (
              <TouchableOpacity onPress={handleClearTags}>
                <ThemedText style={styles.clearTagsText}>Clear</ThemedText>
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            horizontal
            data={availableTags}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isSelected = selectedTagIds.includes(item.id);
              return (
                <TouchableOpacity
                  onPress={() => handleTagToggle(item.id)}
                  style={[
                    styles.tagChip,
                    isSelected && styles.tagChipSelected,
                  ]}>
                  <ThemedText
                    style={[
                      styles.tagChipText,
                      isSelected && styles.tagChipTextSelected,
                    ]}>
                    {item.name}
                  </ThemedText>
                </TouchableOpacity>
              );
            }}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagFilterList}
          />
        </View>
      )}

      <FlatList
        data={products}
        renderItem={renderProductItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        numColumns={2}
        columnWrapperStyle={styles.row}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        removeClippedSubviews={Platform.OS !== 'web'}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={10}
        ListFooterComponent={() => {
          if (!loadingMore || !hasMore) return null;
          return (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" />
              <ThemedText style={styles.footerLoaderText}>
                Loading more products...
              </ThemedText>
            </View>
          );
        }}
        ListEmptyComponent={
          loadingState === 'success' && products.length === 0 ? (
            <View style={styles.centerContent}>
              <ThemedText type="title" style={styles.emptyTitle}>
                {debouncedSearchQuery.length > 0 || selectedTagIds.length > 0
                  ? 'No products found'
                  : 'No products available'}
              </ThemedText>
              <ThemedText style={styles.emptyMessage}>
                {debouncedSearchQuery.length > 0
                  ? `No products match "${debouncedSearchQuery}". Try a different search term.`
                  : selectedTagIds.length > 0
                  ? 'No products match the selected filters. Try different categories.'
                  : 'Check back later for new products'}
              </ThemedText>
              {(debouncedSearchQuery.length > 0 || selectedTagIds.length > 0) && (
                <TouchableOpacity
                  style={styles.clearSearchButton}
                  onPress={() => {
                    handleClearSearch();
                    handleClearTags();
                  }}>
                  <ThemedText style={styles.clearSearchButtonText}>
                    Clear Filters
                  </ThemedText>
                </TouchableOpacity>
              )}
            </View>
          ) : null
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  emptyTitle: {
    marginBottom: 8,
  },
  emptyMessage: {
    textAlign: 'center',
    opacity: 0.7,
  },
  listContent: {
    padding: 12,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  productItemTouchable: {
    flex: 1,
    marginHorizontal: 6,
  },
  productItem: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  productImageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F5F5F5',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E0E0E0',
  },
  placeholderText: {
    opacity: 0.5,
    fontSize: 12,
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 16,
    marginBottom: 4,
  },
  productCategory: {
    fontSize: 14,
    opacity: 0.6,
    marginBottom: 8,
  },
  autoshipBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  autoshipText: {
    fontSize: 10,
    color: '#1976D2',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLoaderText: {
    marginTop: 8,
    fontSize: 14,
    opacity: 0.7,
  },
  searchContainer: {
    padding: 12,
    paddingBottom: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  clearButton: {
    padding: 4,
  },
  tagFilterContainer: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  tagFilterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tagFilterTitle: {
    fontSize: 16,
  },
  clearTagsText: {
    fontSize: 14,
    color: '#007AFF',
  },
  tagFilterList: {
    paddingRight: 12,
  },
  tagChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  tagChipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  tagChipText: {
    fontSize: 14,
    color: '#333',
  },
  tagChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  clearSearchButton: {
    marginTop: 16,
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  clearSearchButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // Price-related styles
  discountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FF3B30',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 1,
  },
  discountBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  priceContainer: {
    marginTop: 8,
    marginBottom: 4,
  },
  priceLoader: {
    marginVertical: 4,
  },
  basePriceStrikethrough: {
    fontSize: 14,
    textDecorationLine: 'line-through',
    opacity: 0.6,
    marginBottom: 2,
  },
  finalPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#34C759',
  },
  priceUnavailable: {
    fontSize: 14,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  autoshipSavingsIndicator: {
    marginTop: 4,
    marginBottom: 4,
  },
  autoshipSavingsText: {
    fontSize: 12,
    color: '#34C759',
    fontWeight: '600',
  },
});
