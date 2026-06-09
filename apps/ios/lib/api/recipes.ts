import { get } from './client';
import type { Recipe } from './types';

export async function getRecipes(params?: { featured?: string, category?: string }): Promise<Recipe[]> {
  return get<Recipe[]>('/api/recipes', params);
}
