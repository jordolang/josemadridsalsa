/**
 * Jose Madrid Salsa - Mobile API Client
 *
 * Usage:
 *   import { api } from '@/lib/api';
 *   const products = await api.products.getProducts({ featured: 'true' });
 *   const session = await api.auth.login({ email, password });
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
