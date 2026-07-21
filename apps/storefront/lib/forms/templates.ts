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

const developerRequestTypeSection: BusinessFormSection = {
  id: 'request-type',
  label: 'Request Type',
  description: 'Check the primary category for this request.',
  defaultIncluded: true,
  fields: [
    { id: 'request-feature', label: 'Feature Request', type: 'checkbox' },
    { id: 'request-website-issue', label: 'Website Issues', type: 'checkbox' },
    { id: 'request-server-issue', label: 'Server Issues', type: 'checkbox' },
    { id: 'request-customer-reported', label: 'Customer-Reported Issues', type: 'checkbox' },
    { id: 'request-connectivity', label: 'Connectivity Issues', type: 'checkbox' },
    { id: 'request-bug', label: 'Bug / Defect', type: 'checkbox' },
    { id: 'request-performance', label: 'Performance / Speed Issue', type: 'checkbox' },
    { id: 'request-security', label: 'Security Concern', type: 'checkbox' },
    { id: 'request-na', label: 'N/A', type: 'checkbox' },
    { id: 'request-other', label: 'Other', type: 'checkbox' },
  ],
}

const developerIssueAreaSection: BusinessFormSection = {
  id: 'issue-area',
  label: 'Issue Area',
  description: 'Check all areas affected by this request.',
  defaultIncluded: true,
  fields: [
    { id: 'area-products', label: 'Products / Catalog', type: 'checkbox' },
    { id: 'area-orders', label: 'Orders / Checkout', type: 'checkbox' },
    { id: 'area-admin-panel', label: 'Admin Panel', type: 'checkbox' },
    { id: 'area-forms', label: 'Forms System', type: 'checkbox' },
    { id: 'area-content', label: 'Content / Pages', type: 'checkbox' },
    { id: 'area-authentication', label: 'User Authentication / Login', type: 'checkbox' },
    { id: 'area-email', label: 'Email Notifications', type: 'checkbox' },
    { id: 'area-payment', label: 'Payment Processing', type: 'checkbox' },
    { id: 'area-shipping', label: 'Shipping / Fulfillment', type: 'checkbox' },
    { id: 'area-inventory', label: 'Inventory Management', type: 'checkbox' },
    { id: 'area-customer-accounts', label: 'Customer Accounts', type: 'checkbox' },
    { id: 'area-search', label: 'Search Functionality', type: 'checkbox' },
    { id: 'area-mobile', label: 'Mobile Experience', type: 'checkbox' },
    { id: 'area-api', label: 'API / Integrations', type: 'checkbox' },
    { id: 'area-database', label: 'Database', type: 'checkbox' },
  ],
}

const developerPrioritySection: BusinessFormSection = {
  id: 'priority-level',
  label: 'Priority Level',
  description: 'Select the urgency of this request.',
  defaultIncluded: true,
  fields: [
    { id: 'priority-critical', label: '🔴 Critical - Site Down / Major Loss of Function', type: 'checkbox' },
    { id: 'priority-high', label: '🟠 High - Impacting Multiple Users', type: 'checkbox' },
    { id: 'priority-medium', label: '🟡 Medium - Noticeable but Workable', type: 'checkbox' },
    { id: 'priority-low', label: '🟢 Low - Minor Issue or Enhancement', type: 'checkbox' },
  ],
}

const developerDeviceSection: BusinessFormSection = {
  id: 'device-browser',
  label: 'Device & Browser',
  description: 'Where did this issue occur?',
  defaultIncluded: true,
  fields: [
    { id: 'device-desktop', label: 'Desktop Computer', type: 'checkbox' },
    { id: 'device-mobile', label: 'Mobile Phone', type: 'checkbox' },
    { id: 'device-tablet', label: 'Tablet', type: 'checkbox' },
    { id: 'browser-chrome', label: 'Chrome', type: 'checkbox' },
    { id: 'browser-safari', label: 'Safari', type: 'checkbox' },
    { id: 'browser-firefox', label: 'Firefox', type: 'checkbox' },
    { id: 'browser-edge', label: 'Edge', type: 'checkbox' },
    { id: 'browser-other', label: 'Other Browser', type: 'checkbox' },
  ],
}

const developerCommonIssuesSection: BusinessFormSection = {
  id: 'common-issues',
  label: 'Common Issue Types',
  description: 'Select any that apply to help identify the problem.',
  fields: [
    { id: 'issue-page-not-loading', label: 'Page Not Loading', type: 'checkbox' },
    { id: 'issue-error-message', label: 'Error Message Displayed', type: 'checkbox' },
    { id: 'issue-slow-performance', label: 'Slow Performance', type: 'checkbox' },
    { id: 'issue-button-not-working', label: 'Button / Link Not Working', type: 'checkbox' },
    { id: 'issue-display-incorrect', label: 'Display / Layout Incorrect', type: 'checkbox' },
    { id: 'issue-data-incorrect', label: 'Data / Content Incorrect', type: 'checkbox' },
    { id: 'issue-cant-login', label: 'Cannot Login / Access Denied', type: 'checkbox' },
    { id: 'issue-form-not-submitting', label: 'Form Not Submitting', type: 'checkbox' },
    { id: 'issue-image-missing', label: 'Image / Media Missing', type: 'checkbox' },
    { id: 'issue-print-problem', label: 'Print / Export Problem', type: 'checkbox' },
  ],
}

const developerDescriptionSection: BusinessFormSection = {
  id: 'issue-description',
  label: 'Issue Description',
  description: 'Provide a brief description of what is happening or what you need.',
  defaultIncluded: true,
  fields: [
    {
      id: 'description-box',
      label: 'Description',
      type: 'long-text',
      placeholder: 'Describe what happened, what you expected, and any error messages. Include steps to reproduce if applicable.',
      helperText: 'Be as specific as possible. Include page URLs, user accounts, or order numbers if relevant.',
    },
  ],
}

const developerContactSection: BusinessFormSection = {
  id: 'contact-info',
  label: 'Contact Information',
  description: 'Who should we contact about this request?',
  defaultIncluded: true,
  fields: [
    { id: 'reporter-name', label: 'Your Name', type: 'short-text' },
    { id: 'reporter-email', label: 'Email', type: 'short-text', placeholder: 'name@example.com' },
    { id: 'reporter-phone', label: 'Phone', type: 'short-text', placeholder: '(555) 555-5555' },
    { id: 'preferred-contact', label: 'Preferred Contact Method', type: 'short-text', placeholder: 'Email, Phone, Text' },
  ],
}

const showSalesFlavors = [
  'Apple',
  'Cranberry',
  'Pumpkin',
  'Raspberry',
  'Peach',
  'Strawberry',
  'Mango',
  'Mango-Hab',
  'Pineapple',
  'Pine-Hab',
  'Cherry Mild',
  'Cherry Choc',
  'Bean & Corn',
  'Cilantro Mild',
  'Cilantro Hot',
  'RGO',
  'Chipotle Hot',
  'BBQ',
  'Verde Mild',
  'Verde Hot',
  'Verde XXH',
  'Mild',
  'Clovis Med',
  'Clovis Ghost',
  'Hot',
  'X Hot',
  'Chipotle Con Queso',
  'Jerk',
  'Cranberry Chipotle',
  'Cherry Hot',
  'Blueberry',
]

const showDetailsSection: BusinessFormSection = {
  id: 'show-details',
  label: 'Show Details',
  defaultIncluded: true,
  fields: [
    { id: 'show-location', label: 'Show Location', type: 'short-text', placeholder: 'Venue, city, state' },
    { id: 'completed-by', label: 'Completed By', type: 'short-text' },
    { id: 'show-start-date', label: 'Start Date', type: 'date' },
    { id: 'show-end-date', label: 'End Date', type: 'date' },
  ],
}

// Two flavors per printed row, mirroring the two-column paper form, so the
// full list fits alongside everything else on a single page.
const showInventoryRows = (() => {
  const entries = [...showSalesFlavors, 'Total Cases']
  const half = Math.ceil(entries.length / 2)
  return Array.from({ length: half }, (_, index) => [
    entries[index] ?? '',
    '',
    '',
    '',
    '',
    entries[index + half] ?? '',
  ])
})()

const showInventorySection: BusinessFormSection = {
  id: 'show-inventory',
  label: 'Inventory by Flavor',
  defaultIncluded: true,
  fields: [
    {
      id: 'show-inventory-table',
      label: 'Case Counts',
      type: 'table',
      columns: [
        'Flavor',
        'Beg. Inv',
        'Added',
        'Ending',
        'Sold',
        'Flavor',
        'Beg. Inv',
        'Added',
        'Ending',
        'Sold',
      ],
      rows: showInventoryRows,
      defaultRows: showInventoryRows.length,
    },
  ],
}

const showDailySalesSection: BusinessFormSection = {
  id: 'show-daily-sales',
  label: 'Daily Sales',
  defaultIncluded: true,
  columnGroup: 'show-recap',
  fields: [
    {
      id: 'daily-sales-table',
      label: 'Sales by Day',
      type: 'table',
      columns: ['Day', 'Cash', 'Card', 'Total'],
      rows: ['Mon', 'Tues', 'Wed', 'Thur', 'Fri', 'Sat', 'Sun', 'Total Sales'].map((day) => [day]),
      defaultRows: 8,
    },
  ],
}

const showExpensesSection: BusinessFormSection = {
  id: 'show-expenses',
  label: 'Expenses',
  defaultIncluded: true,
  columnGroup: 'show-recap',
  fields: [
    {
      id: 'show-expense-table',
      label: 'Show Expenses',
      type: 'table',
      columns: ['Expense', 'Amount'],
      rows: ['Display', 'Chips', 'Food', 'Gas', 'Motel', 'Misc', 'Total Expenses'].map((item) => [item]),
      defaultRows: 8,
    },
  ],
}

const showSalesAuditSection: BusinessFormSection = {
  id: 'show-sales-audit',
  label: 'Sales Audit & Totals',
  defaultIncluded: true,
  columnGroup: 'show-recap',
  fields: [
    {
      id: 'sales-audit-table',
      label: 'Audit',
      type: 'table',
      columns: ['Line', 'Amount'],
      rows: [
        ['Cash'],
        ['Charges'],
        ['Expenses'],
        ['Net Total'],
        ['Total Jars at Show'],
        ['Total Jars Sold'],
        ['Avg Price / Jar'],
        ['Avg Price / Case'],
      ],
      defaultRows: 8,
    },
  ],
}

const showWrapUpSection: BusinessFormSection = {
  id: 'show-wrap-up',
  label: 'Evaluation & Notes',
  defaultIncluded: true,
  fields: [
    { id: 'show-evaluation-by', label: 'Show Evaluation By', type: 'short-text' },
    {
      id: 'show-notes',
      label: 'Notes',
      type: 'long-text',
      placeholder: 'Traffic, weather, best sellers, booth position, whether to book the show again.',
    },
  ],
}

const employeeInfoSection: BusinessFormSection = {
  id: 'employee-info',
  label: 'Employee Information',
  defaultIncluded: true,
  fields: [
    { id: 'employee-name', label: 'Employee Name', type: 'short-text' },
    { id: 'employee-position', label: 'Position / Department', type: 'short-text' },
    { id: 'pay-period-start', label: 'Pay Period Start', type: 'date' },
    { id: 'pay-period-end', label: 'Pay Period End', type: 'date' },
  ],
}

const employeeHoursLogSection: BusinessFormSection = {
  id: 'employee-hours-log',
  label: 'Daily Hours',
  description:
    'Sign in and out twice per day so a lunch or break is captured, then describe the work done that day.',
  defaultIncluded: true,
  fields: [
    {
      id: 'employee-hours-table',
      label: 'Hours Log',
      type: 'table',
      columns: [
        'Date',
        'Sign In',
        'Sign Out',
        'Sign In',
        'Sign Out',
        'Total Hours',
        'Description of Duties',
      ],
      defaultRows: 14,
      rowHeight: 40,
    },
  ],
}

const employeeHoursSummarySection: BusinessFormSection = {
  id: 'employee-hours-summary',
  label: 'Period Summary & Approval',
  defaultIncluded: true,
  fields: [
    { id: 'regular-hours', label: 'Total Regular Hours', type: 'number' },
    { id: 'overtime-hours', label: 'Total Overtime Hours', type: 'number' },
    {
      id: 'employee-certification',
      label: 'I certify the hours recorded above are accurate.',
      type: 'checkbox',
    },
    { id: 'employee-signature', label: 'Employee Signature', type: 'signature' },
    { id: 'supervisor-signature', label: 'Supervisor Signature', type: 'signature' },
    { id: 'approval-date', label: 'Date Approved', type: 'date' },
  ],
}

function buildTemplate(
  template: Omit<BusinessFormTemplate, 'sections'> & { sections: BusinessFormSection[] },
): BusinessFormTemplate {
  return template
}

export const businessFormTemplates: BusinessFormTemplate[] = [
  buildTemplate({
    id: 'show-sales-form',
    name: 'Show Sales Form',
    categoryId: 'operations',
    description:
      'Per-show recap of case inventory by flavor, daily cash and card sales, expenses, and the closing sales audit.',
    tags: ['shows', 'events', 'inventory', 'sales'],
    estimatedCompletion: '10 minutes',
    recommendedUses: [
      'Send with the booth crew to every festival, fair, and food show.',
      'Reconcile cash, card, and expenses before leaving the show.',
      'Compare shows year over year when deciding which ones to rebook.',
    ],
    sections: [
      showDetailsSection,
      showInventorySection,
      showDailySalesSection,
      showExpensesSection,
      showSalesAuditSection,
      showWrapUpSection,
    ],
    publicSlug: 'show-sales-form',
    density: 'compact',
  }),
  buildTemplate({
    id: 'employee-hours-tracker',
    name: 'Employee Hours Tracker',
    categoryId: 'hr',
    description:
      'Daily sign in and sign out log with a second in/out pair for breaks, plus a description of duties for each day.',
    tags: ['payroll', 'hr', 'timesheet'],
    estimatedCompletion: '5 minutes',
    recommendedUses: [
      'Track hours for production, kitchen, and event staff each pay period.',
      'Capture break in and out times so unpaid time is documented.',
      'Attach to payroll runs as the signed record of hours and duties.',
    ],
    sections: [employeeInfoSection, employeeHoursLogSection, employeeHoursSummarySection],
    publicSlug: 'employee-hours-tracker',
    density: 'compact',
  }),
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
  buildTemplate({
    id: 'developer-request-ticket',
    name: 'Developer Request Ticket',
    categoryId: 'operations',
    description: 'Submit website issues, feature requests, or technical support needs to the development team.',
    tags: ['developer', 'support', 'tech', 'admin'],
    estimatedCompletion: '3 minutes',
    recommendedUses: [
      'Report website malfunctions or bugs to the developer.',
      'Request new features or enhancements for the admin panel.',
      'Document customer-reported technical issues.',
      'Submit connectivity or server-related problems.',
      'Track technical issues with photo documentation.',
    ],
    sections: [
      developerRequestTypeSection,
      developerIssueAreaSection,
      developerPrioritySection,
      developerDeviceSection,
      developerCommonIssuesSection,
      developerDescriptionSection,
      developerContactSection,
      authorizationSection,
    ],
    publicSlug: 'developer-request-ticket',
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
  {
    id: 'event-logistics-brief',
    label: 'Event Logistics Brief',
    description: 'Event quick-reference block for pop-ups, demos, and festivals.',
    section: {
      id: 'event-logistics',
      label: 'Event Logistics',
      fields: [
        { id: 'event-name', label: 'Event Name', type: 'short-text', placeholder: 'Farmers market, tasting, festival, etc.' },
        { id: 'event-date', label: 'Event Date', type: 'date' },
        { id: 'event-location', label: 'Location / Booth #', type: 'short-text', placeholder: 'Venue, address, booth number' },
        { id: 'setup-requirements', label: 'Setup Requirements', type: 'long-text', placeholder: 'Tables, power, permits, samples needed' },
        { id: 'on-site-contact', label: 'On-Site Contact & Phone', type: 'short-text' },
      ],
    },
  },
  {
    id: 'volunteer-briefing',
    label: 'Volunteer Briefing Checklist',
    description: 'Shift prep checklist and safety reminders for volunteers.',
    section: {
      id: 'volunteer-briefing',
      label: 'Volunteer Briefing',
      fields: [
        { id: 'shift-call-time', label: 'Call Time', type: 'short-text', placeholder: 'e.g., Arrive by 4:30 PM' },
        { id: 'meeting-location', label: 'Meeting Location', type: 'short-text', placeholder: 'Warehouse bay, school gym, etc.' },
        {
          id: 'briefing-checklist',
          label: 'Briefing Checklist',
          type: 'table',
          columns: ['Task', 'Owner', 'Status', 'Notes'],
          defaultRows: 6,
        },
        {
          id: 'safety-reminders',
          label: 'Safety or Compliance Reminders',
          type: 'long-text',
          placeholder: 'Gloves, hairnets, allergy statements, emergency exits, etc.',
        },
      ],
    },
  },
  {
    id: 'fundraising-incentives',
    label: 'Fundraising Incentive Tracker',
    description: 'Track prize tiers and who has qualified for each incentive.',
    section: {
      id: 'incentive-tracker',
      label: 'Incentive Tracker',
      fields: [
        { id: 'fundraising-goal', label: 'Overall Fundraising Goal', type: 'short-text', placeholder: '$5,000, 500 jars, etc.' },
        {
          id: 'incentive-table',
          label: 'Incentive Progress',
          type: 'table',
          columns: ['Prize Tier', 'Requirement', 'Earned By', 'Date Awarded', 'Notes'],
          defaultRows: 8,
        },
      ],
    },
  },
  {
    id: 'delivery-confirmation',
    label: 'Delivery Confirmation Block',
    description: 'Proof-of-delivery capture with condition check and receiver signature.',
    section: {
      id: 'delivery-confirmation',
      label: 'Delivery Confirmation',
      fields: [
        { id: 'received-by', label: 'Received By', type: 'short-text', placeholder: 'Name + title' },
        { id: 'receipt-date', label: 'Receipt Date', type: 'date' },
        { id: 'all-items-accounted', label: 'All items accounted for?', type: 'checkbox' },
        { id: 'condition-notes', label: 'Condition Notes', type: 'long-text', placeholder: 'Report damages, shortages, or follow-ups' },
        { id: 'receiver-signature', label: 'Receiver Signature', type: 'signature' },
      ],
    },
  },
]
