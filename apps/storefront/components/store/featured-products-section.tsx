import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductCard, type Product } from "@/components/store/product-card";
import { getProducts } from "@/lib/db/products";
import { logger } from "@/lib/logger";

interface FeaturedProductsSectionProps {
  /** Maximum number of featured products to surface. Defaults to 4. */
  limit?: number;
}

type DbProduct = Awaited<ReturnType<typeof getProducts>>[number];

/**
 * Maps the Prisma row returned from `getProducts` onto the lighter Product
 * shape that the client `ProductCard` expects. Decimal prices are already
 * coerced to numbers inside `getProducts`, so the cast here is structural.
 */
export function toCardProduct(row: DbProduct): Product {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    price: row.price,
    compareAtPrice: row.compareAtPrice ?? null,
    featuredImage: row.featuredImage ?? null,
    // Prisma enums serialize as strings at runtime, but defend against null
    // so downstream `.toUpperCase()` calls don't blow up on bad data.
    heatLevel: row.heatLevel == null ? "" : String(row.heatLevel),
    sku: row.sku,
    inventory: row.inventory,
    isFeatured: row.isFeatured,
    ingredients: row.ingredients ?? null,
    weight: row.weight != null ? String(row.weight) : null,
    dimensions: typeof row.dimensions === "string" ? row.dimensions : null,
    nutritionalInfo: null,
  };
}

// Every HeatLevel in the schema gets a tile, so shoppers can browse the whole
// range from the homepage instead of only mild, medium, and hot.
export const HEAT_LEVEL_TILES = [
  { level: "MILD", label: "Mild", note: "All flavor, no fire", dot: "bg-verde-500" },
  { level: "MEDIUM", label: "Medium", note: "Our everyday favorite", dot: "bg-chile-500" },
  { level: "HOT", label: "Hot", note: "A kick that builds", dot: "bg-salsa-500" },
  { level: "EXTRA_HOT", label: "Extra Hot", note: "Real fire", dot: "bg-salsa-700" },
  { level: "FRUIT", label: "Fruit", note: "Sweet heat blends", dot: "bg-chile-400" },
] as const;

/**
 * Featured, in-stock products first. If nothing is flagged featured, fall back
 * to any in-stock products so the shop never disappears from the homepage.
 */
export async function loadHomepageProducts(
  limit: number,
): Promise<{ products: Product[]; isFeatured: boolean }> {
  const featured = await getProducts({ featured: true, inStock: true, take: limit });
  if (featured.length > 0) {
    return { products: featured.map(toCardProduct), isFeatured: true };
  }
  const inStock = await getProducts({ inStock: true, take: limit });
  return { products: inStock.map(toCardProduct), isFeatured: false };
}

export async function FeaturedProductsSection({
  limit = 4,
}: FeaturedProductsSectionProps = {}) {
  let products: Product[] = [];
  let isFeatured = false;
  try {
    ({ products, isFeatured } = await loadHomepageProducts(limit));
  } catch (err) {
    // A database error shouldn't break the home page. The heat-level tiles
    // below still render, so shoppers keep a way into the catalog.
    logger.error("Failed to load featured products", { error: err });
  }

  return (
    <section className="bg-background py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center sm:mb-10">
          <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-widest text-salsa-600">
            {isFeatured ? "Featured Salsas" : "Shop Salsas"}
          </span>
          <h2 className="mb-3 font-serif text-4xl font-bold tracking-[-0.02em] text-foreground md:text-5xl">
            Find Your Perfect <span className="text-gradient">Heat Level</span>
          </h2>
          <p className="mx-auto max-w-xl text-muted-foreground">
            From sweet fruit blends that brighten any dish to extra-hot picks that bring
            real fire — every jar is small-batch and handcrafted in Zanesville, Ohio.
          </p>
        </div>

        <nav aria-label="Shop by heat level" className="mb-10 sm:mb-12">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {HEAT_LEVEL_TILES.map((tile) => (
              <li key={tile.level} className="last:col-span-2 sm:last:col-span-1">
                <Link
                  href={`/products?heatLevel=${tile.level}`}
                  className="group flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-salsa-300 hover:bg-salsa-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-salsa-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-salsa-950/30"
                >
                  <span aria-hidden className={`h-3 w-3 shrink-0 rounded-full ${tile.dot}`} />
                  <span className="min-w-0">
                    <span className="block font-semibold text-foreground">{tile.label}</span>
                    <span className="block text-sm leading-snug text-muted-foreground">{tile.note}</span>
                  </span>
                  <ArrowRight
                    aria-hidden
                    className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-salsa-600 motion-reduce:transition-none"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {products.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        <div className="mt-10 text-center">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-7 py-3.5 text-base font-semibold text-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-salsa-300 hover:shadow-md"
          >
            View All 25+ Flavors
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-4 text-sm text-muted-foreground">
            Questions before you order? Read our{" "}
            <Link href="/shipping" className="font-medium text-foreground underline underline-offset-2 hover:text-salsa-600">
              shipping
            </Link>{" "}
            and{" "}
            <Link href="/returns" className="font-medium text-foreground underline underline-offset-2 hover:text-salsa-600">
              returns
            </Link>{" "}
            policies.
          </p>
        </div>
      </div>
    </section>
  );
}
