"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CartItem, Product, ProductSelection } from "@/types";

const CART_STORAGE_KEY = "levien-cart-v1";

type StoreContextValue = {
  cart: CartItem[];
  cartOpen: boolean;
  totalItems: number;
  subtotal: number;
  ready: boolean;
  addProduct: (product: Product, selection?: ProductSelection) => void;
  changeQuantity: (lineId: string, delta: number) => void;
  removeItem: (lineId: string) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

function selectionKey(productId: string, selection: ProductSelection) {
  const toppingIds = (selection.toppings || []).map((item) => item.id).sort().join(",");
  return [productId, selection.ice || "", selection.sugar || "", toppingIds, selection.note?.trim() || ""].join("|");
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) setCart(JSON.parse(stored) as CartItem[]);
    } catch {
      // Ignore invalid local demo data.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart, ready]);

  const addProduct = (product: Product, selection: ProductSelection = {}) => {
    if (product.soldOut) return;
    const quantity = Math.max(1, selection.quantity || 1);
    const toppings = selection.toppings || [];
    const unitPrice = product.price + toppings.reduce((sum, item) => sum + item.price, 0);
    const key = selectionKey(product.id, selection);

    setCart((current) => {
      const existing = current.find((item) => item.lineId.startsWith(`${key}::`));
      if (existing) {
        return current.map((item) => item.lineId === existing.lineId ? { ...item, quantity: item.quantity + quantity } : item);
      }
      return [...current, {
        lineId: `${key}::${Date.now()}`,
        productId: product.id,
        name: product.name,
        basePrice: product.price,
        unitPrice,
        quantity,
        emoji: product.emoji,
        ice: selection.ice,
        sugar: selection.sugar,
        toppings,
        note: selection.note?.trim() || "",
      }];
    });
    setCartOpen(true);
  };

  const changeQuantity = (lineId: string, delta: number) => setCart((current) => current.map((item) => item.lineId === lineId ? { ...item, quantity: item.quantity + delta } : item).filter((item) => item.quantity > 0));
  const removeItem = (lineId: string) => setCart((current) => current.filter((item) => item.lineId !== lineId));
  const clearCart = () => setCart([]);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const value = useMemo(() => ({ cart, cartOpen, totalItems, subtotal, ready, addProduct, changeQuantity, removeItem, clearCart, openCart: () => setCartOpen(true), closeCart: () => setCartOpen(false) }), [cart, cartOpen, totalItems, subtotal, ready]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
}
