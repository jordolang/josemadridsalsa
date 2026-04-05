/**
 * Recipe catalog endpoints.
 * All recipe endpoints are public.
 */

import { get } from './client';
import type { Recipe } from './types';

/**
 * Fetch all published recipes from the catalog.
 *
 * @returns Array of recipes with ingredients, instructions, and metadata
 */
export async function getRecipes(): Promise<Recipe[]> {
  return get<Recipe[]>('/api/recipes');
}
