import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { ProductCard, type Product } from "@/components/store/product-card";
import { getProducts } from "@/lib/db/products";

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
function toCardProduct(row: DbProduct): Product {
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

export async function FeaturedProductsSection({
  limit = 4,
}: FeaturedProductsSectionProps = {}) {
  let products: Product[] = [];
  try {
    const rows = await getProducts({ featured: true, inStock: true, take: limit });
    products = rows.map(toCardProduct);
  } catch (err) {
    // Database errors here shouldn't break the home page; just hide the section.
    if (process.env.NODE_ENV !== "production") {
      console.error("Failed to load featured products", err);
    }
    return null;
  }

  if (products.length === 0) return null;

  return (
    <section className="bg-background py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="mb-12 text-center">
            <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-widest text-salsa-600">
              Best Sellers
            </span>
            <h2 className="mb-3 font-serif text-4xl font-bold tracking-[-0.02em] text-foreground md:text-5xl">
              Find Your Perfect <span className="text-gradient">Heat Level</span>
            </h2>
            <p className="mx-auto max-w-xl text-muted-foreground">
              From sweet fruit blends that brighten any dish to extra-hot picks that bring
              real fire — every jar is small-batch and handcrafted in Zanesville, Ohio.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {products.map((product) => (
            <ScrollReveal key={product.id}>
              <ProductCard product={product} />
            </ScrollReveal>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-7 py-3.5 text-base font-semibold text-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-salsa-300 hover:shadow-md"
          >
            View All 25+ Flavors
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
