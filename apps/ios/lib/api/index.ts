/**
 * Jose Madrid Salsa - Mobile API Client
 *
 * Barrel export providing a namespaced `api` object and individual module
 * re-exports for tree-shaking. All types from `./types` are also re-exported.
 *
 * @module mobile/lib/api
 *
 * @example Namespaced access (recommended for readability)
 * ```ts
 * import { api } from '@/lib/api';
 * const products = await api.products.getProducts({ featured: 'true' });
 * const session = await api.auth.login({ email, password });
 * ```
 *
 * @example Direct module import (better tree-shaking)
 * ```ts
 * import { products } from '@/lib/api';
 * const salsas = await products.getSalsas();
 * ```
 */

export { API_BASE_URL, ApiError, NetworkError } from './client';

// Re-export all types
export type * from './types';

// Namespace imports for clean API surface
import * as auth from './auth';
import * as products from './products';
import * as cart from './cart';
import * as checkout from './checkout';
import * as orders from './orders';
import * as wishlist from './wishlist';
import * as loyalty from './loyalty';
import * as locations from './locations';
import * as recipes from './recipes';
import * as giftCertificates from './gift-certificates';
import * as account from './account';
import * as fundraisers from './fundraisers';

/**
 * Namespaced API client grouping all endpoint modules.
 *
 * Each property corresponds to a backend domain (auth, products, cart, etc.)
 * and exposes the typed functions for that domain's REST endpoints.
 */
export const api = {
  auth,
  products,
  cart,
  checkout,
  orders,
  wishlist,
  loyalty,
  locations,
  recipes,
  giftCertificates,
  account,
  fundraisers,
} as const;

// Also export individual modules for tree-shaking
export {
  auth,
  products,
  cart,
  checkout,
  orders,
  wishlist,
  loyalty,
  locations,
  recipes,
  giftCertificates,
  account,
  fundraisers,
};
