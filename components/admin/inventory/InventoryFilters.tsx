'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Category {
  id: string;
  name: string;
}

interface InventoryFiltersProps {
  categories: Category[];
}

export function InventoryFilters({ categories }: InventoryFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== 'all') {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete('page'); // Reset pagination on filter change
      router.push(`/admin/inventory?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams('search', search);
  };

  const clearFilters = () => {
    setSearch('');
    router.push('/admin/inventory');
  };

  const hasFilters = searchParams.has('search') || searchParams.has('category') ||
    searchParams.has('stockStatus') || searchParams.has('sort');

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-5">
        <form onSubmit={handleSearch} className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by product name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </form>

        <Select
          defaultValue={searchParams.get('category') || 'all'}
          onValueChange={(value) => updateParams('category', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          defaultValue={searchParams.get('stockStatus') || 'all'}
          onValueChange={(value) => updateParams('stockStatus', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Stock Levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stock Levels</SelectItem>
            <SelectItem value="in_stock">In Stock</SelectItem>
            <SelectItem value="low_stock">Low Stock</SelectItem>
            <SelectItem value="out_of_stock">Out of Stock</SelectItem>
          </SelectContent>
        </Select>

        <Select
          defaultValue={searchParams.get('sort') || 'name_asc'}
          onValueChange={(value) => updateParams('sort', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sort By" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name_asc">Name (A-Z)</SelectItem>
            <SelectItem value="name_desc">Name (Z-A)</SelectItem>
            <SelectItem value="stock_asc">Stock (Low to High)</SelectItem>
            <SelectItem value="stock_desc">Stock (High to Low)</SelectItem>
            <SelectItem value="sku_asc">SKU (A-Z)</SelectItem>
            <SelectItem value="value_desc">Value (High to Low)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="mr-1 h-4 w-4" />
          Clear Filters
        </Button>
      )}
    </div>
  );
}
