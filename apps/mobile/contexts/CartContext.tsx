/**
 * Cart Context - Simple and Reliable Implementation
 * Phase 4: Orders & Checkout
 */

import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProduct } from '@/lib/products';
import { computeProductPrice } from '@/lib/pricing';

const CART_STORAGE_KEY = '@pawie_cart_v2';

// Types
export interface CartItem {
  product_id: string;
  quantity: number;
  product: {
    name: string;
    primary_image_path: string | null;
    base_price_idr: number;
    sku: string | null;
  };
}

export interface CartPricing {
  items: Array<{
    product_id: string;
    quantity: number;
    base_price_idr: number;
    final_price_idr: number;
    discount_total_idr: number;
    line_total_idr: number;
    discounts_applied: any[];
  }>;
  subtotal_idr: number;
  discount_total_idr: number;
  total_idr: number;
}

// State and Actions
interface CartState {
  items: CartItem[];
  isLoading: boolean;
}

type CartAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ITEMS'; payload: CartItem[] }
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'UPDATE_ITEM'; payload: { product_id: string; quantity: number } }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'CLEAR_CART' };

// Reducer - Pure function for state updates
function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ITEMS':
      return { ...state, items: action.payload, isLoading: false };

    case 'ADD_ITEM': {
      const existingIndex = state.items.findIndex(
        item => item.product_id === action.payload.product_id
      );
      if (existingIndex >= 0) {
        // Update quantity
        const newItems = state.items.map((item, idx) =>
          idx === existingIndex
            ? { ...item, quantity: item.quantity + action.payload.quantity }
            : item
        );
        return { ...state, items: newItems };
      }
      // Add new item
      return { ...state, items: [...state.items, action.payload] };
    }

    case 'UPDATE_ITEM': {
      const newItems = state.items.map(item =>
        item.product_id === action.payload.product_id
          ? { ...item, quantity: action.payload.quantity }
          : item
      );
      return { ...state, items: newItems };
    }

    case 'REMOVE_ITEM': {
      const newItems = state.items.filter(
        item => item.product_id !== action.payload
      );
      return { ...state, items: newItems };
    }

    case 'CLEAR_CART':
      return { ...state, items: [] };

    default:
      return state;
  }
}

// Context
interface CartContextType {
  items: CartItem[];
  itemCount: number;
  isLoading: boolean;
  addItem: (productId: string, quantity?: number) => Promise<void>;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getCartPricing: (isAutoship?: boolean) => Promise<CartPricing>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, {
    items: [],
    isLoading: true,
  });

  // Persist cart to storage whenever items change
  useEffect(() => {
    if (!state.isLoading) {
      AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.items)).catch(
        err => console.error('Failed to save cart:', err)
      );
    }
  }, [state.items, state.isLoading]);

  // Load cart on mount
  useEffect(() => {
    const loadCart = async () => {
      try {
        const stored = await AsyncStorage.getItem(CART_STORAGE_KEY);
        if (stored) {
          const items = JSON.parse(stored) as CartItem[];
          dispatch({ type: 'SET_ITEMS', payload: items });
        } else {
          dispatch({ type: 'SET_ITEMS', payload: [] });
        }
      } catch (error) {
        console.error('Failed to load cart:', error);
        dispatch({ type: 'SET_ITEMS', payload: [] });
      }
    };
    loadCart();
  }, []);

  // Add item
  const addItem = useCallback(async (productId: string, quantity: number = 1) => {
    if (quantity <= 0) return;

    // Check if already in cart
    const existing = state.items.find(item => item.product_id === productId);
    if (existing) {
      dispatch({
        type: 'ADD_ITEM',
        payload: { ...existing, quantity },
      });
      return;
    }

    // Fetch product data for new item
    try {
      const product = await getProduct(productId);
      const cartItem: CartItem = {
        product_id: productId,
        quantity,
        product: {
          name: product.name,
          primary_image_path: product.primary_image_path,
          base_price_idr: product.base_price_idr || 0,
          sku: product.sku,
        },
      };
      dispatch({ type: 'ADD_ITEM', payload: cartItem });
    } catch (error) {
      console.error('Failed to add item:', error);
      throw error;
    }
  }, [state.items]);

  // Remove item
  const removeItem = useCallback((productId: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: productId });
  }, []);

  // Update quantity
  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      dispatch({ type: 'REMOVE_ITEM', payload: productId });
    } else {
      dispatch({ type: 'UPDATE_ITEM', payload: { product_id: productId, quantity } });
    }
  }, []);

  // Clear cart
  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR_CART' });
    AsyncStorage.removeItem(CART_STORAGE_KEY).catch(
      err => console.error('Failed to clear cart storage:', err)
    );
  }, []);

  // Get pricing
  const getCartPricing = useCallback(async (isAutoship: boolean = false): Promise<CartPricing> => {
    if (state.items.length === 0) {
      return {
        items: [],
        subtotal_idr: 0,
        discount_total_idr: 0,
        total_idr: 0,
      };
    }

    const pricingPromises = state.items.map(async (item) => {
      const priceQuote = await computeProductPrice(
        item.product_id,
        isAutoship,
        item.quantity
      );
      return {
        product_id: item.product_id,
        quantity: item.quantity,
        base_price_idr: priceQuote.base_price_idr,
        final_price_idr: priceQuote.final_price_idr,
        discount_total_idr: priceQuote.discount_total_idr,
        line_total_idr: priceQuote.line_total_idr,
        discounts_applied: priceQuote.discounts_applied,
      };
    });

    const itemPricing = await Promise.all(pricingPromises);

    return {
      items: itemPricing,
      subtotal_idr: itemPricing.reduce((sum, item) => sum + item.base_price_idr * item.quantity, 0),
      discount_total_idr: itemPricing.reduce((sum, item) => sum + item.discount_total_idr * item.quantity, 0),
      total_idr: itemPricing.reduce((sum, item) => sum + item.line_total_idr, 0),
    };
  }, [state.items]);

  // Refresh cart (re-fetch product data)
  const refreshCart = useCallback(async () => {
    const refreshedItems = await Promise.all(
      state.items.map(async (item) => {
        try {
          const product = await getProduct(item.product_id);
          return {
            ...item,
            product: {
              name: product.name,
              primary_image_path: product.primary_image_path,
              base_price_idr: product.base_price_idr || 0,
              sku: product.sku,
            },
          };
        } catch {
          return item;
        }
      })
    );
    dispatch({ type: 'SET_ITEMS', payload: refreshedItems });
  }, [state.items]);

  const itemCount = state.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        itemCount,
        isLoading: state.isLoading,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        getCartPricing,
        refreshCart,
      }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
