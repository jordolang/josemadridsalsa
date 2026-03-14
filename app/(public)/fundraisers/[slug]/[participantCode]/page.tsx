import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { Calendar, Target, Clock, Heart, Mail, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { createMetadata } from '@/lib/metadata';
import { ProductGrid } from '@/components/store/product-grid';
import { ReferralHeader } from '@/components/fundraising/referral-header';
import prisma from '@/lib/prisma';
import { formatPrice } from '@/lib/utils';

interface PageProps {
  params: Promise<{
    slug: string;
    participantCode: string;
  }>;
}

async function getFundraiserWithParticipant(slug: string, referralCode: string) {
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

  if (!fundraiser) {
    return null;
  }

  // Find the participant by referral code and verify they belong to this fundraiser
  const participant = await prisma.fundraiserParticipant.findUnique({
    where: {
      referralCode,
    },
  });

  // Validate participant belongs to this fundraiser and is active
  if (
    !participant ||
    participant.fundraiserId !== fundraiser.id ||
    participant.status !== 'ACTIVE'
  ) {
    return null;
  }

  return { fundraiser, participant };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, participantCode } = await params;
  const data = await getFundraiserWithParticipant(slug, participantCode);

  if (!data) {
    return createMetadata({
      title: 'Fundraiser Not Found',
      description: 'The fundraiser you are looking for could not be found.',
    });
  }

  const { fundraiser, participant } = data;

  return createMetadata({
    title: `Support ${participant.name} - ${fundraiser.name}`,
    description: `Help ${participant.name} support ${fundraiser.organizationName} by ordering delicious Jose Madrid Salsa!`,
    pathname: `/fundraisers/${slug}/${participantCode}`,
  });
}

export default async function ParticipantReferralPage({ params }: PageProps) {
  const { slug, participantCode } = await params;
  const data = await getFundraiserWithParticipant(slug, participantCode);

  if (!data) {
    notFound();
  }

  const { fundraiser, participant } = data;

  // Set referral tracking cookie
  const cookieStore = await cookies();
  cookieStore.set('fundraiser_referral_code', participantCode, {
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    httpOnly: false, // Allow client-side access for checkout
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });

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
    ...fp.product,
    price: fp.price ? Number(fp.price) : Number(fp.product.price),
    compareAtPrice: fp.product.compareAtPrice ? Number(fp.product.compareAtPrice) : null,
    weight: fp.product.weight ? fp.product.weight.toString() : null,
    dimensions: fp.product.dimensions ? fp.product.dimensions.toString() : null,
  }));

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section with Referral Header */}
      <section className="relative bg-gradient-to-r from-verde-600 via-salsa-600 to-chile-600 text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative container mx-auto px-4 py-16 lg:py-24">
          <div className="max-w-4xl mx-auto">
            <ReferralHeader
              participantName={participant.name}
              organizationName={fundraiser.organizationName}
              campaignName={fundraiser.name}
              isActive={isActive}
              isUpcoming={isUpcoming}
              hasEnded={hasEnded}
            />

            {/* Description */}
            {fundraiser.description && (
              <p className="text-lg lg:text-xl text-white/90 max-w-2xl mx-auto leading-relaxed mb-8 text-center">
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
                <Heart className="w-6 h-6 mx-auto mb-2 text-yellow-300" />
                <p className="text-sm text-verde-100">Participants</p>
                <p className="font-bold">{fundraiser._count.participants}</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <Heart className="w-6 h-6 mx-auto mb-2 text-red-400 fill-current" />
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
                    Campaign Progress
                  </h2>
                  <p className="text-muted-foreground">
                    Help {participant.name} and {fundraiser.organizationName} reach their
                    goal!
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-muted-foreground">
                          Progress
                        </span>
                        <span className="text-sm font-bold text-foreground">
                          {progress.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={progress} className="h-3" />
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-1">Raised</p>
                        <p className="text-2xl font-bold text-verde-600">
                          {formatPrice(Number(fundraiser.totalRevenue))}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-1">Goal</p>
                        <p className="text-2xl font-bold text-foreground">
                          {formatPrice(Number(fundraiser.goal))}
                        </p>
                      </div>
                      <div className="text-center col-span-2 md:col-span-1">
                        <p className="text-sm text-muted-foreground mb-1">
                          Commission Earned
                        </p>
                        <p className="text-2xl font-bold text-salsa-600">
                          {formatPrice(Number(fundraiser.totalCommission))}
                        </p>
                      </div>
                    </div>

                    {/* Motivation Message */}
                    <div className="bg-muted/50 rounded-lg p-4 text-center mt-4">
                      <p className="text-sm text-muted-foreground">
                        Your purchase helps{' '}
                        <span className="font-semibold text-foreground">
                          {participant.name}
                        </span>{' '}
                        earn{' '}
                        <span className="font-semibold text-foreground">
                          {fundraiser.commissionRate.toString()}%
                        </span>{' '}
                        commission for {fundraiser.organizationName}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      )}

      {/* Products Section */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-serif font-bold text-foreground mb-4">
              Shop & Support {participant.name}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Choose from our selection of award-winning salsas. All purchases through this
              link will be credited to {participant.name}.
            </p>
          </div>

          {products.length > 0 ? (
            <ProductGrid products={products} />
          ) : (
            <Card className="card surface-shadow max-w-md mx-auto">
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground">
                  No products are currently available for this fundraiser.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-serif font-bold text-center text-foreground mb-12">
              How Your Purchase Helps
            </h2>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Step 1 */}
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-verde-500 to-verde-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-white">1</span>
                </div>
                <h3 className="font-serif font-bold text-xl mb-2 text-foreground">
                  Shop
                </h3>
                <p className="text-muted-foreground">
                  Choose your favorite Jose Madrid Salsa products and complete your order
                </p>
              </div>

              {/* Step 2 */}
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-salsa-500 to-salsa-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-white">2</span>
                </div>
                <h3 className="font-serif font-bold text-xl mb-2 text-foreground">
                  Support
                </h3>
                <p className="text-muted-foreground">
                  {fundraiser.commissionRate.toString()}% of your purchase goes directly to{' '}
                  {participant.name}
                </p>
              </div>

              {/* Step 3 */}
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-chile-500 to-chile-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-white">3</span>
                </div>
                <h3 className="font-serif font-bold text-xl mb-2 text-foreground">
                  Celebrate
                </h3>
                <p className="text-muted-foreground">
                  Help {fundraiser.organizationName} reach their fundraising goal
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <Card className="card surface-shadow">
              <CardHeader className="text-center">
                <h2 className="text-2xl font-serif font-bold text-foreground">
                  Questions About This Fundraiser?
                </h2>
                <p className="text-muted-foreground mt-2">
                  Contact the campaign coordinator
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button variant="default" size="lg" asChild>
                    <Link href={`mailto:${fundraiser.contactEmail}`}>
                      <Mail className="w-5 h-5 mr-2" />
                      Email Coordinator
                    </Link>
                  </Button>
                  {fundraiser.contactPhone && (
                    <Button variant="outline" size="lg" asChild>
                      <Link href={`tel:${fundraiser.contactPhone}`}>
                        <Phone className="w-5 h-5 mr-2" />
                        Call Coordinator
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
