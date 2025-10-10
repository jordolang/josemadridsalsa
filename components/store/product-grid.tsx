"use client";

import { useState, useMemo } from "react";
import { ProductCard } from "./product-card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Filter, Grid3X3, List, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  category: string;
  heatLevel: "MILD" | "MEDIUM" | "HOT" | "EXTRA_HOT";
  inStock: boolean;
  featured: boolean;
  rating?: number;
  reviewCount?: number;
  tags?: string[];
}

interface ProductGridProps {
  products: Product[];
  title?: string;
  description?: string;
  showFilters?: boolean;
  showSearch?: boolean;
  showSort?: boolean;
  showViewToggle?: boolean;
  columns?: 2 | 3 | 4 | 5;
  className?: string;
  onProductClick?: (product: Product) => void;
}

const heatLevelFilters = [
  { value: "all", label: "All Heat Levels", color: "" },
  { value: "MILD", label: "Mild", color: "bg-verde-100 text-verde-800" },
  { value: "MEDIUM", label: "Medium", color: "bg-chile-100 text-chile-800" },
  { value: "HOT", label: "Hot", color: "bg-salsa-100 text-salsa-800" },
  { value: "EXTRA_HOT", label: "Extra Hot", color: "bg-salsa-200 text-salsa-900" },
];

const categoryFilters = [
  { value: "all", label: "All Categories" },
  { value: "mild", label: "Mild & Sweet" },
  { value: "medium", label: "Medium Heat" },
  { value: "hot", label: "Hot & Spicy" },
  { value: "gourmet", label: "Gourmet Fruit" },
];

const sortOptions = [
  { value: "featured", label: "Featured" },
  { value: "name", label: "Name A-Z" },
  { value: "price-low", label: "Price Low to High" },
  { value: "price-high", label: "Price High to Low" },
  { value: "rating", label: "Highest Rated" },
  { value: "newest", label: "Newest" },
];

export function ProductGrid({
  products,
  title = "Our Premium Salsas",
  description = "Handcrafted with the finest ingredients for authentic flavor",
  showFilters = true,
  showSearch = true,
  showSort = true,
  showViewToggle = false,
  columns = 3,
  className,
  onProductClick,
}: ProductGridProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedHeatLevel, setSelectedHeatLevel] = useState("all");
  const [sortBy, setSortBy] = useState("featured");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showOnlyInStock, setShowOnlyInStock] = useState(false);

  const filteredAndSortedProducts = useMemo(() => {
    let filtered = products;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter((product) =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Category filter
    if (selectedCategory !== "all") {
      filtered = filtered.filter((product) => 
        product.category.toLowerCase() === selectedCategory
      );
    }

    // Heat level filter
    if (selectedHeatLevel !== "all") {
      filtered = filtered.filter((product) => 
        product.heatLevel === selectedHeatLevel
      );
    }

    // Stock filter
    if (showOnlyInStock) {
      filtered = filtered.filter((product) => product.inStock);
    }

    // Sort products
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "price-low":
          return a.price - b.price;
        case "price-high":
          return b.price - a.price;
        case "rating":
          return (b.rating || 0) - (a.rating || 0);
        case "newest":
          return 0; // Would need a createdAt field
        case "featured":
        default:
          return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
      }
    });

    return filtered;
  }, [products, searchQuery, selectedCategory, selectedHeatLevel, sortBy, showOnlyInStock]);

  const activeFiltersCount = [
    selectedCategory !== "all",
    selectedHeatLevel !== "all", 
    showOnlyInStock,
    searchQuery.length > 0,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedHeatLevel("all");
    setShowOnlyInStock(false);
  };

  const gridColumns = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
  };

  return (
    <div className={cn("space-y-8", className)}>
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4 text-gradient">
          {title}
        </h2>
        <p className="text-lg text-gray-600">
          {description}
        </p>
      </div>

      {/* Controls */}
      {(showSearch || showFilters || showSort || showViewToggle) && (
        <div className="space-y-4 lg:space-y-0 lg:flex lg:items-center lg:justify-between lg:gap-4">
          {/* Left side - Search */}
          {showSearch && (
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="search"
                placeholder="Search salsas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 focus:ring-salsa-500 focus:border-salsa-500"
              />
            </div>
          )}

          {/* Right side - Filters and Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Filters */}
            {showFilters && (
              <div className="flex flex-wrap items-center gap-2">
                {/* Category Filter */}
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryFilters.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Heat Level Filter */}
                <Select value={selectedHeatLevel} onValueChange={setSelectedHeatLevel}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Heat Level" />
                  </SelectTrigger>
                  <SelectContent>
                    {heatLevelFilters.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          {option.color && (
                            <div className={cn("w-2 h-2 rounded-full", option.color)} />
                          )}
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* In Stock Toggle */}
                <Button
                  variant={showOnlyInStock ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowOnlyInStock(!showOnlyInStock)}
                  className="text-sm"
                >
                  In Stock
                </Button>
              </div>
            )}

            {/* Sort */}
            {showSort && (
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* View Toggle */}
            {showViewToggle && (
              <div className="flex border rounded-md overflow-hidden">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className="rounded-none border-0"
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="rounded-none border-0 border-l"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active Filters */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600">Active filters:</span>
          {searchQuery && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Search: "{searchQuery}"
              <X className="w-3 h-3 cursor-pointer" onClick={() => setSearchQuery("")} />
            </Badge>
          )}
          {selectedCategory !== "all" && (
            <Badge variant="secondary" className="flex items-center gap-1">
              {categoryFilters.find(f => f.value === selectedCategory)?.label}
              <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedCategory("all")} />
            </Badge>
          )}
          {selectedHeatLevel !== "all" && (
            <Badge variant="secondary" className="flex items-center gap-1">
              {heatLevelFilters.find(f => f.value === selectedHeatLevel)?.label}
              <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedHeatLevel("all")} />
            </Badge>
          )}
          {showOnlyInStock && (
            <Badge variant="secondary" className="flex items-center gap-1">
              In Stock Only
              <X className="w-3 h-3 cursor-pointer" onClick={() => setShowOnlyInStock(false)} />
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-xs text-salsa-600 hover:text-salsa-700"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Products Count */}
      <div className="text-sm text-gray-600">
        Showing {filteredAndSortedProducts.length} of {products.length} products
      </div>

      {/* Products Grid */}
      {filteredAndSortedProducts.length > 0 ? (
        <div className={cn(
          viewMode === "grid" 
            ? `grid gap-6 ${gridColumns[columns]}`
            : "space-y-4"
        )}>
          {filteredAndSortedProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              variant={viewMode === "list" ? "horizontal" : "vertical"}
              onClick={() => onProductClick?.(product)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
          <p className="text-gray-600 mb-4">Try adjusting your search or filter criteria</p>
          <Button onClick={clearAllFilters} variant="outline">
            Clear all filters
          </Button>
        </div>
      )}
    </div>
  );
}
