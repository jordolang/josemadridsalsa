import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Calendar, Target, Users, Clock, Heart } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createMetadata } from '@/lib/metadata';
import { ProductGrid } from '@/components/store/product-grid';
import { MessageBoard } from '@/components/fundraiser/MessageBoard';
import prisma from '@/lib/prisma';
import { formatPrice } from '@/lib/utils';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

async function getFundraiser(slug: string) {
  const fundraiser = await prisma.fundraiser.findUnique({
    where: {
      slug,
      isActive: true, // Only show active fundraisers publicly
    },
    include: {
      products: {
        where: { isActive: true },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              price: true,
              compareAtPrice: true,
              featuredImage: true,
              heatLevel: true,
              sku: true,
              inventory: true,
              isFeatured: true,
              ingredients: true,
              weight: true,
              dimensions: true,
              nutritionalInfo: true,
            },
          },
        },
      },
      _count: {
        select: {
          orders: true,
          participants: true,
        },
      },
    },
  });

  return fundraiser;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const fundraiser = await getFundraiser(slug);

  if (!fundraiser) {
    return createMetadata({
      title: 'Fundraiser Not Found',
      description: 'The fundraiser you are looking for could not be found.',
    });
  }

  return createMetadata({
    title: `${fundraiser.name} - Jose Madrid Salsa Fundraiser`,
    description: fundraiser.description || `Support ${fundraiser.organizationName} by ordering delicious Jose Madrid Salsa!`,
    pathname: `/fundraisers/${slug}`,
  });
}

export default async function FundraiserPage({ params }: PageProps) {
  const { slug } = await params;
  const fundraiser = await getFundraiser(slug);

  if (!fundraiser) {
    notFound();
  }

  // Calculate progress if goal is set
  const progress = fundraiser.goal
    ? Math.min((Number(fundraiser.totalRevenue) / Number(fundraiser.goal)) * 100, 100)
    : 0;

  // Check if fundraiser is active based on dates
  const now = new Date();
  const isActive = now >= fundraiser.startDate && now <= fundraiser.endDate;
  const isUpcoming = now < fundraiser.startDate;
  const hasEnded = now > fundraiser.endDate;

  // Format dates
  const startDate = fundraiser.startDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const endDate = fundraiser.endDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Convert products to ProductGrid format
  const products = fundraiser.products.map((fp) => ({
    id: fp.product.id,
    name: fp.product.name,
    slug: fp.product.slug,
    description: fp.product.description,
    price: fp.price ? Number(fp.price) : Number(fp.product.price),
    compareAtPrice: fp.product.compareAtPrice ? Number(fp.product.compareAtPrice) : null,
    featuredImage: fp.product.featuredImage,
    heatLevel: fp.product.heatLevel as string,
    sku: fp.product.sku,
    inventory: fp.product.inventory,
    isFeatured: fp.product.isFeatured,
    ingredients: fp.product.ingredients,
    weight: fp.product.weight ? fp.product.weight.toString() : null,
    dimensions: typeof fp.product.dimensions === 'string' ? fp.product.dimensions : null,
    nutritionalInfo: fp.product.nutritionalInfo as {
      calories: number;
      sodiumMg: number;
      totalFatG: number;
      totalCarbG: number;
      sugarsG: number;
      dietaryFiberG: number;
      proteinG: number;
      servingSize: string;
    } | null,
  }));

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-verde-600 via-salsa-600 to-chile-600 text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative container mx-auto px-4 py-16 lg:py-24">
          <div className="max-w-4xl mx-auto text-center">
            {/* Status Badge */}
            {isUpcoming && (
              <Badge className="bg-blue-500 text-white hover:bg-blue-600 mb-4">
                Upcoming Fundraiser
              </Badge>
            )}
            {hasEnded && (
              <Badge className="bg-gray-500 text-white hover:bg-gray-600 mb-4">
                Fundraiser Ended
              </Badge>
            )}
            {isActive && (
              <Badge className="bg-green-500 text-white hover:bg-green-600 mb-4">
                Active Now!
              </Badge>
            )}

            {/* Title */}
            <h1 className="text-4xl lg:text-5xl font-serif font-bold mb-4 text-shadow-lg">
              {fundraiser.name}
            </h1>

            {/* Organization */}
            <p className="text-2xl lg:text-3xl text-verde-100 mb-6">
              Supporting {fundraiser.organizationName}
            </p>

            {/* Description */}
            {fundraiser.description && (
              <p className="text-lg lg:text-xl text-white/90 max-w-2xl mx-auto leading-relaxed mb-8">
                {fundraiser.description}
              </p>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-3xl mx-auto">
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <Calendar className="w-6 h-6 mx-auto mb-2 text-yellow-300" />
                <p className="text-sm text-verde-100">Start Date</p>
                <p className="font-bold">{startDate}</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <Clock className="w-6 h-6 mx-auto mb-2 text-yellow-300" />
                <p className="text-sm text-verde-100">End Date</p>
                <p className="font-bold">{endDate}</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <Users className="w-6 h-6 mx-auto mb-2 text-yellow-300" />
                <p className="text-sm text-verde-100">Participants</p>
                <p className="font-bold">{fundraiser._count.participants}</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <Heart className="w-6 h-6 mx-auto mb-2 text-yellow-300" />
                <p className="text-sm text-verde-100">Orders</p>
                <p className="font-bold">{fundraiser._count.orders}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Progress Section */}
      {fundraiser.goal && (
        <section className="py-12 bg-card">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <Card className="card surface-shadow">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-salsa-500 to-chile-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Target className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-2xl font-serif font-bold text-foreground mb-2">
                    Fundraising Progress
                  </h2>
                  <p className="text-muted-foreground">
                    Help us reach our goal!
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Raised: {formatPrice(Number(fundraiser.totalRevenue))}</span>
                      <span className="text-muted-foreground">Goal: {formatPrice(Number(fundraiser.goal))}</span>
                    </div>
                    <Progress
                      value={progress}
                      className="h-4 bg-muted"
                    />
                    <p className="text-center text-sm text-muted-foreground">
                      {progress.toFixed(1)}% of goal reached
                    </p>
                  </div>

                  {fundraiser.commissionRate && (
                    <div className="bg-muted rounded-lg p-4 text-center">
                      <p className="text-sm text-muted-foreground mb-1">
                        Organization Earnings
                      </p>
                      <p className="text-3xl font-bold text-salsa-600">
                        {formatPrice(Number(fundraiser.totalCommission))}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {Number(fundraiser.commissionRate)}% of all sales
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      )}

      {/* Products Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            {products.length > 0 ? (
              <ProductGrid
                products={products}
                title="Shop & Support"
                description={`Every purchase supports ${fundraiser.organizationName}. Choose from our delicious selection of authentic salsas!`}
                showFilters={true}
                showSearch={true}
                showSort={true}
                columns={3}
              />
            ) : (
              <div className="text-center py-16">
                <h2 className="text-2xl font-serif font-bold text-foreground mb-4">
                  Products Coming Soon
                </h2>
                <p className="text-muted-foreground mb-8">
                  We're setting up the product selection for this fundraiser. Check back soon!
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-12 bg-muted">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-serif font-bold text-foreground mb-4">
              Questions About This Fundraiser?
            </h2>
            <p className="text-muted-foreground mb-6">
              Contact the fundraiser coordinator for more information.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button asChild variant="outline">
                <a href={`mailto:${fundraiser.contactEmail}`}>
                  Email Coordinator
                </a>
              </Button>
              {fundraiser.contactPhone && (
                <Button asChild variant="outline">
                  <a href={`tel:${fundraiser.contactPhone}`}>
                    Call Coordinator
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Supporter Message Board */}
      <section className="py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <MessageBoard slug={slug} />
        </div>
      </section>

      {/* Info Section */}
      <section className="py-12 bg-card">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl font-serif font-bold text-foreground mb-6">
              How It Works
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="card surface-shadow">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-verde-500 to-salsa-500 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-xl font-bold">
                    1
                  </div>
                  <h3 className="font-bold text-foreground mb-2">Shop</h3>
                  <p className="text-sm text-muted-foreground">
                    Browse our selection of delicious, authentic salsas and choose your favorites.
                  </p>
                </CardContent>
              </Card>
              <Card className="card surface-shadow">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-salsa-500 to-chile-500 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-xl font-bold">
                    2
                  </div>
                  <h3 className="font-bold text-foreground mb-2">Support</h3>
                  <p className="text-sm text-muted-foreground">
                    Your purchase automatically supports {fundraiser.organizationName}.
                  </p>
                </CardContent>
              </Card>
              <Card className="card surface-shadow">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-chile-500 to-verde-500 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-xl font-bold">
                    3
                  </div>
                  <h3 className="font-bold text-foreground mb-2">Enjoy</h3>
                  <p className="text-sm text-muted-foreground">
                    Receive fresh salsa delivered to your door while helping a great cause!
                  </p>
                </CardContent>
              </Card>
            </div>
            <div className="mt-8">
              <Button size="lg" className="bg-gradient-to-r from-salsa-600 to-chile-600 hover:from-salsa-700 hover:to-chile-700" asChild>
                <Link href="/fundraising">
                  Start Your Own Fundraiser
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
