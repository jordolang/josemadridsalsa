/**
 * The form registry for the desktop admin shell.
 *
 * This is the half of the write layer that both sides can read: it is plain
 * data with no Prisma import, so the client bundles it to draw a sheet and the
 * server reads it to know which handler an operation belongs to. The other half
 * — permission, validation and the actual write — lives in `writes.ts`, keyed by
 * the same ids.
 *
 * A form here is a description, never a component. The shell has one renderer
 * (`components/admin-desktop/record-sheet.tsx`); adding a way to create
 * something is adding an entry here plus a handler there, not a new screen.
 */

// ---------------------------------------------------------------------------
// fields
// ---------------------------------------------------------------------------

export type FieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'tel'
  | 'url'
  | 'slug'
  | 'password'
  | 'number'
  | 'integer'
  | 'money'
  | 'percent'
  | 'select'
  | 'checkbox'
  | 'date'
  | 'datetime'
  | 'tags'
  | 'lines'

export interface FormOption {
  value: string
  label: string
  /** Carried through to the client so a picker can show a price or a SKU. */
  hint?: string
}

/**
 * Where a picker's choices come from when they are rows rather than an enum.
 *
 * Resolved by `/api/admin/desktop/options/[source]` when the sheet opens, so a
 * product list is never stale and never shipped in the page.
 */
export type OptionSource =
  | 'products'
  | 'activeProducts'
  | 'categories'
  | 'suppliers'
  | 'customers'
  | 'fundraisers'
  | 'staff'
  | 'emailTemplates'
  | 'mailingLists'
  | 'blogCategories'
  | 'leadCampaigns'

export interface FormField {
  name: string
  label: string
  type: FieldType
  required?: boolean
  placeholder?: string
  /** One line under the input, for the thing a label cannot say. */
  help?: string
  options?: FormOption[]
  optionsFrom?: OptionSource
  min?: number
  max?: number
  step?: number
  rows?: number
  /** Sheet columns this field spans. Two is full width. */
  span?: 1 | 2
  /** Fill from another field, slugified, until the operator edits it by hand. */
  slugFrom?: string
  /** Row shape for a `lines` repeater. */
  itemFields?: FormField[]
  /** Button label for a `lines` repeater's add row. */
  addLabel?: string
  defaultValue?: FieldValue
}

export type FieldValue = string | number | boolean | string[] | LineValue[] | null
export type LineValue = Record<string, string>
export type FormValues = Record<string, FieldValue>

/** A titled run of fields inside one sheet. */
export interface FormSection {
  label?: string
  fields: FormField[]
}

export interface FormSpec {
  title: string
  /** Sits under the title — what this form is for, when that is not obvious. */
  subtitle?: string
  submitLabel: string
  sections: FormSection[]
  /** Paint the submit button as destructive. */
  danger?: boolean
  /** Sheet width in pixels. Wider for anything with a line-item repeater. */
  width?: number
}

// ---------------------------------------------------------------------------
// shared field pieces
// ---------------------------------------------------------------------------

const enumOptions = (values: readonly string[], labels?: Record<string, string>): FormOption[] =>
  values.map((value) => ({
    value,
    label:
      labels?.[value] ??
      value
        .toLowerCase()
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
  }))

const ORDER_STATUS = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'] as const
const PAYMENT_STATUS = ['PENDING', 'PROCESSING', 'PAID', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELED'] as const
const FULFILLMENT_STATUS = ['UNFULFILLED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'DELIVERED', 'RETURNED'] as const
/** The channels a person can pick by hand — see `lib/admin/manual-order.ts`. */
const MANUAL_CHANNELS = ['MANUAL', 'PHONE', 'WHOLESALE', 'EVENT', 'MARKETPLACE'] as const
const SALES_CHANNEL = ['WEBSITE', 'POS', 'FUNDRAISER', 'WHOLESALE', 'EVENT', 'MANUAL', 'MARKETPLACE', 'PHONE', 'IMPORT'] as const
const HEAT_LEVEL = ['MILD', 'MEDIUM', 'HOT', 'EXTRA_HOT', 'FRUIT'] as const
const FUNDRAISER_STATUS = ['DRAFT', 'ACTIVE', 'ENDED', 'CANCELLED'] as const
const PARTICIPANT_STATUS = ['ACTIVE', 'INACTIVE'] as const
const BOOKING_STATUS = ['INTERESTED', 'APPLIED', 'WAITLISTED', 'ACCEPTED', 'CONFIRMED', 'DECLINED', 'CANCELLED'] as const
const PO_STATUS = ['DRAFT', 'SUBMITTED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'] as const
const INVOICE_STATUS = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'] as const
const WHOLESALE_STATUS = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const
const BUSINESS_TYPE = ['RETAIL_STORE', 'RESTAURANT', 'DISTRIBUTOR', 'ONLINE_STORE', 'OTHER'] as const
const LEDGER_DIRECTION = ['INCOME', 'EXPENSE'] as const
const LEDGER_CATEGORY = [
  'PRODUCT_SALES',
  'SHIPPING_INCOME',
  'SALES_TAX_COLLECTED',
  'SHOW_SALES',
  'OTHER_INCOME',
  'COGS',
  'PROCESSOR_FEES',
  'SHIPPING_COST',
  'SHOW_EXPENSES',
  'REFUNDS',
  'DISCOUNTS',
  'BOOTH_FEE',
  'TRAVEL',
  'MEALS',
  'SUPPLIES',
  'PAYROLL',
  'OTHER_EXPENSE',
] as const
const BLOG_STATUS = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] as const
const BLOG_LAYOUT = ['STANDARD', 'LONGFORM', 'GALLERY', 'VIDEO', 'MINIMAL'] as const
const SOCIAL_STATUS = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED'] as const
const SOCIAL_PLATFORM = ['FACEBOOK', 'INSTAGRAM', 'TWITTER', 'TIKTOK', 'GOOGLE_MY_BUSINESS'] as const
const REVIEW_STATUS = ['PENDING', 'APPROVED', 'REJECTED'] as const
const USER_ROLE = ['CUSTOMER', 'STAFF', 'ADMIN', 'DEVELOPER', 'WHOLESALE', 'FUNDRAISER'] as const
const CUSTOMER_TYPE = ['STANDARD', 'FUNDRAISING', 'WHOLESALE'] as const
const CUSTOMER_SOURCE = ['MANUAL', 'IMPORT', 'GUEST_ORDER', 'REGISTERED'] as const
const LEAD_STATUS = ['SCRAPED', 'CONTACT_FOUND', 'EMAIL_SENT', 'EMAIL_FAILED'] as const
const LEAD_TYPE = ['SCHOOL_ATHLETICS', 'LOCAL_BUSINESS', 'LOCAL_SCHOOL', 'FUNDRAISER_ORG'] as const
const FULFILLMENT_METHOD = ['ORDER_FORMS_AND_BULK', 'ONLINE_ONLY'] as const
const BROCHURE_OPTION = ['PRINT_YOUR_OWN', 'PROFESSIONAL_100'] as const
const CONVERSATION_STATUS = ['OPEN', 'CLOSED'] as const
const CHAT_STATUS = ['WAITING', 'ACTIVE', 'CLOSED', 'OFFLINE'] as const
const RETURN_STATUS = ['REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'COMPLETED', 'CANCELLED'] as const
const RETURN_REASON = [
  'DAMAGED',
  'WRONG_ITEM',
  'NOT_AS_DESCRIBED',
  'ARRIVED_LATE',
  'CHANGED_MIND',
  'QUALITY_ISSUE',
  'OTHER',
] as const
const RETURN_RESOLUTION = ['REFUND', 'EXCHANGE', 'STORE_CREDIT'] as const
const CONTENT_STATUS = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] as const
const PAGE_KIND = ['LANDING', 'SYSTEM'] as const
const BANNER_PLACEMENT = ['SITE_WIDE_TOP', 'HOMEPAGE_HERO', 'CATEGORY', 'CHECKOUT', 'FUNDRAISING'] as const
const SUBSCRIBER_STATUS = ['SUBSCRIBED', 'UNSUBSCRIBED', 'BOUNCED', 'COMPLAINED'] as const
const SUPPRESSION_REASON = [
  'HARD_BOUNCE',
  'SOFT_BOUNCE',
  'SPAM_COMPLAINT',
  'MANUAL',
  'UNSUBSCRIBE',
  'ADMIN',
] as const
const MANIFEST_STATUS = ['DRAFT', 'PACKED', 'RETURNED'] as const
const TEAM_STATUS = ['PENDING', 'ACTIVE', 'SUSPENDED', 'ENDED'] as const

/** Product / quantity / price rows, shared by orders, POs and invoices. */
const productLineFields = (priceLabel: string): FormField[] => [
  { name: 'productId', label: 'Product', type: 'select', optionsFrom: 'products', required: true },
  { name: 'quantity', label: 'Qty', type: 'integer', required: true, min: 1, defaultValue: '1' },
  { name: 'unitPrice', label: priceLabel, type: 'money', required: true, min: 0 },
]

// ---------------------------------------------------------------------------
// the registry
// ---------------------------------------------------------------------------

export const DESKTOP_FORMS = {
  // ------------------------------------------------------------------ orders
  'order.create': {
    title: 'New order',
    subtitle:
      'An order taken somewhere other than the website. Prices, shipping and tax are entered, not calculated — this records a deal already struck.',
    submitLabel: 'Create order',
    width: 720,
    sections: [
      {
        label: 'Customer',
        fields: [
          { name: 'email', label: 'Customer email', type: 'email', required: true, span: 2 },
          { name: 'firstName', label: 'First name', type: 'text' },
          { name: 'lastName', label: 'Last name', type: 'text' },
          { name: 'phone', label: 'Phone', type: 'tel' },
          {
            name: 'salesChannel',
            label: 'Channel',
            type: 'select',
            options: enumOptions(MANUAL_CHANNELS, { MANUAL: 'Manual', PHONE: 'Phone', EVENT: 'Show' }),
            defaultValue: 'MANUAL',
            required: true,
          },
        ],
      },
      {
        label: 'Items',
        fields: [
          {
            name: 'items',
            label: 'Line items',
            type: 'lines',
            span: 2,
            required: true,
            addLabel: 'Add a line',
            itemFields: productLineFields('Unit price'),
          },
        ],
      },
      {
        label: 'Money',
        fields: [
          { name: 'shippingCost', label: 'Shipping', type: 'money', min: 0, defaultValue: '0' },
          { name: 'tax', label: 'Tax', type: 'money', min: 0, defaultValue: '0' },
          { name: 'discountAmount', label: 'Discount', type: 'money', min: 0, defaultValue: '0' },
          {
            name: 'paymentStatus',
            label: 'Payment',
            type: 'select',
            required: true,
            defaultValue: 'PENDING',
            options: [
              { value: 'PENDING', label: 'Not paid yet' },
              { value: 'PAID', label: 'Paid' },
            ],
          },
          {
            name: 'paymentMethod',
            label: 'Paid by',
            type: 'text',
            placeholder: 'Cash, cheque, card…',
            help: 'Free text — cash and cheques have no processor row.',
          },
          { name: 'notes', label: 'Notes', type: 'textarea', span: 2, rows: 3 },
        ],
      },
    ],
  },

  'order.status': {
    title: 'Update order',
    submitLabel: 'Save order',
    sections: [
      {
        fields: [
          { name: 'status', label: 'Order status', type: 'select', options: enumOptions(ORDER_STATUS), required: true },
          {
            name: 'paymentStatus',
            label: 'Payment status',
            type: 'select',
            options: enumOptions(PAYMENT_STATUS),
            required: true,
          },
          {
            name: 'fulfillmentStatus',
            label: 'Fulfillment',
            type: 'select',
            options: enumOptions(FULFILLMENT_STATUS),
            required: true,
          },
          {
            name: 'salesChannel',
            label: 'Channel',
            type: 'select',
            options: enumOptions(SALES_CHANNEL),
            required: true,
          },
          { name: 'adminNotes', label: 'Internal notes', type: 'textarea', span: 2, rows: 4 },
        ],
      },
    ],
  },

  'order.tracking': {
    title: 'Shipping & tracking',
    subtitle: 'What the customer sees on the tracking page.',
    submitLabel: 'Save tracking',
    sections: [
      {
        fields: [
          { name: 'carrierName', label: 'Carrier', type: 'text', placeholder: 'USPS, UPS, FedEx…' },
          { name: 'shippingMethod', label: 'Service', type: 'text', placeholder: 'Ground Advantage' },
          { name: 'trackingNumber', label: 'Tracking number', type: 'text', span: 2 },
          { name: 'trackingUrl', label: 'Tracking URL', type: 'url', span: 2 },
          { name: 'shippedAt', label: 'Shipped', type: 'datetime' },
          { name: 'estimatedDelivery', label: 'Estimated delivery', type: 'date' },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- products
  'product.create': {
    title: 'New product',
    submitLabel: 'Create product',
    width: 680,
    sections: [
      {
        label: 'Identity',
        fields: [
          { name: 'name', label: 'Name', type: 'text', required: true, span: 2 },
          { name: 'slug', label: 'URL slug', type: 'slug', required: true, slugFrom: 'name' },
          { name: 'sku', label: 'SKU', type: 'text', required: true },
          { name: 'categoryId', label: 'Category', type: 'select', optionsFrom: 'categories', required: true },
          { name: 'heatLevel', label: 'Heat', type: 'select', options: enumOptions(HEAT_LEVEL), required: true },
          { name: 'description', label: 'Description', type: 'textarea', span: 2, rows: 4 },
        ],
      },
      {
        label: 'Money & stock',
        fields: [
          { name: 'price', label: 'Price', type: 'money', required: true, min: 0 },
          { name: 'compareAtPrice', label: 'Compare at', type: 'money', min: 0 },
          { name: 'costPrice', label: 'Unit cost', type: 'money', min: 0, help: 'What the jar costs us.' },
          { name: 'weight', label: 'Weight (oz)', type: 'number', min: 0, help: 'Ounces, not pounds.' },
          { name: 'inventory', label: 'On hand', type: 'integer', min: 0, defaultValue: '0' },
          { name: 'lowStockThreshold', label: 'Reorder at', type: 'integer', min: 0, defaultValue: '5' },
          { name: 'unitsPerCase', label: 'Units per case', type: 'integer', min: 1, defaultValue: '12' },
          { name: 'sortOrder', label: 'Sort order', type: 'integer', defaultValue: '0' },
        ],
      },
      {
        label: 'Visibility',
        fields: [
          { name: 'isActive', label: 'Active in the store', type: 'checkbox', defaultValue: true },
          { name: 'isFeatured', label: 'Featured', type: 'checkbox', defaultValue: false },
          { name: 'featuredImage', label: 'Featured image URL', type: 'url', span: 2 },
          {
            name: 'metaTitle',
            label: 'Meta title',
            type: 'text',
            span: 2,
            max: 60,
            help: '30–60 characters, or Google rewrites it.',
          },
          { name: 'metaDescription', label: 'Meta description', type: 'textarea', span: 2, rows: 2, max: 160 },
        ],
      },
    ],
  },

  'product.edit': {
    title: 'Edit product',
    submitLabel: 'Save product',
    width: 680,
    sections: [
      {
        label: 'Identity',
        fields: [
          { name: 'name', label: 'Name', type: 'text', required: true, span: 2 },
          { name: 'slug', label: 'URL slug', type: 'slug', required: true },
          { name: 'sku', label: 'SKU', type: 'text', required: true },
          { name: 'categoryId', label: 'Category', type: 'select', optionsFrom: 'categories', required: true },
          { name: 'heatLevel', label: 'Heat', type: 'select', options: enumOptions(HEAT_LEVEL), required: true },
          { name: 'description', label: 'Description', type: 'textarea', span: 2, rows: 4 },
        ],
      },
      {
        label: 'Money & stock',
        fields: [
          { name: 'price', label: 'Price', type: 'money', required: true, min: 0 },
          { name: 'compareAtPrice', label: 'Compare at', type: 'money', min: 0 },
          { name: 'costPrice', label: 'Unit cost', type: 'money', min: 0 },
          { name: 'weight', label: 'Weight (oz)', type: 'number', min: 0 },
          { name: 'lowStockThreshold', label: 'Reorder at', type: 'integer', min: 0 },
          { name: 'unitsPerCase', label: 'Units per case', type: 'integer', min: 1 },
          { name: 'sortOrder', label: 'Sort order', type: 'integer' },
        ],
      },
      {
        label: 'Visibility',
        fields: [
          { name: 'isActive', label: 'Active in the store', type: 'checkbox' },
          { name: 'isFeatured', label: 'Featured', type: 'checkbox' },
          { name: 'featuredImage', label: 'Featured image URL', type: 'url', span: 2 },
          { name: 'metaTitle', label: 'Meta title', type: 'text', span: 2, max: 60 },
          { name: 'metaDescription', label: 'Meta description', type: 'textarea', span: 2, rows: 2, max: 160 },
        ],
      },
    ],
  },

  // --------------------------------------------------------------- inventory
  'inventory.adjust': {
    title: 'Adjust stock',
    subtitle: 'Writes an inventory transaction, so the count and its reason stay together.',
    submitLabel: 'Apply adjustment',
    sections: [
      {
        fields: [
          {
            name: 'mode',
            label: 'How',
            type: 'select',
            required: true,
            defaultValue: 'DELTA',
            options: [
              { value: 'DELTA', label: 'Add or remove' },
              { value: 'SET', label: 'Set the count to' },
            ],
          },
          { name: 'amount', label: 'Jars', type: 'integer', required: true, help: 'Negative to remove.' },
          { name: 'reason', label: 'Reason', type: 'text', span: 2, required: true, placeholder: 'Count correction, breakage, kitchen run…' },
        ],
      },
    ],
  },

  'inventory.thresholds': {
    title: 'Reorder point',
    submitLabel: 'Save thresholds',
    sections: [
      {
        fields: [
          { name: 'lowStockThreshold', label: 'Reorder at', type: 'integer', required: true, min: 0 },
          { name: 'unitsPerCase', label: 'Units per case', type: 'integer', required: true, min: 1 },
        ],
      },
    ],
  },

  // --------------------------------------------------------------- customers
  'customer.create': {
    title: 'New customer',
    submitLabel: 'Create customer',
    sections: [
      {
        fields: [
          { name: 'email', label: 'Email', type: 'email', required: true, span: 2 },
          { name: 'firstName', label: 'First name', type: 'text' },
          { name: 'lastName', label: 'Last name', type: 'text' },
          { name: 'phone', label: 'Phone', type: 'tel' },
          {
            name: 'accountType',
            label: 'Account type',
            type: 'select',
            options: enumOptions(CUSTOMER_TYPE),
            defaultValue: 'STANDARD',
            required: true,
          },
          {
            name: 'source',
            label: 'Source',
            type: 'select',
            options: enumOptions(CUSTOMER_SOURCE),
            defaultValue: 'MANUAL',
            required: true,
          },
          { name: 'sourceName', label: 'Source detail', type: 'text', placeholder: 'Show name, list name…' },
          { name: 'notes', label: 'Notes', type: 'textarea', span: 2, rows: 3 },
        ],
      },
    ],
  },

  'customer.edit': {
    title: 'Edit customer',
    submitLabel: 'Save customer',
    sections: [
      {
        fields: [
          { name: 'email', label: 'Email', type: 'email', required: true, span: 2 },
          { name: 'firstName', label: 'First name', type: 'text' },
          { name: 'lastName', label: 'Last name', type: 'text' },
          { name: 'phone', label: 'Phone', type: 'tel' },
          {
            name: 'accountType',
            label: 'Account type',
            type: 'select',
            options: enumOptions(CUSTOMER_TYPE),
            required: true,
          },
          { name: 'sourceName', label: 'Source detail', type: 'text', span: 2 },
          { name: 'notes', label: 'Notes', type: 'textarea', span: 2, rows: 3 },
        ],
      },
    ],
  },

  // ------------------------------------------------------------ fundraisers
  'fundraiser.create': {
    title: 'New fundraiser',
    subtitle: 'Each campaign is its own store. The price here is what its supporters are quoted.',
    submitLabel: 'Create fundraiser',
    width: 700,
    sections: [
      {
        label: 'The group',
        fields: [
          { name: 'name', label: 'Campaign name', type: 'text', required: true, span: 2 },
          { name: 'slug', label: 'URL slug', type: 'slug', required: true, slugFrom: 'name' },
          { name: 'organizationName', label: 'Organization', type: 'text', required: true },
          { name: 'contactEmail', label: 'Coordinator email', type: 'email', required: true },
          { name: 'contactPhone', label: 'Coordinator phone', type: 'tel' },
          { name: 'description', label: 'Description', type: 'textarea', span: 2, rows: 3 },
        ],
      },
      {
        label: 'Dates & goal',
        fields: [
          { name: 'startDate', label: 'Starts', type: 'date', required: true },
          { name: 'endDate', label: 'Ends', type: 'date', required: true },
          {
            name: 'goal',
            label: 'Goal',
            type: 'money',
            min: 0,
            help: 'Gross sales, not the group’s share.',
          },
          {
            name: 'commissionRate',
            label: 'Group’s share',
            type: 'percent',
            required: true,
            min: 0,
            max: 100,
            defaultValue: '50',
          },
          {
            name: 'defaultUnitPrice',
            label: 'Price per jar',
            type: 'money',
            required: true,
            min: 0,
            defaultValue: '10',
          },
          {
            name: 'status',
            label: 'Status',
            type: 'select',
            options: enumOptions(FUNDRAISER_STATUS),
            defaultValue: 'DRAFT',
            required: true,
          },
        ],
      },
      {
        label: 'How they run it',
        fields: [
          {
            name: 'fulfillmentMethod',
            label: 'Fulfilment',
            type: 'select',
            required: true,
            defaultValue: 'ORDER_FORMS_AND_BULK',
            options: enumOptions(FULFILLMENT_METHOD, {
              ORDER_FORMS_AND_BULK: 'Order forms + one bulk delivery',
              ONLINE_ONLY: 'Online only, ships to each buyer',
            }),
          },
          {
            name: 'brochureOption',
            label: 'Brochures',
            type: 'select',
            options: enumOptions(BROCHURE_OPTION, {
              PRINT_YOUR_OWN: 'Print your own (free)',
              PROFESSIONAL_100: '100 printed',
            }),
          },
          { name: 'subdomain', label: 'Subdomain', type: 'text', help: 'Leave blank to use the slug.' },
          { name: 'isActive', label: 'Live', type: 'checkbox', defaultValue: false },
        ],
      },
    ],
  },

  'fundraiser.edit': {
    title: 'Edit fundraiser',
    submitLabel: 'Save fundraiser',
    width: 700,
    sections: [
      {
        label: 'The group',
        fields: [
          { name: 'name', label: 'Campaign name', type: 'text', required: true, span: 2 },
          { name: 'slug', label: 'URL slug', type: 'slug', required: true },
          { name: 'organizationName', label: 'Organization', type: 'text', required: true },
          { name: 'contactEmail', label: 'Coordinator email', type: 'email', required: true },
          { name: 'contactPhone', label: 'Coordinator phone', type: 'tel' },
          { name: 'description', label: 'Description', type: 'textarea', span: 2, rows: 3 },
        ],
      },
      {
        label: 'Dates & goal',
        fields: [
          { name: 'startDate', label: 'Starts', type: 'date', required: true },
          { name: 'endDate', label: 'Ends', type: 'date', required: true },
          { name: 'goal', label: 'Goal', type: 'money', min: 0 },
          { name: 'commissionRate', label: 'Group’s share', type: 'percent', required: true, min: 0, max: 100 },
          { name: 'defaultUnitPrice', label: 'Price per jar', type: 'money', required: true, min: 0 },
          { name: 'status', label: 'Status', type: 'select', options: enumOptions(FUNDRAISER_STATUS), required: true },
        ],
      },
      {
        label: 'How they run it',
        fields: [
          {
            name: 'fulfillmentMethod',
            label: 'Fulfilment',
            type: 'select',
            required: true,
            options: enumOptions(FULFILLMENT_METHOD, {
              ORDER_FORMS_AND_BULK: 'Order forms + one bulk delivery',
              ONLINE_ONLY: 'Online only, ships to each buyer',
            }),
          },
          {
            name: 'brochureOption',
            label: 'Brochures',
            type: 'select',
            options: enumOptions(BROCHURE_OPTION, {
              PRINT_YOUR_OWN: 'Print your own (free)',
              PROFESSIONAL_100: '100 printed',
            }),
          },
          { name: 'subdomain', label: 'Subdomain', type: 'text' },
          { name: 'isActive', label: 'Live', type: 'checkbox' },
          { name: 'missionStatement', label: 'Mission statement', type: 'textarea', span: 2, rows: 2 },
        ],
      },
    ],
  },

  'participant.create': {
    title: 'Add participant',
    submitLabel: 'Add participant',
    sections: [
      {
        fields: [
          { name: 'fundraiserId', label: 'Campaign', type: 'select', optionsFrom: 'fundraisers', required: true, span: 2 },
          { name: 'name', label: 'Name', type: 'text', required: true, span: 2 },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'phone', label: 'Phone', type: 'tel' },
          {
            name: 'referralCode',
            label: 'Referral code',
            type: 'text',
            help: 'Blank generates one from the name.',
            span: 2,
          },
        ],
      },
    ],
  },

  'participant.edit': {
    title: 'Edit participant',
    submitLabel: 'Save participant',
    sections: [
      {
        fields: [
          { name: 'name', label: 'Name', type: 'text', required: true, span: 2 },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'phone', label: 'Phone', type: 'tel' },
          {
            name: 'status',
            label: 'Status',
            type: 'select',
            options: enumOptions(PARTICIPANT_STATUS),
            required: true,
          },
          { name: 'referralCode', label: 'Referral code', type: 'text' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------events
  'event.create': {
    title: 'New show',
    submitLabel: 'Create show',
    width: 700,
    sections: [
      {
        label: 'The show',
        fields: [
          { name: 'title', label: 'Name', type: 'text', required: true, span: 2 },
          { name: 'venue', label: 'Venue', type: 'text', span: 2 },
          { name: 'city', label: 'City', type: 'text' },
          { name: 'state', label: 'State', type: 'text', max: 2, placeholder: 'OH' },
          { name: 'startDate', label: 'Starts', type: 'date', required: true },
          { name: 'endDate', label: 'Ends', type: 'date' },
          { name: 'eventTimes', label: 'Hours', type: 'text', span: 2, placeholder: 'Sat 10am–6pm; Sun 11am–5pm' },
          {
            name: 'bookingStatus',
            label: 'Booking',
            type: 'select',
            options: enumOptions(BOOKING_STATUS),
            defaultValue: 'INTERESTED',
            required: true,
          },
          { name: 'applicationDeadline', label: 'Application due', type: 'date' },
          { name: 'description', label: 'Notes', type: 'textarea', span: 2, rows: 3 },
        ],
      },
      {
        label: 'Costs & scale',
        fields: [
          { name: 'boothFee', label: 'Booth fee', type: 'money', min: 0 },
          { name: 'attendance', label: 'Attendance', type: 'integer', min: 0 },
          { name: 'costOfFuel', label: 'Fuel', type: 'money', min: 0 },
          { name: 'lodging', label: 'Lodging', type: 'money', min: 0 },
          { name: 'meals', label: 'Meals', type: 'money', min: 0 },
          { name: 'isWhereIsJose', label: 'Show on “Where is Jose”', type: 'checkbox', defaultValue: true },
        ],
      },
    ],
  },

  'event.edit': {
    title: 'Edit show',
    submitLabel: 'Save show',
    width: 700,
    sections: [
      {
        label: 'The show',
        fields: [
          { name: 'title', label: 'Name', type: 'text', required: true, span: 2 },
          { name: 'venue', label: 'Venue', type: 'text', span: 2 },
          { name: 'city', label: 'City', type: 'text' },
          { name: 'state', label: 'State', type: 'text', max: 2 },
          { name: 'startDate', label: 'Starts', type: 'date', required: true },
          { name: 'endDate', label: 'Ends', type: 'date' },
          { name: 'eventTimes', label: 'Hours', type: 'text', span: 2 },
          { name: 'bookingStatus', label: 'Booking', type: 'select', options: enumOptions(BOOKING_STATUS), required: true },
          { name: 'applicationDeadline', label: 'Application due', type: 'date' },
          { name: 'description', label: 'Notes', type: 'textarea', span: 2, rows: 3 },
        ],
      },
      {
        label: 'Costs & scale',
        fields: [
          { name: 'boothFee', label: 'Booth fee', type: 'money', min: 0 },
          { name: 'attendance', label: 'Attendance', type: 'integer', min: 0 },
          { name: 'costOfFuel', label: 'Fuel', type: 'money', min: 0 },
          { name: 'lodging', label: 'Lodging', type: 'money', min: 0 },
          { name: 'meals', label: 'Meals', type: 'money', min: 0 },
          { name: 'isWhereIsJose', label: 'Show on “Where is Jose”', type: 'checkbox' },
        ],
      },
    ],
  },

  'event.financials': {
    title: 'Show financials',
    subtitle: 'Entered by hand on return from the show.',
    submitLabel: 'Save financials',
    sections: [
      {
        fields: [
          { name: 'cashSales', label: 'Cash taken', type: 'money', min: 0 },
          { name: 'cardSales', label: 'Card taken', type: 'money', min: 0 },
          { name: 'boothFee', label: 'Booth fee', type: 'money', min: 0 },
          { name: 'costOfFuel', label: 'Fuel', type: 'money', min: 0 },
          { name: 'lodging', label: 'Lodging', type: 'money', min: 0 },
          { name: 'meals', label: 'Meals', type: 'money', min: 0 },
          { name: 'otherExpenses', label: 'Other expenses', type: 'money', min: 0 },
          { name: 'otherExpensesNote', label: 'What for', type: 'text' },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- purchase
  'purchase.create': {
    title: 'New purchase order',
    submitLabel: 'Create PO',
    width: 720,
    sections: [
      {
        fields: [
          { name: 'supplierId', label: 'Supplier', type: 'select', optionsFrom: 'suppliers', required: true, span: 2 },
          { name: 'poNumber', label: 'PO number', type: 'text', help: 'Blank generates the next one.' },
          { name: 'expectedAt', label: 'Expected', type: 'date' },
          { name: 'shippingCost', label: 'Freight', type: 'money', min: 0, defaultValue: '0' },
          {
            name: 'status',
            label: 'Status',
            type: 'select',
            options: enumOptions(PO_STATUS),
            defaultValue: 'DRAFT',
            required: true,
          },
          { name: 'notes', label: 'Notes', type: 'textarea', span: 2, rows: 2 },
          {
            name: 'items',
            label: 'Lines',
            type: 'lines',
            span: 2,
            required: true,
            addLabel: 'Add a line',
            itemFields: productLineFields('Unit cost'),
          },
        ],
      },
    ],
  },

  'purchase.edit': {
    title: 'Edit purchase order',
    submitLabel: 'Save PO',
    sections: [
      {
        fields: [
          { name: 'supplierId', label: 'Supplier', type: 'select', optionsFrom: 'suppliers', required: true, span: 2 },
          { name: 'expectedAt', label: 'Expected', type: 'date' },
          { name: 'shippingCost', label: 'Freight', type: 'money', min: 0 },
          { name: 'status', label: 'Status', type: 'select', options: enumOptions(PO_STATUS), required: true },
          { name: 'notes', label: 'Notes', type: 'textarea', span: 2, rows: 3 },
        ],
      },
    ],
  },

  'supplier.create': {
    title: 'New supplier',
    submitLabel: 'Create supplier',
    sections: [
      {
        fields: [
          { name: 'name', label: 'Name', type: 'text', required: true, span: 2 },
          { name: 'contactName', label: 'Contact', type: 'text' },
          { name: 'email', label: 'Email', type: 'email' },
          { name: 'phone', label: 'Phone', type: 'tel' },
          { name: 'website', label: 'Website', type: 'url' },
          { name: 'address1', label: 'Address', type: 'text', span: 2 },
          { name: 'city', label: 'City', type: 'text' },
          { name: 'state', label: 'State', type: 'text', max: 2 },
          { name: 'postalCode', label: 'ZIP', type: 'text' },
          { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
          { name: 'notes', label: 'Notes', type: 'textarea', span: 2, rows: 2 },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- invoices
  'invoice.create': {
    title: 'New invoice',
    submitLabel: 'Create invoice',
    width: 720,
    sections: [
      {
        fields: [
          { name: 'number', label: 'Invoice number', type: 'text', help: 'Blank generates the next one.' },
          { name: 'dueDate', label: 'Due', type: 'date', required: true },
          { name: 'customerId', label: 'Customer', type: 'select', optionsFrom: 'customers', span: 2 },
          {
            name: 'status',
            label: 'Status',
            type: 'select',
            options: enumOptions(INVOICE_STATUS),
            defaultValue: 'DRAFT',
            required: true,
          },
          { name: 'notes', label: 'Notes', type: 'textarea', span: 2, rows: 2 },
          {
            name: 'lines',
            label: 'Lines',
            type: 'lines',
            span: 2,
            required: true,
            addLabel: 'Add a line',
            itemFields: [
              { name: 'description', label: 'Description', type: 'text', required: true },
              { name: 'quantity', label: 'Qty', type: 'integer', required: true, min: 1, defaultValue: '1' },
              { name: 'unitPrice', label: 'Unit price', type: 'money', required: true, min: 0 },
            ],
          },
        ],
      },
    ],
  },

  'invoice.edit': {
    title: 'Edit invoice',
    submitLabel: 'Save invoice',
    width: 720,
    sections: [
      {
        fields: [
          { name: 'number', label: 'Invoice number', type: 'text', required: true },
          { name: 'dueDate', label: 'Due', type: 'date', required: true },
          { name: 'customerId', label: 'Customer', type: 'select', optionsFrom: 'customers', span: 2 },
          { name: 'status', label: 'Status', type: 'select', options: enumOptions(INVOICE_STATUS), required: true },
          { name: 'notes', label: 'Notes', type: 'textarea', span: 2, rows: 2 },
          {
            name: 'lines',
            label: 'Lines',
            type: 'lines',
            span: 2,
            required: true,
            addLabel: 'Add a line',
            itemFields: [
              { name: 'description', label: 'Description', type: 'text', required: true },
              { name: 'quantity', label: 'Qty', type: 'integer', required: true, min: 1 },
              { name: 'unitPrice', label: 'Unit price', type: 'money', required: true, min: 0 },
            ],
          },
        ],
      },
    ],
  },

  // --------------------------------------------------------------- wholesale
  'wholesale.edit': {
    title: 'Edit wholesale account',
    submitLabel: 'Save account',
    sections: [
      {
        fields: [
          { name: 'businessName', label: 'Business', type: 'text', required: true, span: 2 },
          { name: 'contactName', label: 'Contact', type: 'text', required: true },
          {
            name: 'businessType',
            label: 'Type',
            type: 'select',
            options: enumOptions(BUSINESS_TYPE),
            required: true,
          },
          { name: 'status', label: 'Status', type: 'select', options: enumOptions(WHOLESALE_STATUS), required: true },
          { name: 'discountRate', label: 'Discount', type: 'percent', min: 0, max: 100 },
          { name: 'minimumOrder', label: 'Minimum order', type: 'money', min: 0 },
          { name: 'resaleNumber', label: 'Resale number', type: 'text' },
          { name: 'taxId', label: 'Tax ID', type: 'text' },
          { name: 'website', label: 'Website', type: 'url' },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ ledger
  'ledger.create': {
    title: 'New ledger entry',
    subtitle: 'A hand-entered row. The backfill never overwrites one.',
    submitLabel: 'Add entry',
    sections: [
      {
        fields: [
          { name: 'date', label: 'Date', type: 'date', required: true },
          {
            name: 'direction',
            label: 'Direction',
            type: 'select',
            options: enumOptions(LEDGER_DIRECTION),
            required: true,
            defaultValue: 'EXPENSE',
          },
          { name: 'amount', label: 'Amount', type: 'money', required: true, min: 0 },
          {
            name: 'category',
            label: 'Category',
            type: 'select',
            options: enumOptions(LEDGER_CATEGORY),
            required: true,
          },
          { name: 'description', label: 'Description', type: 'text', required: true, span: 2 },
          { name: 'counterparty', label: 'Customer or vendor', type: 'text' },
          { name: 'paymentMethod', label: 'Paid by', type: 'text', placeholder: 'Cash, card, check…' },
          {
            name: 'channel',
            label: 'Channel',
            type: 'select',
            options: enumOptions(SALES_CHANNEL),
          },
          { name: 'memo', label: 'Memo', type: 'textarea', span: 2, rows: 2 },
        ],
      },
    ],
  },

  'ledger.edit': {
    title: 'Edit ledger entry',
    submitLabel: 'Save entry',
    sections: [
      {
        fields: [
          { name: 'date', label: 'Date', type: 'date', required: true },
          {
            name: 'direction',
            label: 'Direction',
            type: 'select',
            options: enumOptions(LEDGER_DIRECTION),
            required: true,
          },
          { name: 'amount', label: 'Amount', type: 'money', required: true, min: 0 },
          { name: 'category', label: 'Category', type: 'select', options: enumOptions(LEDGER_CATEGORY), required: true },
          { name: 'description', label: 'Description', type: 'text', required: true, span: 2 },
          { name: 'counterparty', label: 'Customer or vendor', type: 'text' },
          { name: 'paymentMethod', label: 'Paid by', type: 'text' },
          { name: 'channel', label: 'Channel', type: 'select', options: enumOptions(SALES_CHANNEL) },
          { name: 'memo', label: 'Memo', type: 'textarea', span: 2, rows: 2 },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------- email
  'campaign.create': {
    title: 'New campaign',
    submitLabel: 'Create campaign',
    sections: [
      {
        fields: [
          { name: 'name', label: 'Internal name', type: 'text', required: true, span: 2 },
          { name: 'subject', label: 'Subject line', type: 'text', required: true, span: 2 },
          { name: 'previewText', label: 'Preview text', type: 'text', span: 2 },
          { name: 'templateId', label: 'Template', type: 'select', optionsFrom: 'emailTemplates', required: true },
          { name: 'listId', label: 'Mailing list', type: 'select', optionsFrom: 'mailingLists' },
          { name: 'fromName', label: 'From name', type: 'text' },
          { name: 'fromEmail', label: 'From address', type: 'email' },
          { name: 'scheduledAt', label: 'Send at', type: 'datetime', help: 'Blank leaves it a draft.' },
          { name: 'trackOpens', label: 'Track opens', type: 'checkbox', defaultValue: true },
          { name: 'trackClicks', label: 'Track clicks', type: 'checkbox', defaultValue: true },
          { name: 'notes', label: 'Notes', type: 'textarea', span: 2, rows: 2 },
        ],
      },
    ],
  },

  'campaign.edit': {
    title: 'Edit campaign',
    submitLabel: 'Save campaign',
    sections: [
      {
        fields: [
          { name: 'name', label: 'Internal name', type: 'text', required: true, span: 2 },
          { name: 'subject', label: 'Subject line', type: 'text', required: true, span: 2 },
          { name: 'previewText', label: 'Preview text', type: 'text', span: 2 },
          { name: 'templateId', label: 'Template', type: 'select', optionsFrom: 'emailTemplates', required: true },
          { name: 'listId', label: 'Mailing list', type: 'select', optionsFrom: 'mailingLists' },
          { name: 'fromName', label: 'From name', type: 'text' },
          { name: 'fromEmail', label: 'From address', type: 'email' },
          { name: 'scheduledAt', label: 'Send at', type: 'datetime' },
          { name: 'trackOpens', label: 'Track opens', type: 'checkbox' },
          { name: 'trackClicks', label: 'Track clicks', type: 'checkbox' },
          { name: 'notes', label: 'Notes', type: 'textarea', span: 2, rows: 2 },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ social
  'social.create': {
    title: 'New social post',
    submitLabel: 'Create post',
    width: 660,
    sections: [
      {
        fields: [
          { name: 'content', label: 'Post', type: 'textarea', required: true, span: 2, rows: 5 },
          {
            name: 'platforms',
            label: 'Platforms',
            type: 'tags',
            span: 2,
            required: true,
            options: enumOptions(SOCIAL_PLATFORM, { GOOGLE_MY_BUSINESS: 'Google Business' }),
          },
          { name: 'linkUrl', label: 'Link', type: 'url', span: 2 },
          { name: 'hashtags', label: 'Hashtags', type: 'text', span: 2, placeholder: 'salsa, zanesville, smallbatch' },
          { name: 'scheduledAt', label: 'Publish at', type: 'datetime' },
          {
            name: 'status',
            label: 'Status',
            type: 'select',
            options: enumOptions(SOCIAL_STATUS),
            defaultValue: 'DRAFT',
            required: true,
          },
        ],
      },
    ],
  },

  'social.edit': {
    title: 'Edit social post',
    submitLabel: 'Save post',
    width: 660,
    sections: [
      {
        fields: [
          { name: 'content', label: 'Post', type: 'textarea', required: true, span: 2, rows: 5 },
          {
            name: 'platforms',
            label: 'Platforms',
            type: 'tags',
            span: 2,
            required: true,
            options: enumOptions(SOCIAL_PLATFORM, { GOOGLE_MY_BUSINESS: 'Google Business' }),
          },
          { name: 'linkUrl', label: 'Link', type: 'url', span: 2 },
          { name: 'hashtags', label: 'Hashtags', type: 'text', span: 2 },
          { name: 'scheduledAt', label: 'Publish at', type: 'datetime' },
          { name: 'status', label: 'Status', type: 'select', options: enumOptions(SOCIAL_STATUS), required: true },
        ],
      },
    ],
  },

  // ----------------------------------------------------------------- content
  'post.create': {
    title: 'New blog post',
    submitLabel: 'Create post',
    width: 760,
    sections: [
      {
        label: 'The article',
        fields: [
          { name: 'title', label: 'Title', type: 'text', required: true, span: 2 },
          { name: 'slug', label: 'URL slug', type: 'slug', required: true, slugFrom: 'title' },
          { name: 'categoryId', label: 'Category', type: 'select', optionsFrom: 'blogCategories' },
          { name: 'subtitle', label: 'Subtitle', type: 'text', span: 2 },
          { name: 'excerpt', label: 'Excerpt', type: 'textarea', required: true, span: 2, rows: 2 },
          { name: 'content', label: 'Body', type: 'textarea', required: true, span: 2, rows: 12 },
        ],
      },
      {
        label: 'Publishing',
        fields: [
          {
            name: 'status',
            label: 'Status',
            type: 'select',
            options: enumOptions(BLOG_STATUS),
            defaultValue: 'DRAFT',
            required: true,
          },
          { name: 'layout', label: 'Layout', type: 'select', options: enumOptions(BLOG_LAYOUT), defaultValue: 'STANDARD' },
          { name: 'publishedAt', label: 'Published', type: 'datetime' },
          { name: 'scheduledFor', label: 'Scheduled for', type: 'datetime' },
          { name: 'featured', label: 'Featured', type: 'checkbox' },
          { name: 'readingMinutes', label: 'Reading minutes', type: 'integer', min: 1, defaultValue: '5' },
          { name: 'coverImage', label: 'Cover image URL', type: 'url', span: 2 },
          { name: 'tags', label: 'Tags', type: 'text', span: 2, placeholder: 'recipes, heat, history' },
        ],
      },
      {
        label: 'Search',
        fields: [
          {
            name: 'seoTitle',
            label: 'SEO title',
            type: 'text',
            span: 2,
            max: 60,
            help: '30–60 characters. Blank falls back to the title.',
          },
          {
            name: 'seoDescription',
            label: 'SEO description',
            type: 'textarea',
            span: 2,
            rows: 2,
            max: 160,
            help: '160 characters at most. Blank falls back to the excerpt.',
          },
        ],
      },
    ],
  },

  'post.edit': {
    title: 'Edit blog post',
    submitLabel: 'Save post',
    width: 760,
    sections: [
      {
        label: 'The article',
        fields: [
          { name: 'title', label: 'Title', type: 'text', required: true, span: 2 },
          { name: 'slug', label: 'URL slug', type: 'slug', required: true },
          { name: 'categoryId', label: 'Category', type: 'select', optionsFrom: 'blogCategories' },
          { name: 'subtitle', label: 'Subtitle', type: 'text', span: 2 },
          { name: 'excerpt', label: 'Excerpt', type: 'textarea', required: true, span: 2, rows: 2 },
          { name: 'content', label: 'Body', type: 'textarea', required: true, span: 2, rows: 12 },
        ],
      },
      {
        label: 'Publishing',
        fields: [
          { name: 'status', label: 'Status', type: 'select', options: enumOptions(BLOG_STATUS), required: true },
          { name: 'layout', label: 'Layout', type: 'select', options: enumOptions(BLOG_LAYOUT) },
          { name: 'publishedAt', label: 'Published', type: 'datetime' },
          { name: 'scheduledFor', label: 'Scheduled for', type: 'datetime' },
          { name: 'featured', label: 'Featured', type: 'checkbox' },
          { name: 'readingMinutes', label: 'Reading minutes', type: 'integer', min: 1 },
          { name: 'coverImage', label: 'Cover image URL', type: 'url', span: 2 },
          { name: 'tags', label: 'Tags', type: 'text', span: 2 },
        ],
      },
      {
        label: 'Search',
        fields: [
          { name: 'seoTitle', label: 'SEO title', type: 'text', span: 2, max: 60 },
          { name: 'seoDescription', label: 'SEO description', type: 'textarea', span: 2, rows: 2, max: 160 },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------- leads
  'leadCampaign.create': {
    title: 'New lead campaign',
    submitLabel: 'Create campaign',
    sections: [
      {
        fields: [
          { name: 'name', label: 'Name', type: 'text', required: true, span: 2 },
          {
            name: 'leadType',
            label: 'Looking for',
            type: 'select',
            options: enumOptions(LEAD_TYPE),
            defaultValue: 'SCHOOL_ATHLETICS',
            required: true,
          },
          { name: 'schoolType', label: 'Detail', type: 'text', defaultValue: 'high school' },
          { name: 'city', label: 'City', type: 'text', required: true },
          { name: 'state', label: 'State', type: 'text', required: true, max: 2 },
          { name: 'radius', label: 'Radius', type: 'text', placeholder: '25 miles' },
          { name: 'limit', label: 'Cap', type: 'integer', min: 1, help: 'Blank means no cap.' },
          { name: 'skipNoEmail', label: 'Skip rows with no email', type: 'checkbox', defaultValue: true },
          { name: 'autoSend', label: 'Send automatically', type: 'checkbox', defaultValue: false },
        ],
      },
    ],
  },

  'lead.edit': {
    title: 'Edit lead',
    submitLabel: 'Save lead',
    sections: [
      {
        fields: [
          { name: 'schoolName', label: 'Organization', type: 'text', required: true, span: 2 },
          { name: 'contactName', label: 'Contact', type: 'text' },
          { name: 'title', label: 'Title', type: 'text' },
          { name: 'email', label: 'Email', type: 'email' },
          { name: 'phone', label: 'Phone', type: 'tel' },
          { name: 'city', label: 'City', type: 'text' },
          { name: 'state', label: 'State', type: 'text', max: 2 },
          { name: 'website', label: 'Website', type: 'url', span: 2 },
          { name: 'status', label: 'Status', type: 'select', options: enumOptions(LEAD_STATUS), required: true },
        ],
      },
    ],
  },

  // ----------------------------------------------------------------- reviews
  'review.edit': {
    title: 'Moderate review',
    submitLabel: 'Save review',
    sections: [
      {
        fields: [
          { name: 'status', label: 'Status', type: 'select', options: enumOptions(REVIEW_STATUS), required: true },
          { name: 'rating', label: 'Rating', type: 'integer', required: true, min: 1, max: 5 },
          { name: 'title', label: 'Title', type: 'text', span: 2 },
          { name: 'comment', label: 'Comment', type: 'textarea', span: 2, rows: 5 },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------- media
  'media.edit': {
    title: 'Edit media',
    submitLabel: 'Save media',
    sections: [
      {
        fields: [
          { name: 'filename', label: 'Filename', type: 'text', required: true, span: 2 },
          { name: 'alt', label: 'Alt text', type: 'text', span: 2, help: 'What the picture says, for a reader who cannot see it.' },
          { name: 'caption', label: 'Caption', type: 'textarea', span: 2, rows: 2 },
        ],
      },
    ],
  },

  'media.upload': {
    title: 'Add media by URL',
    subtitle: 'Registers a file already hosted on the CDN. Drag-and-drop upload lives in the media library.',
    submitLabel: 'Add file',
    sections: [
      {
        fields: [
          { name: 'url', label: 'File URL', type: 'url', required: true, span: 2 },
          { name: 'filename', label: 'Filename', type: 'text', required: true },
          { name: 'mimeType', label: 'MIME type', type: 'text', required: true, defaultValue: 'image/jpeg' },
          { name: 'alt', label: 'Alt text', type: 'text', span: 2 },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- messages
  'conversation.edit': {
    title: 'Conversation',
    submitLabel: 'Save conversation',
    sections: [
      {
        fields: [
          { name: 'subject', label: 'Subject', type: 'text', span: 2 },
          {
            name: 'status',
            label: 'Status',
            type: 'select',
            options: enumOptions(CONVERSATION_STATUS),
            required: true,
          },
        ],
      },
    ],
  },

  'chat.edit': {
    title: 'Live chat thread',
    submitLabel: 'Save thread',
    sections: [
      {
        fields: [
          { name: 'status', label: 'Status', type: 'select', options: enumOptions(CHAT_STATUS), required: true },
          { name: 'assignedAdminId', label: 'Assigned to', type: 'select', optionsFrom: 'staff' },
          { name: 'closedReason', label: 'Closing note', type: 'textarea', span: 2, rows: 2 },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------- users
  'user.create': {
    title: 'New user',
    submitLabel: 'Create user',
    sections: [
      {
        fields: [
          { name: 'name', label: 'Name', type: 'text', required: true, span: 2 },
          { name: 'email', label: 'Email', type: 'email', required: true, span: 2 },
          {
            name: 'password',
            label: 'Password',
            type: 'password',
            required: true,
            span: 2,
            help: 'At least 8 characters. They can change it after signing in.',
          },
          { name: 'role', label: 'Role', type: 'select', options: enumOptions(USER_ROLE), required: true, defaultValue: 'STAFF' },
          { name: 'phone', label: 'Phone', type: 'tel' },
        ],
      },
    ],
  },

  'user.edit': {
    title: 'Edit user',
    submitLabel: 'Save user',
    sections: [
      {
        fields: [
          { name: 'name', label: 'Name', type: 'text', required: true, span: 2 },
          { name: 'email', label: 'Email', type: 'email', required: true, span: 2 },
          { name: 'role', label: 'Role', type: 'select', options: enumOptions(USER_ROLE), required: true },
          { name: 'phone', label: 'Phone', type: 'tel' },
          { name: 'isEmailVerified', label: 'Email verified', type: 'checkbox' },
          {
            name: 'password',
            label: 'New password',
            type: 'password',
            span: 2,
            help: 'Leave blank to keep the current one.',
          },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- settings
  'settings.store': {
    title: 'Store settings',
    submitLabel: 'Save settings',
    width: 640,
    sections: [
      {
        label: 'Identity',
        fields: [
          { name: 'businessName', label: 'Business name', type: 'text', span: 2 },
          { name: 'supportEmail', label: 'Support email', type: 'email' },
          { name: 'supportPhone', label: 'Support phone', type: 'tel' },
          { name: 'businessAddress', label: 'Address', type: 'textarea', span: 2, rows: 2 },
        ],
      },
      {
        label: 'Checkout',
        fields: [
          { name: 'allowGuestCheckout', label: 'Allow guest checkout', type: 'checkbox' },
          { name: 'minimumOrderCents', label: 'Minimum order (cents)', type: 'integer', min: 0 },
          { name: 'defaultLowStockThreshold', label: 'Default reorder point', type: 'integer', min: 0 },
        ],
      },
    ],
  },

  'settings.seo': {
    title: 'Search settings',
    submitLabel: 'Save search settings',
    width: 640,
    sections: [
      {
        fields: [
          { name: 'siteName', label: 'Site name', type: 'text', required: true, span: 2 },
          { name: 'siteUrl', label: 'Site URL', type: 'url', required: true, span: 2 },
          {
            name: 'siteDescription',
            label: 'Site description',
            type: 'textarea',
            required: true,
            span: 2,
            rows: 2,
            max: 160,
          },
          { name: 'twitterHandle', label: 'X / Twitter handle', type: 'text' },
          { name: 'defaultOgImage', label: 'Default OG image', type: 'url' },
          {
            name: 'robotsTxt',
            label: 'robots.txt',
            type: 'textarea',
            span: 2,
            rows: 6,
            help: 'A tree blocked here is never crawled, so a noindex tag inside it is never read.',
          },
        ],
      },
    ],
  },

  // ----------------------------------------------------------------- returns
  'return.edit': {
    title: 'Edit return',
    subtitle: 'Where the RMA stands, and what the customer gets back.',
    submitLabel: 'Save return',
    sections: [
      {
        fields: [
          { name: 'status', label: 'Status', type: 'select', options: enumOptions(RETURN_STATUS), required: true },
          {
            name: 'resolution',
            label: 'Resolution',
            type: 'select',
            options: enumOptions(RETURN_RESOLUTION),
            required: true,
          },
          { name: 'reason', label: 'Reason', type: 'select', options: enumOptions(RETURN_REASON), required: true },
          {
            name: 'restockingFee',
            label: 'Restocking fee',
            type: 'money',
            help: 'Withheld from the refund. Blank means none.',
          },
          { name: 'adminNote', label: 'Internal note', type: 'textarea', span: 2, rows: 3 },
        ],
      },
    ],
  },

  // --------------------------------------------------------------- suppliers
  'supplier.edit': {
    title: 'Edit supplier',
    submitLabel: 'Save supplier',
    sections: [
      {
        fields: [
          { name: 'name', label: 'Supplier', type: 'text', required: true, span: 2 },
          { name: 'contactName', label: 'Contact', type: 'text' },
          { name: 'email', label: 'Email', type: 'email' },
          { name: 'phone', label: 'Phone', type: 'tel' },
          { name: 'city', label: 'City', type: 'text' },
          { name: 'state', label: 'State', type: 'text', max: 2 },
          { name: 'notes', label: 'Notes', type: 'textarea', span: 2, rows: 3 },
          { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
        ],
      },
    ],
  },

  // --------------------------------------------------------------- locations
  'location.create': {
    title: 'New stockist',
    subtitle: 'A shop that carries the jars, for the store locator.',
    submitLabel: 'Add stockist',
    sections: [
      {
        fields: [
          { name: 'businessName', label: 'Business', type: 'text', required: true, span: 2 },
          { name: 'address', label: 'Address', type: 'text', required: true, span: 2 },
          { name: 'city', label: 'City', type: 'text', required: true },
          { name: 'state', label: 'State', type: 'text', required: true, max: 2 },
          { name: 'zipCode', label: 'ZIP', type: 'text' },
          { name: 'phone', label: 'Phone', type: 'tel' },
          { name: 'website', label: 'Website', type: 'url', span: 2 },
          { name: 'isActive', label: 'Show on the locator', type: 'checkbox', defaultValue: true },
        ],
      },
    ],
  },

  'location.edit': {
    title: 'Edit stockist',
    submitLabel: 'Save stockist',
    sections: [
      {
        fields: [
          { name: 'businessName', label: 'Business', type: 'text', required: true, span: 2 },
          { name: 'address', label: 'Address', type: 'text', required: true, span: 2 },
          { name: 'city', label: 'City', type: 'text', required: true },
          { name: 'state', label: 'State', type: 'text', required: true, max: 2 },
          { name: 'zipCode', label: 'ZIP', type: 'text' },
          { name: 'phone', label: 'Phone', type: 'tel' },
          { name: 'website', label: 'Website', type: 'url', span: 2 },
          { name: 'isActive', label: 'Show on the locator', type: 'checkbox' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------- manifests
  'manifest.edit': {
    title: 'Packing manifest',
    subtitle: 'What went to the show, and what came back.',
    submitLabel: 'Save manifest',
    sections: [
      {
        fields: [
          { name: 'status', label: 'Status', type: 'select', options: enumOptions(MANIFEST_STATUS), required: true },
          { name: 'notes', label: 'Notes', type: 'textarea', span: 2, rows: 3 },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ arena
  'team.edit': {
    title: 'Edit arena team',
    submitLabel: 'Save team',
    sections: [
      {
        fields: [
          { name: 'name', label: 'Team', type: 'text', required: true, span: 2 },
          { name: 'school', label: 'School', type: 'text', required: true, span: 2 },
          { name: 'status', label: 'Status', type: 'select', options: enumOptions(TEAM_STATUS), required: true },
          { name: 'goalAmount', label: 'Goal (gross sales)', type: 'integer', min: 0 },
          { name: 'contactName', label: 'Contact', type: 'text' },
          { name: 'contactEmail', label: 'Contact email', type: 'email' },
          { name: 'tagline', label: 'Tagline', type: 'text', span: 2 },
        ],
      },
    ],
  },

  // ---------------------------------------------------------- email marketing
  'automation.edit': {
    title: 'Edit automation',
    submitLabel: 'Save automation',
    sections: [
      {
        fields: [
          { name: 'name', label: 'Automation', type: 'text', required: true, span: 2 },
          { name: 'description', label: 'Description', type: 'textarea', span: 2, rows: 2 },
          { name: 'isActive', label: 'Running', type: 'checkbox' },
        ],
      },
    ],
  },

  'list.create': {
    title: 'New mailing list',
    submitLabel: 'Create list',
    sections: [
      {
        fields: [
          { name: 'name', label: 'List name', type: 'text', required: true, span: 2 },
          { name: 'description', label: 'Description', type: 'textarea', span: 2, rows: 2 },
          { name: 'isDefault', label: 'Default list for new sign-ups', type: 'checkbox' },
        ],
      },
    ],
  },

  'list.edit': {
    title: 'Edit mailing list',
    submitLabel: 'Save list',
    sections: [
      {
        fields: [
          { name: 'name', label: 'List name', type: 'text', required: true, span: 2 },
          { name: 'description', label: 'Description', type: 'textarea', span: 2, rows: 2 },
          { name: 'isDefault', label: 'Default list for new sign-ups', type: 'checkbox' },
        ],
      },
    ],
  },

  'subscriber.create': {
    title: 'Add subscriber',
    submitLabel: 'Add subscriber',
    sections: [
      {
        fields: [
          { name: 'listId', label: 'List', type: 'select', optionsFrom: 'mailingLists', required: true, span: 2 },
          { name: 'email', label: 'Email', type: 'email', required: true, span: 2 },
          { name: 'firstName', label: 'First name', type: 'text' },
          { name: 'lastName', label: 'Last name', type: 'text' },
          { name: 'source', label: 'Source', type: 'text', placeholder: 'desktop' },
        ],
      },
    ],
  },

  'subscriber.edit': {
    title: 'Edit subscriber',
    submitLabel: 'Save subscriber',
    sections: [
      {
        fields: [
          { name: 'email', label: 'Email', type: 'email', required: true, span: 2 },
          { name: 'firstName', label: 'First name', type: 'text' },
          { name: 'lastName', label: 'Last name', type: 'text' },
          {
            name: 'status',
            label: 'Status',
            type: 'select',
            options: enumOptions(SUBSCRIBER_STATUS),
            required: true,
          },
          {
            name: 'tags',
            label: 'Tags',
            type: 'text',
            span: 2,
            help: 'Comma-separated. Subscriber tags are free text, not a fixed list.',
          },
        ],
      },
    ],
  },

  'suppression.create': {
    title: 'Suppress an address',
    subtitle: 'Nothing is ever sent to a suppressed address, by any campaign.',
    submitLabel: 'Suppress',
    sections: [
      {
        fields: [
          { name: 'email', label: 'Email', type: 'email', required: true, span: 2 },
          {
            name: 'reason',
            label: 'Reason',
            type: 'select',
            options: enumOptions(SUPPRESSION_REASON),
            required: true,
            defaultValue: 'MANUAL',
          },
          { name: 'notes', label: 'Note', type: 'textarea', span: 2, rows: 2 },
        ],
      },
    ],
  },

  'settings.brand': {
    title: 'Brand kit',
    subtitle: 'What every marketing email inherits when a template says nothing.',
    submitLabel: 'Save brand kit',
    width: 640,
    sections: [
      {
        fields: [
          { name: 'logoUrl', label: 'Logo URL', type: 'url', span: 2 },
          { name: 'primaryColor', label: 'Primary colour', type: 'text', placeholder: '#8B1A1A' },
          { name: 'secondaryColor', label: 'Secondary colour', type: 'text', placeholder: '#FFFFFF' },
          { name: 'accentColor', label: 'Accent colour', type: 'text' },
          { name: 'fontFamily', label: 'Font stack', type: 'text' },
          { name: 'websiteUrl', label: 'Website', type: 'url', span: 2 },
          {
            name: 'physicalAddress',
            label: 'Postal address',
            type: 'textarea',
            span: 2,
            rows: 2,
            help: 'CAN-SPAM requires a real postal address in every marketing email.',
          },
        ],
      },
    ],
  },

  // ----------------------------------------------------------------- content
  'page.create': {
    title: 'New page',
    submitLabel: 'Create page',
    sections: [
      {
        fields: [
          { name: 'title', label: 'Title', type: 'text', required: true, span: 2 },
          { name: 'slug', label: 'Slug', type: 'slug', required: true, span: 2, slugFrom: 'title' },
          { name: 'kind', label: 'Kind', type: 'select', options: enumOptions(PAGE_KIND), defaultValue: 'LANDING' },
          {
            name: 'status',
            label: 'Status',
            type: 'select',
            options: enumOptions(CONTENT_STATUS),
            defaultValue: 'DRAFT',
          },
          {
            name: 'seoTitle',
            label: 'Meta title',
            type: 'text',
            span: 2,
            max: 60,
            help: '30–60 characters. Blank falls back to the page title.',
          },
          {
            name: 'seoDescription',
            label: 'Meta description',
            type: 'textarea',
            span: 2,
            rows: 2,
            max: 160,
            help: '160 characters at most.',
          },
          { name: 'noIndex', label: 'Keep out of Google', type: 'checkbox' },
        ],
      },
    ],
  },

  'page.edit': {
    title: 'Edit page',
    submitLabel: 'Save page',
    sections: [
      {
        fields: [
          { name: 'title', label: 'Title', type: 'text', required: true, span: 2 },
          { name: 'slug', label: 'Slug', type: 'slug', required: true, span: 2 },
          { name: 'kind', label: 'Kind', type: 'select', options: enumOptions(PAGE_KIND) },
          { name: 'status', label: 'Status', type: 'select', options: enumOptions(CONTENT_STATUS) },
          { name: 'scheduledFor', label: 'Scheduled for', type: 'datetime' },
          { name: 'canonicalUrl', label: 'Canonical URL', type: 'url' },
          { name: 'seoTitle', label: 'Meta title', type: 'text', span: 2, max: 60 },
          { name: 'seoDescription', label: 'Meta description', type: 'textarea', span: 2, rows: 2, max: 160 },
          { name: 'noIndex', label: 'Keep out of Google', type: 'checkbox' },
        ],
      },
    ],
  },

  'banner.create': {
    title: 'New banner',
    submitLabel: 'Create banner',
    sections: [
      {
        fields: [
          { name: 'name', label: 'Name', type: 'text', required: true, span: 2 },
          {
            name: 'placement',
            label: 'Placement',
            type: 'select',
            options: enumOptions(BANNER_PLACEMENT),
            defaultValue: 'SITE_WIDE_TOP',
          },
          {
            name: 'status',
            label: 'Status',
            type: 'select',
            options: enumOptions(CONTENT_STATUS),
            defaultValue: 'DRAFT',
          },
          { name: 'headline', label: 'Headline', type: 'text', span: 2 },
          { name: 'body', label: 'Body', type: 'textarea', span: 2, rows: 2 },
          { name: 'ctaText', label: 'Button text', type: 'text' },
          { name: 'ctaHref', label: 'Button link', type: 'text' },
          { name: 'imageUrl', label: 'Image URL', type: 'url', span: 2 },
          { name: 'startsAt', label: 'Starts', type: 'datetime' },
          { name: 'endsAt', label: 'Ends', type: 'datetime' },
          { name: 'priority', label: 'Priority', type: 'integer', min: 0 },
        ],
      },
    ],
  },

  'banner.edit': {
    title: 'Edit banner',
    submitLabel: 'Save banner',
    sections: [
      {
        fields: [
          { name: 'name', label: 'Name', type: 'text', required: true, span: 2 },
          { name: 'placement', label: 'Placement', type: 'select', options: enumOptions(BANNER_PLACEMENT) },
          { name: 'status', label: 'Status', type: 'select', options: enumOptions(CONTENT_STATUS) },
          { name: 'headline', label: 'Headline', type: 'text', span: 2 },
          { name: 'body', label: 'Body', type: 'textarea', span: 2, rows: 2 },
          { name: 'ctaText', label: 'Button text', type: 'text' },
          { name: 'ctaHref', label: 'Button link', type: 'text' },
          { name: 'imageUrl', label: 'Image URL', type: 'url', span: 2 },
          { name: 'startsAt', label: 'Starts', type: 'datetime' },
          { name: 'endsAt', label: 'Ends', type: 'datetime' },
          { name: 'priority', label: 'Priority', type: 'integer', min: 0 },
        ],
      },
    ],
  },

  'faq.create': {
    title: 'New FAQ',
    submitLabel: 'Create FAQ',
    sections: [
      {
        fields: [
          { name: 'question', label: 'Question', type: 'text', required: true, span: 2 },
          { name: 'answer', label: 'Answer', type: 'textarea', required: true, span: 2, rows: 5 },
          {
            name: 'status',
            label: 'Status',
            type: 'select',
            options: enumOptions(CONTENT_STATUS),
            defaultValue: 'PUBLISHED',
          },
          { name: 'sortOrder', label: 'Sort order', type: 'integer', min: 0 },
        ],
      },
    ],
  },

  'faq.edit': {
    title: 'Edit FAQ',
    submitLabel: 'Save FAQ',
    sections: [
      {
        fields: [
          { name: 'question', label: 'Question', type: 'text', required: true, span: 2 },
          { name: 'answer', label: 'Answer', type: 'textarea', required: true, span: 2, rows: 5 },
          { name: 'status', label: 'Status', type: 'select', options: enumOptions(CONTENT_STATUS) },
          { name: 'sortOrder', label: 'Sort order', type: 'integer', min: 0 },
        ],
      },
    ],
  },

  'redirect.create': {
    title: 'New redirect',
    subtitle: 'A path that has moved. Google drops the old URL once it sees the 301.',
    submitLabel: 'Create redirect',
    sections: [
      {
        fields: [
          { name: 'source', label: 'From', type: 'text', required: true, span: 2, placeholder: '/old-path' },
          { name: 'destination', label: 'To', type: 'text', required: true, span: 2, placeholder: '/new-path' },
          {
            name: 'permanent',
            label: 'Permanent (301)',
            type: 'checkbox',
            defaultValue: true,
            help: 'Off sends a 302, which tells Google the move is temporary.',
          },
          { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
          { name: 'note', label: 'Note', type: 'textarea', span: 2, rows: 2 },
        ],
      },
    ],
  },

  'redirect.edit': {
    title: 'Edit redirect',
    submitLabel: 'Save redirect',
    sections: [
      {
        fields: [
          { name: 'source', label: 'From', type: 'text', required: true, span: 2 },
          { name: 'destination', label: 'To', type: 'text', required: true, span: 2 },
          { name: 'permanent', label: 'Permanent (301)', type: 'checkbox' },
          { name: 'isActive', label: 'Active', type: 'checkbox' },
          { name: 'note', label: 'Note', type: 'textarea', span: 2, rows: 2 },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- settings
  'settings.shipping': {
    title: 'Shipping settings',
    subtitle: 'The origin the rates are quoted from, and the flat rates used when a carrier will not answer.',
    submitLabel: 'Save shipping',
    width: 640,
    sections: [
      {
        label: 'Ship from',
        fields: [
          { name: 'originStreet', label: 'Street', type: 'text', span: 2 },
          { name: 'originCity', label: 'City', type: 'text' },
          { name: 'originState', label: 'State', type: 'text', max: 2 },
          { name: 'originZip', label: 'ZIP', type: 'text' },
          { name: 'defaultCarrier', label: 'Default carrier', type: 'text' },
        ],
      },
      {
        label: 'Fallback rates',
        fields: [
          {
            name: 'flatRateCents',
            label: 'Flat rate (cents)',
            type: 'integer',
            min: 0,
            help: 'Blank keeps the built-in default in lib/shipping/rate-config.ts.',
          },
          { name: 'weightSurchargeThresholdLb', label: 'Surcharge over (lb)', type: 'integer', min: 0 },
          { name: 'weightSurchargeBaseCents', label: 'Surcharge base (cents)', type: 'integer', min: 0 },
          { name: 'weightSurchargePerLbCents', label: 'Surcharge per lb (cents)', type: 'integer', min: 0 },
          { name: 'internationalRateCents', label: 'International (cents)', type: 'integer', min: 0 },
        ],
      },
    ],
  },
} as const satisfies Record<string, FormSpec>

export type FormId = keyof typeof DESKTOP_FORMS

export function findForm(id: string): FormSpec | undefined {
  return (DESKTOP_FORMS as Record<string, FormSpec>)[id]
}

export function isFormId(value: string): value is FormId {
  return Object.prototype.hasOwnProperty.call(DESKTOP_FORMS, value)
}

/** Every field in a spec, flattened — for defaults, coercion and validation. */
export function formFields(spec: FormSpec): FormField[] {
  return spec.sections.flatMap((section) => section.fields)
}

/** The blank record a create sheet opens with. */
export function defaultValues(spec: FormSpec): FormValues {
  const values: FormValues = {}
  for (const field of formFields(spec)) {
    if (field.defaultValue !== undefined) values[field.name] = field.defaultValue as FieldValue
    else if (field.type === 'checkbox') values[field.name] = false
    else if (field.type === 'tags') values[field.name] = []
    else if (field.type === 'lines') values[field.name] = []
    else values[field.name] = ''
  }
  return values
}

/** The option sources a spec needs before it can be drawn. */
export function requiredOptionSources(spec: FormSpec): OptionSource[] {
  const sources = new Set<OptionSource>()
  for (const field of formFields(spec)) {
    if (field.optionsFrom) sources.add(field.optionsFrom)
    for (const item of field.itemFields ?? []) {
      if (item.optionsFrom) sources.add(item.optionsFrom)
    }
  }
  return [...sources]
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

// ---------------------------------------------------------------------------
// direct operations
// ---------------------------------------------------------------------------

/**
 * Writes that need no form — a button and, where it matters, a confirmation.
 *
 * They share the write route and the handler registry with the forms above; the
 * only difference is that the shell sends no values, so everything the handler
 * needs has to come from the record it is given.
 */
export const DIRECT_OPS = [
  'order.cancel',
  'order.markPaid',
  'product.delete',
  'product.toggleActive',
  'customer.delete',
  'fundraiser.end',
  'fundraiser.delete',
  'participant.delete',
  'event.delete',
  'purchase.submit',
  'purchase.receive',
  'purchase.cancel',
  'invoice.markSent',
  'invoice.markPaid',
  'invoice.delete',
  'wholesale.approve',
  'wholesale.suspend',
  'ledger.delete',
  'ledger.markExported',
  'campaign.pause',
  'campaign.resume',
  'campaign.cancel',
  'campaign.delete',
  'social.delete',
  'post.publish',
  'post.delete',
  'lead.delete',
  'review.approve',
  'review.reject',
  'review.delete',
  'media.delete',
  'conversation.close',
  'conversation.reopen',
  'chat.close',
  'user.delete',
  'return.approve',
  'return.receive',
  'return.complete',
  'return.reject',
  'supplier.deactivate',
  'location.delete',
  'team.approve',
  'team.suspend',
  'automation.activate',
  'automation.pause',
  'subscriber.unsubscribe',
  'subscriber.delete',
  'suppression.delete',
  'page.publish',
  'page.delete',
  'banner.delete',
  'faq.delete',
  'redirect.delete',
  'redirect.toggle',
  'notification.markRead',
  'notification.markAllRead',
  'integration.enable',
  'integration.disable',
] as const

export type DirectOpId = (typeof DIRECT_OPS)[number]

/** Every id the write route will answer to. */
export type WriteOpId = FormId | DirectOpId

export function isDirectOpId(value: string): value is DirectOpId {
  return (DIRECT_OPS as readonly string[]).includes(value)
}

export function isWriteOpId(value: string): value is WriteOpId {
  return isFormId(value) || isDirectOpId(value)
}
