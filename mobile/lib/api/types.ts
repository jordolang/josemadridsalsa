/**
 * Type-safe models matching the Jose Madrid Salsa backend API responses.
 * Derived from Prisma schema and actual API route response shapes.
 */

// ─── Enums ───────────────────────────────────────────────────────────────────

/** User role as defined in the Prisma schema. Controls RBAC permissions. */
export type UserRole =
  | 'CUSTOMER'
  | 'ADMIN'
  | 'DEVELOPER'
  | 'STAFF'
  | 'WHOLESALE'
  | 'FUNDRAISER';

/** Product heat level classification for salsa filtering. */
export type HeatLevel = 'MILD' | 'MEDIUM' | 'HOT' | 'EXTRA_HOT' | 'FRUIT';

/** Order fulfillment lifecycle status. */
export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

/** Payment processing status from Stripe/Square/PayPal. */
export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'PAID'
  | 'FAILED'
  | 'CANCELED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

/** Supported payment providers. */
export type PaymentProvider = 'STRIPE' | 'SQUARE' | 'PAYPAL';

/** Loyalty program tier levels (ascending by lifetime points). */
export type LoyaltyTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

/** Discount code types supported at checkout. */
export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';

/** Visual theme options for gift certificate design. */
export type GiftCertificateTheme =
  | 'BIRTHDAY'
  | 'BOY_CELEBRATION'
  | 'CHRISTMAS'
  | 'GENERAL'
  | 'GIRL';

// ─── API Error ───────────────────────────────────────────────────────────────

/** Structured error response from the backend API. */
export interface ApiErrorResponse {
  error: string;
  details?: {
    fieldErrors?: Record<string, string[]>;
    formErrors?: string[];
  };
  message?: string;
}

// ─── Auth / Session ──────────────────────────────────────────────────────────

/** Authenticated user profile from the NextAuth session. */
export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  fundraiserId?: string;
  image?: string;
}

/** NextAuth session containing user profile and expiry. */
export interface Session {
  user: SessionUser;
  expires: string;
}

/** Request body for new customer registration. */
export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

/** Credentials for email/password authentication. */
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

// ─── Products ────────────────────────────────────────────────────────────────

/** FDA-style nutrition facts for a product. Values use grams (G), milligrams (Mg), and daily value percentages (DV). */
export interface NutritionalInfo {
  id: string;
  servingSize: string;
  servingsPerContainer: number;
  calories: number;
  caloriesFromFat: number;
  totalFatG: number;
  totalFatDV: number;
  saturatedFatG: number;
  saturatedFatDV: number;
  transFatG: number;
  cholesterolMg: number;
  cholesterolDV: number;
  sodiumMg: number;
  sodiumDV: number;
  totalCarbG: number;
  totalCarbDV: number;
  dietaryFiberG: number;
  dietaryFiberDV: number;
  sugarsG: number;
  proteinG: number;
  vitaminADV: number;
  vitaminCDV: number;
  calciumDV: number;
  ironDV: number;
  allergens: string | null;
}

export interface ProductIngredient {
  id: string;
  sortOrder: number;
  qualifier: string | null;
  ingredient: {
    id: string;
    name: string;
  };
}

/** Full product model from the catalog. Prices are in cents. */
export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** Unit price in cents (e.g., 599 = $5.99) */
  price: number;
  compareAtPrice?: number;
  featuredImage: string | null;
  images: string[];
  heatLevel: HeatLevel;
  sku: string;
  inventory: number;
  isFeatured: boolean;
  ingredients: string[];
  searchKeywords: string[];
  tags: string[];
  nutritionalInfo: NutritionalInfo | null;
  productIngredients: ProductIngredient[];
}

/** Query parameters for filtering the product catalog. */
export interface ProductQueryParams {
  heatLevel?: HeatLevel | 'all';
  search?: string;
  featured?: 'true';
  take?: number;
  skip?: number;
  sortOrder?: 'asc' | 'desc';
  inStock?: '1' | 'true';
  categories?: string;
  tags?: string;
}

// ─── Cart ────────────────────────────────────────────────────────────────────

export interface CartProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  compareAtPrice?: number;
  featuredImage: string | null;
  heatLevel: HeatLevel;
  inventory: number;
}

export interface CartItemResponse {
  id: string;
  productId: string;
  quantity: number;
  product: CartProduct;
}

/** Server-side cart state for an authenticated user. */
export interface CartResponse {
  items: CartItemResponse[];
  itemCount: number;
  totalQuantity: number;
  /** Subtotal in cents before shipping, tax, and discounts */
  subtotal: number;
}

export interface AddCartItemRequest {
  productId: string;
  quantity: number;
}

export interface AddCartItemResponse {
  success: boolean;
  cartItem: {
    id: string;
    productId: string;
    quantity: number;
    product: {
      id: string;
      name: string;
      price: number;
      featuredImage: string | null;
    };
  };
}

export interface UpdateCartItemRequest {
  quantity: number;
}

// ─── Checkout ────────────────────────────────────────────────────────────────

export interface CheckoutItem {
  productId: string;
  quantity: number;
}

export interface CheckoutCustomer {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface CheckoutShipping {
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
}

/** Full checkout request with items, customer, shipping, and optional extras. */
export interface CheckoutRequest {
  items: CheckoutItem[];
  customer: CheckoutCustomer;
  shipping: CheckoutShipping;
  notes?: string;
  discountCode?: string;
  shippingMethod?: string;
  referralCode?: string;
}

/** Response from creating a Stripe checkout. */
export interface CheckoutResponse {
  /** Stripe PaymentIntent client secret for confirming payment on the client */
  clientSecret: string;
  /** Internal order ID created for this checkout */
  orderId: string;
  /** Total amount in cents */
  amount: number;
}

export interface ShippingOption {
  method: string;
  cost: number;
  estimatedDays?: number;
}

export interface CalculateShippingResponse {
  shippingCost: number;
  shippingMethod: string;
  estimatedDelivery?: string;
  availableOptions?: ShippingOption[];
}

export interface CalculateTaxResponse {
  taxAmountDecimal: number;
  taxRate: number;
  taxBreakdown?: unknown;
}

export interface ValidateDiscountResponse {
  valid: boolean;
  type?: DiscountType;
  value?: number;
  code?: string;
  error?: string;
}

// Square checkout
export interface SquareProcessPaymentRequest {
  sourceId: string;
  orderId: string;
  verificationToken?: string;
  guestEmail?: string;
}

export interface SquareProcessPaymentResponse {
  success: boolean;
  orderId: string;
  orderNumber: string;
  squarePaymentId: string;
}

// PayPal checkout
export interface PayPalCreateOrderResponse {
  paypalOrderId: string;
  approvalUrl: string;
  orderId: string;
  amount: number;
}

export interface PayPalCaptureOrderRequest {
  paypalOrderId: string;
  orderId: string;
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export interface OrderItemProduct {
  id: string;
  name: string;
  slug: string;
  featuredImage: string | null;
  heatLevel: HeatLevel;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  productImage: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  product: OrderItemProduct | null;
}

/** Full order model with line items and financial totals. All monetary values in cents. */
export interface Order {
  id: string;
  /** Human-readable order number (e.g., "JMS-10042") */
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  shippingCost: number;
  tax: number;
  discountAmount: number;
  total: number;
  shippingMethod: string | null;
  trackingNumber: string | null;
  customerNotes: string | null;
  stripePaymentId: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export interface OrderQueryParams {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  take?: number;
  skip?: number;
  sortOrder?: 'asc' | 'desc';
}

// ─── Wishlist ────────────────────────────────────────────────────────────────

export interface WishlistProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  featuredImage: string | null;
  images: string[];
  heatLevel: HeatLevel;
  sku: string;
  inventory: number;
  isFeatured: boolean;
  isActive: boolean;
  tags: string[];
}

export interface WishlistItem {
  id: string;
  productId: string;
  userId: string;
  createdAt: string;
  product: WishlistProduct;
}

export interface WishlistResponse {
  items: WishlistItem[];
}

// ─── Loyalty ─────────────────────────────────────────────────────────────────

/** User's loyalty program account with points, tier, and history. */
export interface LoyaltyAccount {
  id: string;
  userId: string;
  pointsBalance: number;
  lifetimePoints: number;
  tier: LoyaltyTier;
  tierUpdatedAt: string;
  transactions: PointTransaction[];
  rewards: RewardRedemption[];
}

export interface PointTransaction {
  id: string;
  type: string;
  points: number;
  description: string;
  orderId: string | null;
  createdAt: string;
}

export interface LoyaltyReward {
  id: string;
  name: string;
  description: string;
  pointsCost: number;
  rewardType: string;
  rewardValue: number | null;
  isActive: boolean;
  minimumTier: LoyaltyTier;
}

export interface RewardRedemption {
  id: string;
  rewardId: string;
  pointsSpent: number;
  status: string;
  discountCode: string | null;
  expiresAt: string | null;
  createdAt: string;
}

// ─── Locations ───────────────────────────────────────────────────────────────

/** Physical retail location that carries Jose Madrid Salsa products. */
export interface RetailLocation {
  id: string;
  businessName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string | null;
  phone: string | null;
  website: string | null;
  photoUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  county: string | null;
  isActive: boolean;
}

// ─── Recipes ─────────────────────────────────────────────────────────────────

/** Recipe from the recipe catalog featuring Jose Madrid Salsa products. */
export interface Recipe {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  difficulty: string;
  prepTime: string;
  cookTime: string;
  servings: number;
  featured: boolean;
  featuredImage: string;
  ingredients: string[];
  instructions: string[];
}

// ─── Gift Certificates ──────────────────────────────────────────────────────

export interface GiftCertificateBalanceResponse {
  code: string;
  balance: number;
  originalAmount: number;
  recipientName: string;
  theme: GiftCertificateTheme;
}

export interface GiftCertificatePurchaseRequest {
  amount: number;
  purchaserName: string;
  purchaserEmail: string;
  recipientName: string;
  recipientEmail?: string;
  theme: GiftCertificateTheme;
  message?: string;
}

// ─── Fundraisers ─────────────────────────────────────────────────────────────

/** Fundraising campaign with organization details, goals, and revenue tracking. */
export interface Fundraiser {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  organizationName: string;
  contactEmail: string;
  startDate: string;
  endDate: string;
  goal: number | null;
  commissionRate: number;
  status: string;
  isActive: boolean;
  totalOrders: number;
  totalRevenue: number;
  logoUrl: string | null;
  coverPhotoUrl: string | null;
}

// ─── Payment Methods ─────────────────────────────────────────────────────────

/** A saved credit/debit card from the user's Stripe customer record. */
export interface SavedPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}
