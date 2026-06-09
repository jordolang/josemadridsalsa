/**
 * Legacy API entrypoint — preserved for backward compatibility with existing screens.
 * New code should import from '@/lib/api/index' instead.
 *
 * @example
 *   import { api } from '@/lib/api';
 *   const products = await api.products.getProducts();
 */

export { API_BASE_URL, api, ApiError, NetworkError } from './api/index';
export type { Product } from './api/types';

// Legacy function used by the storefront screen — delegates to the new module
import { getSalsas } from './api/products';
export const fetchSalsas = getSalsas;
