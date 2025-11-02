import type {
  BusinessFormCategory,
  BusinessFormTemplate,
  BusinessFormSection,
  BusinessFormField,
} from '@/types/forms'

export const businessFormCategories: BusinessFormCategory[] = [
  {
    id: 'sales',
    label: 'Sales & Ordering',
    description: 'Order forms and agreements for wholesale partners, events, and direct customers.',
  },
  {
    id: 'fundraising',
    label: 'Fundraising',
    description: 'Ready-to-use fundraising kits, tally sheets, and volunteer organizers.',
  },
  {
    id: 'hr',
    label: 'People & HR',
    description: 'Payroll, onboarding, and contractor paperwork to keep the team aligned.',
  },
  {
    id: 'finance',
    label: 'Finance & Accounting',
    description: 'Expense reporting, tax prep, and bookkeeping documentation.',
  },
  {
    id: 'operations',
    label: 'Operations',
    description: 'Event logistics, inventory counts, and delivery checklists for day-to-day execution.',
  },
]

const customerInformationSection: BusinessFormSection = {
  id: 'customer-info',
  label: 'Customer Information',
  description: 'Collect billing, shipping, and main point-of-contact details.',
  defaultIncluded: true,
  fields: [
    { id: 'account-name', label: 'Organization / Account Name', type: 'short-text', placeholder: 'School, retailer, or business name' },
    { id: 'primary-contact', label: 'Primary Contact Name', type: 'short-text', placeholder: 'First Last' },
    { id: 'contact-email', label: 'Contact Email', type: 'short-text', placeholder: 'name@example.com' },
    { id: 'contact-phone', label: 'Phone', type: 'short-text', placeholder: '(555) 555-5555' },
    { id: 'billing-address', label: 'Billing Address', type: 'long-text', placeholder: 'Street, City, State ZIP' },
    { id: 'shipping-address', label: 'Shipping Address', type: 'long-text', placeholder: 'Street, City, State ZIP (if different)' },
  ],
}

const wholesaleOrderItems: BusinessFormSection = {
  id: 'order-items',
  label: 'Order Items',
  description: 'Line-item detail for wholesale product ordering.',
  defaultIncluded: true,
  fields: [
    {
      id: 'order-table',
      label: 'Wholesale Items',
      type: 'table',
      columns: ['SKU', 'Product Name', 'Heat Level', 'Units', 'Unit Cost', 'Extended'],
      defaultRows: 10,
    },
  ],
}

const shippingAndDeliverySection: BusinessFormSection = {
  id: 'delivery',
  label: 'Shipping & Delivery',
  description: 'Delivery expectations, lead times, and logistics notes.',
  fields: [
    { id: 'requested-date', label: 'Requested Delivery / Pickup Date', type: 'date' },
    { id: 'delivery-window', label: 'Delivery Window or Pickup Time', type: 'short-text', placeholder: 'e.g., Week of March 4' },
    { id: 'delivery-notes', label: 'Delivery Notes', type: 'long-text', placeholder: 'Dock details, lift-gate needs, point of contact on site' },
  ],
}

const paymentTermsSection: BusinessFormSection = {
  id: 'payment-terms',
  label: 'Payment Terms',
  fields: [
    { id: 'terms', label: 'Payment Terms', type: 'short-text', placeholder: 'Net 15, Net 30, credit card, etc.' },
    { id: 'deposit', label: 'Deposit Received?', type: 'checkbox' },
    { id: 'balance-due', label: 'Balance Due', type: 'short-text', placeholder: '$0.00' },
  ],
}

const authorizationSection: BusinessFormSection = {
  id: 'authorization',
  label: 'Authorization',
  defaultIncluded: true,
  fields: [
    { id: 'prepared-by', label: 'Prepared By', type: 'short-text' },
    { id: 'prepared-date', label: 'Date', type: 'date' },
    { id: 'authorized-signature', label: 'Authorized Signature', type: 'signature' },
  ],
}

const fundraisingSummarySection: BusinessFormSection = {
  id: 'fundraiser-summary',
  label: 'Fundraiser Summary',
  defaultIncluded: true,
  fields: [
    {
      id: 'fundraiser-tally',
      label: 'Fundraiser Order Tally',
      type: 'table',
      columns: ['Participant', 'Product / Bundle', 'Qty Sold', 'Total Collected', 'Payment Method'],
      defaultRows: 12,
    },
    {
      id: 'fundraiser-goals',
      label: 'Goal vs Actual Notes',
      type: 'long-text',
      placeholder: 'Summarize goals, actual totals, and shout-outs for top sellers.',
    },
  ],
}

const volunteerRosterSection: BusinessFormSection = {
  id: 'volunteer-roster',
  label: 'Volunteer Shift Roster',
  fields: [
    {
      id: 'volunteer-table',
      label: 'Volunteer Assignments',
      type: 'table',
      columns: ['Volunteer', 'Shift Time', 'Role', 'Phone', 'Checked In'],
      defaultRows: 10,
    },
  ],
}

const payrollTimesheetSection: BusinessFormSection = {
  id: 'timesheet',
  label: 'Payroll Timesheet',
  defaultIncluded: true,
  fields: [
    {
      id: 'timesheet-table',
      label: 'Daily Hours',
      type: 'table',
      columns: ['Date', 'Location/Event', 'Time In', 'Time Out', 'Break', 'Total Hours', 'Manager Initials'],
      defaultRows: 14,
    },
  ],
}

const expenseReportSection: BusinessFormSection = {
  id: 'expense-report',
  label: 'Expense Details',
  defaultIncluded: true,
  fields: [
    {
      id: 'expense-table',
      label: 'Expense Line Items',
      type: 'table',
      columns: ['Date', 'Vendor', 'Category', 'Description', 'Amount'],
      defaultRows: 8,
    },
    {
      id: 'reimbursement-notes',
      label: 'Notes / Approvals',
      type: 'long-text',
      placeholder: 'Attach receipts and include any approval notes here.',
    },
  ],
}

const inventoryCountSection: BusinessFormSection = {
  id: 'inventory-count',
  label: 'Inventory Count',
  defaultIncluded: true,
  fields: [
    {
      id: 'inventory-table',
      label: 'Inventory Snapshot',
      type: 'table',
      columns: ['SKU', 'Product', 'On Hand', 'Committed', 'Available', 'Notes'],
      defaultRows: 12,
    },
  ],
}

function buildTemplate(
  template: Omit<BusinessFormTemplate, 'sections'> & { sections: BusinessFormSection[] },
): BusinessFormTemplate {
  return template
}

export const businessFormTemplates: BusinessFormTemplate[] = [
  buildTemplate({
    id: 'wholesale-order-form',
    name: 'Wholesale Order Form',
    categoryId: 'sales',
    description: 'Line-item order form for retail partners and distributors placing wholesale Jose Madrid Salsa orders.',
    tags: ['wholesale', 'ordering', 'retail'],
    estimatedCompletion: '8 minutes',
    recommendedUses: [
      'Capture wholesale orders at food shows or rep visits.',
      'Share with retail partners who prefer fax or email ordering.',
      'Attach to invoices for paper trail of approvals.',
    ],
    sections: [customerInformationSection, wholesaleOrderItems, shippingAndDeliverySection, paymentTermsSection, authorizationSection],
    publicSlug: 'wholesale-order-form',
  }),
  buildTemplate({
    id: 'fundraiser-tally-sheet',
    name: 'Fundraiser Order Tally Sheet',
    categoryId: 'fundraising',
    description: 'Track participant sales, payment collection, and final totals during Jose Madrid Salsa fundraisers.',
    tags: ['fundraising', 'events', 'schools'],
    estimatedCompletion: '5 minutes',
    recommendedUses: [
      'Provide to fundraising leads for nightly tally sessions.',
      'Use at pickup day to verify orders and payments.',
      'Share as a PDF to volunteers for door-to-door sales tracking.',
    ],
    sections: [customerInformationSection, fundraisingSummarySection, volunteerRosterSection, authorizationSection],
    publicSlug: 'fundraiser-tally-sheet',
  }),
  buildTemplate({
    id: 'event-sign-in',
    name: 'Event / Sampling Sign-In Sheet',
    categoryId: 'operations',
    description: 'Collect attendee or partner information at farmers markets, demos, and tasting events.',
    tags: ['events', 'marketing'],
    estimatedCompletion: '3 minutes',
    recommendedUses: [
      'Capture emails and phone numbers during tasting events.',
      'Track vendor booth visitors at markets.',
      'Log sample requests for follow-up.',
    ],
    sections: [
      customerInformationSection,
      {
        id: 'event-attendees',
        label: 'Attendee List',
        defaultIncluded: true,
        fields: [
          {
            id: 'attendee-table',
            label: 'Sign-In',
            type: 'table',
            columns: ['Name', 'Email', 'Phone', 'Favorite Flavor', 'Follow-up?'],
            defaultRows: 18,
          },
        ],
      },
      authorizationSection,
    ],
    publicSlug: 'event-sign-in-sheet',
  }),
  buildTemplate({
    id: 'payroll-timesheet',
    name: 'Payroll Timesheet',
    categoryId: 'hr',
    description: 'Weekly payroll log for production staff, event teams, and seasonal workers.',
    tags: ['payroll', 'hr'],
    estimatedCompletion: '6 minutes',
    recommendedUses: [
      'Capture weekly hours for event staff and production crews.',
      'Attach to payroll submissions or QuickBooks timesheets.',
      'Use as a backup when POS time clocks are offline.',
    ],
    sections: [customerInformationSection, payrollTimesheetSection, authorizationSection],
    publicSlug: 'payroll-timesheet',
  }),
  buildTemplate({
    id: 'expense-report',
    name: 'Expense Reimbursement Form',
    categoryId: 'finance',
    description: 'Standardized expense report for mileage, supplies, and event purchases.',
    tags: ['finance', 'expenses'],
    estimatedCompletion: '7 minutes',
    recommendedUses: [
      'Submit reimbursements for travel to events or supply runs.',
      'Attach to monthly bookkeeping packages.',
      'Collect approvals before syncing to QuickBooks or Xero.',
    ],
    sections: [customerInformationSection, expenseReportSection, authorizationSection],
    publicSlug: 'expense-report',
  }),
  buildTemplate({
    id: 'inventory-count',
    name: 'Inventory Count Sheet',
    categoryId: 'operations',
    description: 'Printable count sheet for jar inventory, merch, and event kits.',
    tags: ['inventory', 'operations'],
    estimatedCompletion: '4 minutes',
    recommendedUses: [
      'Perform weekly warehouse counts.',
      'Track event kit inventory before and after pop-ups.',
      'Audit merch stock for online store fulfillment.',
    ],
    sections: [customerInformationSection, inventoryCountSection, authorizationSection],
    publicSlug: 'inventory-count-sheet',
  }),
]

export type FormBlockLibraryItem = {
  id: string
  label: string
  description: string
  section: BusinessFormSection
}

export const formBlockLibrary: FormBlockLibraryItem[] = [
  {
    id: 'terms-and-conditions',
    label: 'Terms & Conditions',
    description: 'Standard Jose Madrid Salsa wholesale and fundraising terms with signature line.',
    section: {
      id: 'terms-conditions',
      label: 'Terms & Conditions',
      fields: [
        {
          id: 'terms-text',
          label: 'Standard Terms',
          type: 'long-text',
          placeholder:
            'Payment is due within 15 days. Late payments may incur a finance charge. Please report damages within 48 hours of delivery.',
        },
        { id: 'terms-signature', label: 'Customer Signature', type: 'signature' },
      ],
    },
  },
  {
    id: 'marketing-consent',
    label: 'Marketing Consent',
    description: 'Opt-in checkbox for newsletters and promotional updates.',
    section: {
      id: 'marketing-opt-in',
      label: 'Marketing Opt-In',
      fields: [
        {
          id: 'marketing-checkbox',
          label: 'Yes, add us to the Jose Madrid Salsa wholesale newsletter.',
          type: 'checkbox',
        },
        {
          id: 'marketing-notes',
          label: 'Preferred communication channel or notes',
          type: 'long-text',
        },
      ],
    },
  },
  {
    id: 'payment-receipt',
    label: 'Payment Receipt Stub',
    description: 'Detachable stub acknowledging payment received for cash/check handling.',
    section: {
      id: 'payment-receipt-stub',
      label: 'Payment Receipt',
      fields: [
        { id: 'payment-date', label: 'Payment Date', type: 'date' },
        { id: 'payment-method', label: 'Payment Method', type: 'short-text', placeholder: 'Cash, Check #, Card, etc.' },
        { id: 'amount-received', label: 'Amount Received', type: 'short-text' },
        { id: 'received-by', label: 'Received By', type: 'short-text' },
      ],
    },
  },
]
