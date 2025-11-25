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

const orderTrackingSection: BusinessFormSection = {
  id: 'order-tracking',
  label: 'Order Tracking',
  defaultIncluded: true,
  fields: [
    {
      id: 'tracking-table',
      label: 'Order Status Tracking',
      type: 'table',
      columns: ['Order #', 'Customer', 'Order Date', 'Status', 'Est. Delivery', 'Notes'],
      defaultRows: 15,
    },
  ],
}

const orderFulfillmentSection: BusinessFormSection = {
  id: 'order-fulfillment',
  label: 'Order Fulfillment Checklist',
  defaultIncluded: true,
  fields: [
    { id: 'order-number', label: 'Order Number', type: 'short-text', placeholder: '#12345' },
    { id: 'customer-name', label: 'Customer Name', type: 'short-text' },
    {
      id: 'fulfillment-table',
      label: 'Items to Pack',
      type: 'table',
      columns: ['SKU', 'Product', 'Qty Ordered', 'Qty Packed', 'Bin Location', 'Checked'],
      defaultRows: 8,
    },
    { id: 'packer-name', label: 'Packed By', type: 'short-text' },
    { id: 'quality-check', label: 'Quality Check Completed', type: 'checkbox' },
  ],
}

const webOrderSection: BusinessFormSection = {
  id: 'web-order-details',
  label: 'Web Order Details',
  defaultIncluded: true,
  fields: [
    { id: 'order-id', label: 'Online Order ID', type: 'short-text', placeholder: 'WEB-12345' },
    { id: 'platform', label: 'Platform', type: 'short-text', placeholder: 'Website, Amazon, Etsy, etc.' },
    { id: 'payment-status', label: 'Payment Status', type: 'short-text', placeholder: 'Paid, Pending, etc.' },
    { id: 'shipping-method', label: 'Shipping Method', type: 'short-text', placeholder: 'USPS, UPS, FedEx' },
    { id: 'tracking-number', label: 'Tracking Number', type: 'short-text' },
  ],
}

const purchaseOrderSection: BusinessFormSection = {
  id: 'purchase-order',
  label: 'Purchase Order Items',
  defaultIncluded: true,
  fields: [
    { id: 'po-number', label: 'PO Number', type: 'short-text', placeholder: 'PO-2025-001' },
    { id: 'vendor-name', label: 'Vendor Name', type: 'short-text' },
    {
      id: 'po-table',
      label: 'Items to Purchase',
      type: 'table',
      columns: ['Item', 'Description', 'Qty', 'Unit Price', 'Total', 'Notes'],
      defaultRows: 10,
    },
  ],
}

const qualityControlSection: BusinessFormSection = {
  id: 'quality-control',
  label: 'Quality Control Inspection',
  defaultIncluded: true,
  fields: [
    { id: 'batch-number', label: 'Batch/Lot Number', type: 'short-text' },
    { id: 'production-date', label: 'Production Date', type: 'date' },
    {
      id: 'qc-table',
      label: 'Quality Checks',
      type: 'table',
      columns: ['Check Item', 'Standard', 'Result', 'Pass/Fail', 'Notes'],
      defaultRows: 8,
    },
    { id: 'inspector-name', label: 'Inspector Name', type: 'short-text' },
    { id: 'approved', label: 'Batch Approved for Distribution', type: 'checkbox' },
  ],
}

const customerComplaintSection: BusinessFormSection = {
  id: 'customer-complaint',
  label: 'Complaint Details',
  defaultIncluded: true,
  fields: [
    { id: 'complaint-date', label: 'Date Received', type: 'date' },
    { id: 'complaint-source', label: 'Source', type: 'short-text', placeholder: 'Phone, Email, Social Media' },
    { id: 'issue-summary', label: 'Issue Summary', type: 'long-text', placeholder: 'Brief description of the complaint' },
    { id: 'resolution', label: 'Resolution Provided', type: 'long-text' },
    { id: 'follow-up', label: 'Follow-up Required', type: 'checkbox' },
  ],
}

const returnAuthorizationSection: BusinessFormSection = {
  id: 'return-authorization',
  label: 'Return Authorization',
  defaultIncluded: true,
  fields: [
    { id: 'rma-number', label: 'RMA Number', type: 'short-text', placeholder: 'RMA-12345' },
    { id: 'return-reason', label: 'Reason for Return', type: 'long-text' },
    {
      id: 'return-items-table',
      label: 'Items Being Returned',
      type: 'table',
      columns: ['SKU', 'Product', 'Qty', 'Condition', 'Refund/Replace'],
      defaultRows: 6,
    },
    { id: 'refund-method', label: 'Refund Method', type: 'short-text', placeholder: 'Original payment, store credit, etc.' },
  ],
}

const shippingManifestSection: BusinessFormSection = {
  id: 'shipping-manifest',
  label: 'Shipping Manifest',
  defaultIncluded: true,
  fields: [
    { id: 'shipment-date', label: 'Shipment Date', type: 'date' },
    { id: 'carrier', label: 'Carrier', type: 'short-text', placeholder: 'USPS, UPS, FedEx' },
    { id: 'total-packages', label: 'Total Packages', type: 'short-text' },
    {
      id: 'manifest-table',
      label: 'Shipment Details',
      type: 'table',
      columns: ['Order #', 'Customer', 'Tracking #', 'Weight', 'Shipping Cost', 'Notes'],
      defaultRows: 12,
    },
  ],
}

const productionScheduleSection: BusinessFormSection = {
  id: 'production-schedule',
  label: 'Production Schedule',
  defaultIncluded: true,
  fields: [
    { id: 'week-of', label: 'Week Of', type: 'date' },
    {
      id: 'production-table',
      label: 'Weekly Production Plan',
      type: 'table',
      columns: ['Day', 'Product', 'Batch Size', 'Start Time', 'Est. Completion', 'Assigned To'],
      defaultRows: 10,
    },
  ],
}

const vendorPaymentSection: BusinessFormSection = {
  id: 'vendor-payment',
  label: 'Vendor Payment Details',
  defaultIncluded: true,
  fields: [
    { id: 'vendor-name', label: 'Vendor Name', type: 'short-text' },
    { id: 'invoice-number', label: 'Invoice Number', type: 'short-text' },
    { id: 'invoice-date', label: 'Invoice Date', type: 'date' },
    { id: 'payment-due', label: 'Payment Due Date', type: 'date' },
    {
      id: 'payment-items-table',
      label: 'Invoice Line Items',
      type: 'table',
      columns: ['Description', 'Qty', 'Unit Cost', 'Amount', 'Account Code'],
      defaultRows: 8,
    },
    { id: 'total-amount', label: 'Total Amount Due', type: 'short-text' },
  ],
}

const maintenanceLogSection: BusinessFormSection = {
  id: 'maintenance-log',
  label: 'Equipment Maintenance Log',
  defaultIncluded: true,
  fields: [
    { id: 'equipment-name', label: 'Equipment Name', type: 'short-text' },
    { id: 'equipment-id', label: 'Equipment ID', type: 'short-text' },
    {
      id: 'maintenance-table',
      label: 'Maintenance History',
      type: 'table',
      columns: ['Date', 'Type', 'Description', 'Technician', 'Next Service', 'Cost'],
      defaultRows: 10,
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
  buildTemplate({
    id: 'order-tracking-log',
    name: 'Order Tracking Log',
    categoryId: 'sales',
    description: 'Track order status from placement through delivery for wholesale and retail orders.',
    tags: ['orders', 'tracking', 'logistics'],
    estimatedCompletion: '5 minutes',
    recommendedUses: [
      'Monitor order progress for customer service inquiries.',
      'Track multiple orders in transit for weekly reviews.',
      'Keep delivery schedules visible for warehouse teams.',
    ],
    sections: [orderTrackingSection, authorizationSection],
    publicSlug: 'order-tracking-log',
  }),
  buildTemplate({
    id: 'order-fulfillment-checklist',
    name: 'Order Fulfillment Checklist',
    categoryId: 'operations',
    description: 'Step-by-step checklist to ensure accurate picking, packing, and shipping of orders.',
    tags: ['fulfillment', 'warehouse', 'shipping'],
    estimatedCompletion: '6 minutes',
    recommendedUses: [
      'Attach to packing slips for order accuracy verification.',
      'Use in warehouse to guide pickers through fulfillment.',
      'Archive as proof of shipment accuracy for customer service.',
    ],
    sections: [orderFulfillmentSection, shippingAndDeliverySection, authorizationSection],
    publicSlug: 'order-fulfillment-checklist',
  }),
  buildTemplate({
    id: 'web-order-management',
    name: 'Web Order Management Form',
    categoryId: 'sales',
    description: 'Capture online order details from e-commerce platforms for processing and fulfillment.',
    tags: ['ecommerce', 'web orders', 'online sales'],
    estimatedCompletion: '5 minutes',
    recommendedUses: [
      'Process orders from website, Amazon, Etsy, or marketplace platforms.',
      'Track payment and shipping details for online sales.',
      'Print for warehouse teams unfamiliar with online dashboards.',
    ],
    sections: [customerInformationSection, webOrderSection, wholesaleOrderItems, authorizationSection],
    publicSlug: 'web-order-management',
  }),
  buildTemplate({
    id: 'purchase-order-form',
    name: 'Purchase Order Form',
    categoryId: 'finance',
    description: 'Formal purchase order for vendor orders, supplies, and ingredient procurement.',
    tags: ['purchasing', 'vendors', 'procurement'],
    estimatedCompletion: '7 minutes',
    recommendedUses: [
      'Issue purchase orders to ingredient suppliers and packaging vendors.',
      'Maintain paper trail for accounting and inventory receiving.',
      'Attach to vendor invoices for payment approval workflows.',
    ],
    sections: [customerInformationSection, purchaseOrderSection, paymentTermsSection, authorizationSection],
    publicSlug: 'purchase-order-form',
  }),
  buildTemplate({
    id: 'quality-control-report',
    name: 'Quality Control Report',
    categoryId: 'operations',
    description: 'Batch inspection checklist for production quality assurance and food safety compliance.',
    tags: ['quality', 'production', 'compliance'],
    estimatedCompletion: '8 minutes',
    recommendedUses: [
      'Inspect each production batch before packaging.',
      'Document quality standards for food safety audits.',
      'Track recurring issues for process improvement.',
    ],
    sections: [qualityControlSection, authorizationSection],
    publicSlug: 'quality-control-report',
  }),
  buildTemplate({
    id: 'customer-complaint-form',
    name: 'Customer Complaint Form',
    categoryId: 'sales',
    description: 'Log customer complaints and resolutions for quality tracking and customer service.',
    tags: ['customer service', 'complaints', 'support'],
    estimatedCompletion: '5 minutes',
    recommendedUses: [
      'Track product quality issues reported by customers.',
      'Document resolutions for customer service training.',
      'Analyze trends to improve product and service quality.',
    ],
    sections: [customerInformationSection, customerComplaintSection, authorizationSection],
    publicSlug: 'customer-complaint-form',
  }),
  buildTemplate({
    id: 'return-authorization-form',
    name: 'Return Authorization Form (RMA)',
    categoryId: 'sales',
    description: 'Process customer returns and exchanges with standardized authorization workflow.',
    tags: ['returns', 'rma', 'customer service'],
    estimatedCompletion: '6 minutes',
    recommendedUses: [
      'Issue RMA numbers for return authorization.',
      'Track returned inventory and refund processing.',
      'Document return reasons for quality analysis.',
    ],
    sections: [customerInformationSection, returnAuthorizationSection, authorizationSection],
    publicSlug: 'return-authorization-form',
  }),
  buildTemplate({
    id: 'shipping-manifest',
    name: 'Daily Shipping Manifest',
    categoryId: 'operations',
    description: 'Consolidated shipment log for daily carrier pickups and delivery tracking.',
    tags: ['shipping', 'logistics', 'carriers'],
    estimatedCompletion: '7 minutes',
    recommendedUses: [
      'Prepare daily shipment summaries for carrier pickups.',
      'Track all outgoing packages in one consolidated view.',
      'Reconcile shipping costs against invoices from carriers.',
    ],
    sections: [shippingManifestSection, authorizationSection],
    publicSlug: 'daily-shipping-manifest',
  }),
  buildTemplate({
    id: 'production-schedule',
    name: 'Weekly Production Schedule',
    categoryId: 'operations',
    description: 'Plan and track weekly production batches, staffing, and equipment needs.',
    tags: ['production', 'manufacturing', 'scheduling'],
    estimatedCompletion: '6 minutes',
    recommendedUses: [
      'Plan weekly batch production schedules.',
      'Coordinate production team assignments.',
      'Track actual vs. planned production for capacity planning.',
    ],
    sections: [productionScheduleSection, authorizationSection],
    publicSlug: 'weekly-production-schedule',
  }),
  buildTemplate({
    id: 'vendor-payment-form',
    name: 'Vendor Payment Authorization',
    categoryId: 'finance',
    description: 'Vendor invoice review and payment approval form for accounts payable.',
    tags: ['accounts payable', 'vendors', 'payments'],
    estimatedCompletion: '6 minutes',
    recommendedUses: [
      'Review vendor invoices before payment processing.',
      'Track payment terms and due dates.',
      'Maintain payment approval documentation for accounting.',
    ],
    sections: [vendorPaymentSection, authorizationSection],
    publicSlug: 'vendor-payment-authorization',
  }),
  buildTemplate({
    id: 'equipment-maintenance-log',
    name: 'Equipment Maintenance Log',
    categoryId: 'operations',
    description: 'Track equipment maintenance history and schedule preventive service.',
    tags: ['maintenance', 'equipment', 'facilities'],
    estimatedCompletion: '5 minutes',
    recommendedUses: [
      'Log routine maintenance for production equipment.',
      'Track repair history and service costs.',
      'Schedule preventive maintenance to avoid downtime.',
    ],
    sections: [maintenanceLogSection, authorizationSection],
    publicSlug: 'equipment-maintenance-log',
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
