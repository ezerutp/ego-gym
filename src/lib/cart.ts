import { useSyncExternalStore } from 'react';

import type { Product } from '@/db/products';
import type { CartLine } from '@/db/sales';

let lines: CartLine[] = [];
const listeners = new Set<() => void>();

function emit(next: CartLine[]) {
  lines = next;
  listeners.forEach((l) => l());
}

export const cart = {
  get: () => lines,

  /** Returns false when there is no stock left to add. */
  add(product: Product, quantity = 1) {
    const existing = lines.find((l) => l.productId === product.id);
    const current = existing?.quantity ?? 0;
    if (current + quantity > product.stock) return false;
    if (existing) {
      emit(lines.map((l) => (l.productId === product.id ? { ...l, quantity: current + quantity, maxStock: product.stock } : l)));
    } else {
      emit([
        ...lines,
        {
          productId: product.id,
          name: product.name,
          imageUri: product.image_uri,
          unitPrice: product.price ?? 0,
          quantity,
          maxStock: product.stock,
        },
      ]);
    }
    return true;
  },

  setQuantity(productId: number, quantity: number) {
    if (quantity <= 0) return cart.remove(productId);
    emit(lines.map((l) => (l.productId === productId ? { ...l, quantity: Math.min(quantity, l.maxStock) } : l)));
  },

  setPrice(productId: number, unitPrice: number) {
    emit(lines.map((l) => (l.productId === productId ? { ...l, unitPrice } : l)));
  },

  remove(productId: number) {
    emit(lines.filter((l) => l.productId !== productId));
  },

  clear() {
    emit([]);
  },
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCart() {
  return useSyncExternalStore(subscribe, cart.get, cart.get);
}

export function cartTotal(items: CartLine[]) {
  return items.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
}

export function cartCount(items: CartLine[]) {
  return items.reduce((sum, l) => sum + l.quantity, 0);
}
