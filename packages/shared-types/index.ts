/**
 * Shared TypeScript types for Jose Madrid Salsa monorepo
 *
 * This package contains common types, interfaces, and type utilities
 * used across multiple applications and packages.
 */

// =============================================================================
// Fundraising Types
// =============================================================================

export interface FundraiserCharacter {
  id: string;
  name: string;
  cls: CharacterClass;
  gender: "m" | "f";
  skin: string;
  hair: string;
  quips: string[];
}

export type CharacterClass =
  | "warrior"
  | "mage"
  | "rogue"
  | "archer"
  | "paladin"
  | "berserker";

export interface FundraiserTeam {
  id: string;
  name: string;
  school: string;
  color: string;
  dark: string;
  goal: number;
  roster: FundraiserCharacter[];
}

export interface BattleState {
  hp: Record<string, number>;
  maxHp: Record<string, number>;
  scores: Record<string, number>;
  shielded: boolean;
  shieldExpiresAt: string | null;
}

export interface CharacterState {
  id: string;
  state: "idle" | "attack" | "hit" | "dead" | "heal";
}

export interface BattleFeedItem {
  id: number;
  type: "attack" | "defend" | "sale" | "shield" | "death" | "event" | "click";
  msg: string;
}

export interface SaleWebhookPayload {
  apiKey: string;
  amount?: number;
  orderId?: string;
}

export interface SaleWebhookResponse {
  success: boolean;
  teamId: string;
  teamName: string;
  salesCount: number;
  saleEventId: string;
  triggerAttack: boolean;
}

// =============================================================================
// Email Types
// =============================================================================

export type NewsletterTemplate = {
  id: string;
  name: string;
  subject: string;
  description: string;
  tags: string[];
  html: string;
};

export type NewsletterBlock = {
  id: string;
  label: string;
  category: 'hero' | 'content' | 'cta' | 'social' | 'footer';
  description: string;
  html: string;
};

// =============================================================================
// Recipe Types
// =============================================================================

export type Recipe = {
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
};

// =============================================================================
// Merchandise Types
// =============================================================================

export type MerchCollection = {
  id: string;
  title: string;
  description: string;
  items: string[];
  accent?: string;
};

export type MerchHighlight = {
  id: string;
  title: string;
  description: string;
  icon: 'truck' | 'package' | 'shirt' | 'palette';
};

export type MerchSetupStep = {
  id: string;
  label: string;
};

export type MerchProduct = {
  id: string;
  sku: string;
  name: string;
  category: string;
  status: 'draft' | 'active' | 'out-of-stock';
  baseCost: number;
  retailPrice: number;
  margin: number;
  lastSyncedAt: string;
};

export type MerchVendorCredential = {
  platform: string;
  status: 'connected' | 'pending' | 'not-connected';
  lastChecked?: string;
  actionLabel: string;
  actionHref: string;
};

// =============================================================================
// Business Form Types
// =============================================================================

export type BusinessFormCategory = {
  id: 'sales' | 'fundraising' | 'hr' | 'finance' | 'operations';
  label: string;
  description: string;
};

export type BusinessFormField = {
  id: string;
  label: string;
  type: 'short-text' | 'long-text' | 'checkbox' | 'table' | 'signature' | 'date' | 'number';
  placeholder?: string;
  helperText?: string;
  columns?: string[];
  defaultRows?: number;
};

export type BusinessFormSection = {
  id: string;
  label: string;
  description?: string;
  defaultIncluded?: boolean;
  fields: BusinessFormField[];
};

export type BusinessFormTemplate = {
  id: string;
  name: string;
  categoryId: BusinessFormCategory['id'] | string;
  description: string;
  tags: string[];
  estimatedCompletion: string;
  recommendedUses: string[];
  sections: BusinessFormSection[];
  publicSlug: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  version?: number;
  source?: 'library' | 'saved';
  updatedAt?: string;
};

// =============================================================================
// Analytics Types
// =============================================================================

export type GoogleAnalyticsChartType = 'line' | 'bar' | 'pie';

export type GoogleAnalyticsChartColor = 'indigo' | 'emerald' | 'amber' | 'rose';

export type GoogleAnalyticsChartDefinition = {
  id: string;
  title: string;
  description: string;
  type: GoogleAnalyticsChartType;
  color: GoogleAnalyticsChartColor;
  metrics: string[];
  dimensions: string[];
};

export type GoogleAnalyticsSettings = {
  propertyId: string;
  configured: boolean;
  lastSyncedAt: string | null;
  error?: string;
  charts: GoogleAnalyticsChartDefinition[];
};

export type GoogleAnalyticsSummaryCard = {
  id: string;
  label: string;
  value: string;
  previousValue?: string;
  change?: number;
  changeLabel?: string;
  icon?: string;
};

export type GoogleAnalyticsChartPoint = {
  date: string;
  value: number;
};

export type GoogleAnalyticsChartResult = {
  id: string;
  title: string;
  data: GoogleAnalyticsChartPoint[];
};

export type GoogleAnalyticsDashboardData = {
  summary: GoogleAnalyticsSummaryCard[];
  charts: GoogleAnalyticsChartResult[];
};

// =============================================================================
// Sharing Types
// =============================================================================

export type SocialPlatform =
  | 'facebook'
  | 'twitter'
  | 'instagram'
  | 'linkedin'
  | 'whatsapp'
  | 'pinterest'
  | 'email'
  | 'copy'
  | 'native';

export type ContentType = 'product' | 'recipe' | 'location' | 'page';

export interface ShareContent {
  /** The title to share */
  title: string;

  /** Description/summary text */
  description: string;

  /** Full URL to share */
  url: string;

  /** Image URL for visual platforms */
  image?: string;

  /** Content type for analytics */
  contentType: ContentType;

  /** Content ID for tracking */
  contentId?: string;

  /** Additional hashtags (without #) */
  hashtags?: string[];

  /** Twitter handle to mention (without @) */
  via?: string;
}

export interface ShareButtonProps {
  /** Platform to share to */
  platform: SocialPlatform;

  /** Content to share */
  content: ShareContent;

  /** Button size variant */
  size?: 'sm' | 'md' | 'lg';

  /** Show platform label text */
  showLabel?: boolean;

  /** Custom className */
  className?: string;

  /** Callback after successful share */
  onShare?: () => void;

  /** Callback on share error */
  onError?: (error: Error) => void;
}

export interface SocialShareProps {
  /** Content to share */
  content: ShareContent;

  /** Platforms to display (defaults to all) */
  platforms?: SocialPlatform[];

  /** Layout orientation */
  orientation?: 'horizontal' | 'vertical';

  /** Show platform labels */
  showLabels?: boolean;

  /** Button size */
  size?: 'sm' | 'md' | 'lg';

  /** Title for the share section */
  title?: string;

  /** Custom className */
  className?: string;
}

export interface PlatformConfig {
  /** Platform identifier */
  name: SocialPlatform;

  /** Display label */
  label: string;

  /** Icon name (from lucide-react) */
  icon: string;

  /** Brand color */
  color: string;

  /** Share URL template */
  urlTemplate: string;

  /** Supports images */
  supportsImage: boolean;

  /** Requires custom handling */
  customHandler?: boolean;
}

export interface ShareAnalyticsEvent {
  /** Platform shared to */
  platform: SocialPlatform;

  /** Type of content shared */
  contentType: ContentType;

  /** Content identifier */
  contentId?: string;

  /** Page URL where share occurred */
  sourceUrl: string;

  /** ISO 8601 timestamp */
  timestamp: string;

  /** User ID if authenticated */
  userId?: string;
}

export interface ShareMetadata {
  /** Open Graph title */
  ogTitle: string;

  /** Open Graph description */
  ogDescription: string;

  /** Open Graph image */
  ogImage: string;

  /** Open Graph type */
  ogType: 'website' | 'article' | 'product';

  /** Twitter card type */
  twitterCard: 'summary' | 'summary_large_image';

  /** Twitter title */
  twitterTitle: string;

  /** Twitter description */
  twitterDescription: string;

  /** Twitter image */
  twitterImage: string;

  /** Canonical URL */
  canonicalUrl: string;
}

export interface ProductShareContent extends ShareContent {
  contentType: 'product';

  /** Product price */
  price?: number;

  /** Heat level */
  heatLevel?: string;

  /** Availability */
  inStock?: boolean;
}

export interface RecipeShareContent extends ShareContent {
  contentType: 'recipe';

  /** Prep time in minutes */
  prepTime?: number;

  /** Cook time in minutes */
  cookTime?: number;

  /** Number of servings */
  servings?: number;

  /** Difficulty level */
  difficulty?: string;
}

export interface LocationShareContent extends ShareContent {
  contentType: 'location';

  /** Business name */
  businessName?: string;

  /** Address */
  address?: string;

  /** City, State */
  cityState?: string;

  /** Phone number */
  phone?: string;
}

// =============================================================================
// Financial Types
// =============================================================================

export type FinancialIntegration = {
  id: string;
  name: string;
  icon: 'building' | 'calculator' | 'creditcard';
  description: string;
  status: 'connected' | 'pending' | 'not-connected';
  actionLabel: string;
  actionHref: string;
};

export type FinancialIntegrationStatus = {
  quickbooks: boolean;
  gusto: boolean;
  stripe: boolean;
  lastSyncedAt: string | null;
};

export type PayrollRun = {
  id: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: 'processing' | 'approved' | 'paid';
  totalGross: number;
  totalNet: number;
};

export type PayrollEmployee = {
  id: string;
  name: string;
  email: string;
  role: string;
  salary: number;
  status: 'active' | 'inactive';
};

export type ExpenseEntry = {
  id: string;
  date: string;
  vendor: string;
  category: string;
  amount: number;
  status: 'draft' | 'submitted' | 'approved' | 'paid';
};

export type TaxTask = {
  id: string;
  title: string;
  dueDate: string;
  status: 'pending' | 'completed' | 'overdue';
  category: 'quarterly' | 'annual' | 'monthly';
};
