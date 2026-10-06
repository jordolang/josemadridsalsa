import { Section, Row, Column, Text, Img } from '@react-email/components';
import { Button } from './Button';

export interface RecommendedProduct {
  name: string;
  slug: string;
  price: number | string;
  imageUrl: string;
  heatLevel?: 'Mild' | 'Medium' | 'Hot' | 'Very Hot';
}

interface RecommendedProductsProps {
  products: RecommendedProduct[];
  siteUrl?: string;
  showEmpty?: boolean;
  emptyMessage?: string;
}

export const RecommendedProducts = ({
  products,
  siteUrl = 'https://josemadridsalsa.com',
  showEmpty = false,
  emptyMessage = 'No recommendations available at this time.',
}: RecommendedProductsProps) => {
  if (!products || products.length === 0) {
    if (!showEmpty) return null;

    return (
      <Section style={emptySection}>
        <Text style={emptyText}>{emptyMessage}</Text>
      </Section>
    );
  }

  return (
    <Section style={containerSection}>
      <Text style={sectionHeading}>You Might Also Like</Text>
      <Text style={sectionSubtitle}>
        Based on your order, we think you&apos;ll love these flavors
      </Text>

      <Section style={gridSection}>
        {products.slice(0, 4).map((product, index) => {
          const productUrl = `${siteUrl}/products/${product.slug}`;
          const parsed = typeof product.price === 'number'
            ? product.price
            : Number(product.price);
          const formattedPrice = Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';

          return (
            <Row key={`${product.slug}-${index}`} style={productRow}>
              <Column style={productCard}>
                {/* Product Image */}
                <Section style={imageSection}>
                  <Img
                    src={product.imageUrl}
                    alt={product.name}
                    width="100%"
                    style={productImage}
                  />
                  {product.heatLevel && (
                    <Section style={heatBadge}>
                      <Text style={heatBadgeText}>{product.heatLevel}</Text>
                    </Section>
                  )}
                </Section>

                {/* Product Details */}
                <Section style={detailsSection}>
                  <Text style={productName}>{product.name}</Text>
                  <Text style={productPrice}>${formattedPrice}</Text>

                  <Section style={buttonSection}>
                    <Button href={productUrl} variant="primary" size="small" fullWidth>
                      Shop Now
                    </Button>
                  </Section>
                </Section>
              </Column>

              {/* Second product in the row (if exists) */}
              {products[index + 1] && index % 2 === 0 && (() => {
                const nextProduct = products[index + 1];
                const nextProductUrl = `${siteUrl}/products/${nextProduct.slug}`;
                const nextParsed = typeof nextProduct.price === 'number'
                  ? nextProduct.price
                  : Number(nextProduct.price);
                const nextFormattedPrice = Number.isFinite(nextParsed) ? nextParsed.toFixed(2) : '0.00';

                return (
                  <Column style={productCard}>
                    {/* Product Image */}
                    <Section style={imageSection}>
                      <Img
                        src={nextProduct.imageUrl}
                        alt={nextProduct.name}
                        width="100%"
                        style={productImage}
                      />
                      {nextProduct.heatLevel && (
                        <Section style={heatBadge}>
                          <Text style={heatBadgeText}>{nextProduct.heatLevel}</Text>
                        </Section>
                      )}
                    </Section>

                    {/* Product Details */}
                    <Section style={detailsSection}>
                      <Text style={productName}>{nextProduct.name}</Text>
                      <Text style={productPrice}>${nextFormattedPrice}</Text>

                      <Section style={buttonSection}>
                        <Button href={nextProductUrl} variant="primary" size="small" fullWidth>
                          Shop Now
                        </Button>
                      </Section>
                    </Section>
                  </Column>
                );
              })()}
            </Row>
          );
        }).filter((_, index) => index % 2 === 0)}
      </Section>
    </Section>
  );
};

const containerSection = {
  padding: '0',
  margin: '24px 0',
};

const emptySection = {
  padding: '16px 0',
  margin: '0',
};

const emptyText = {
  margin: '0',
  fontSize: '14px',
  color: '#6b7280',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.5',
  textAlign: 'center' as const,
};

const sectionHeading = {
  margin: '0 0 8px',
  fontSize: '18px',
  fontWeight: '600' as const,
  color: '#1f2937',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.4',
  textAlign: 'center' as const,
};

const sectionSubtitle = {
  margin: '0 0 24px',
  fontSize: '14px',
  color: '#64748b',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.5',
  textAlign: 'center' as const,
};

const gridSection = {
  padding: '0',
  margin: '0',
};

const productRow = {
  marginBottom: '16px',
  width: '100%',
};

const productCard = {
  width: '48%',
  verticalAlign: 'top' as const,
  padding: '8px',
};

const imageSection = {
  position: 'relative' as const,
  marginBottom: '12px',
};

const productImage = {
  borderRadius: '8px',
  display: 'block',
  maxWidth: '100%',
  height: 'auto',
};

const heatBadge = {
  position: 'absolute' as const,
  top: '8px',
  right: '8px',
  backgroundColor: '#dc2626',
  borderRadius: '4px',
  padding: '4px 8px',
};

const heatBadgeText = {
  margin: '0',
  fontSize: '11px',
  fontWeight: '700' as const,
  color: '#ffffff',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.2',
  textTransform: 'uppercase' as const,
};

const detailsSection = {
  padding: '0',
  margin: '0',
};

const productName = {
  margin: '0 0 8px',
  fontSize: '14px',
  fontWeight: '600' as const,
  color: '#1f2937',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.4',
};

const productPrice = {
  margin: '0 0 12px',
  fontSize: '16px',
  fontWeight: '700' as const,
  color: '#dc2626',
  fontFamily: 'Arial, sans-serif',
  lineHeight: '1.3',
};

const buttonSection = {
  padding: '0',
  margin: '0',
};
