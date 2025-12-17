# Phase 1: Getting Started

## Prerequisites ✅

Phase 0 is complete with:
- ✅ Database schema updated with all new models
- ✅ 28 permissions seeded across 5 roles
- ✅ RBAC system with middleware protection
- ✅ Encryption utilities for service keys
- ✅ Audit logging infrastructure
- ✅ Environment configured

## What's Next: Phase 1 Core Admin

Phase 1 focuses on building the core admin interface and essential management modules.

### 1. Admin UI Scaffolding

**Create `/app/admin/layout.tsx`**
- Responsive sidebar navigation
- Top bar with user profile and role badge
- Breadcrumbs
- Mobile menu
- Dark mode toggle

**Build Reusable Components** (`components/admin/`)
- `AdminShell` - Main container
- `AdminSidebar` - Collapsible navigation
- `AdminTopbar` - Header with actions
- `StatsCard` - Dashboard metrics
- `DataTable` - Sortable, filterable tables
- `Modal` - Confirm dialogs
- `BulkActionsBar` - Batch operations
- `DateRangePicker` - Date filtering

### 2. Admin Dashboard (`/app/admin/page.tsx`)

Build the main dashboard with:
- Revenue, orders, users, products stats
- Recent orders table
- Quick action buttons
- Analytics charts (using recharts)
- Permission-aware widgets

### 3. Order Management (`/app/admin/orders`)

**Features:**
- List view with filters (status, date, customer)
- Detail page with full order info
- Status transitions (PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED)
- Tracking number management
- Print packing slips and invoices
- Email notifications on status change
- Export to CSV

**Permissions:** `orders:read`, `orders:write`, `orders:export`

### 4. Product Management (`/app/admin/products`)

**Features:**
- List with search and filters
- Create/edit form with:
  - Basic info (name, slug, description)
  - Pricing (price, compareAtPrice, costPrice)
  - Inventory management
  - Image upload
  - SEO fields
  - Category assignment
  - Tags
- Bulk actions (activate, pricing updates)
- Product preview
- Duplicate functionality
- Export

**Permissions:** `products:read`, `products:write`, `products:bulk`, `products:export`

### 5. User Management (`/app/admin/users`)

**Features:**
- User list with role filters
- Detail view with:
  - Profile information
  - Order history
  - Addresses
  - Wholesale status
  - Reviews
  - Last login
- Role assignment
- Impersonation (with audit trail)
- Export user data
- Send email

**Permissions:** `users:read`, `users:write`, `users:impersonate`, `users:export`

### 6. Category Management (`/app/admin/categories`)

**Features:**
- List with drag-and-drop reordering
- Create/edit with SEO fields
- Active/inactive toggle
- Sort order management

**Permissions:** `products:write` or `content:write`

### 7. Analytics Dashboard (`/app/admin/analytics`)

**Features:**
- Revenue charts by period
- Top selling products
- Traffic sources
- Conversion metrics
- Geographic distribution
- Date range selector
- Export reports

**Permissions:** `analytics:read`, `analytics:export`

## Implementation Order

1. ✅ Install dependencies (if needed)
2. Create admin layout and navigation
3. Build shared admin components
4. Implement dashboard with mock data
5. Build Orders module (full CRUD + features)
6. Build Products module
7. Build Users module
8. Build Categories module
9. Build Analytics module
10. Add API routes for each module
11. Test and refine

## Key Libraries to Use

- **UI**: Existing `components/ui` (shadcn/ui)
- **Forms**: `react-hook-form` + `zod` (already installed)
- **Charts**: Install `recharts` for analytics
- **Tables**: Build on top of existing DataTable pattern
- **Date Handling**: `date-fns` (already installed)
- **PDF Generation**: Install `pdfkit` for invoices/packing slips
- **CSV Export**: Create `lib/csv.ts` utility

## Testing Strategy

For each module:
1. Write unit tests for business logic
2. Write integration tests for API routes
3. Test RBAC permissions
4. Test form validation
5. Run `npm run lint` and `npm run type-check`

## Environment Variables

All required env vars are already set:
- ✅ `DATABASE_URL`
- ✅ `NEXTAUTH_SECRET`
- ✅ `MASTER_KEY`
- ✅ `STRIPE_*`
- ✅ `RESEND_API_KEY`

## Commands

```bash
# Development
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint

# Testing
npx vitest run
npx vitest watch

# Database
npm run db:generate
npm run db:push
npm run db:studio

# Seed permissions (if needed again)
npx tsx prisma/seed.permissions.ts
```

## File Structure

```
/Users/jordanlang/Repos/josemadridsalsa/
├── app/
│   ├── admin/
│   │   ├── layout.tsx              # Main admin layout
│   │   ├── page.tsx                # Dashboard
│   │   ├── orders/
│   │   │   ├── page.tsx            # Orders list
│   │   │   └── [id]/
│   │   │       └── page.tsx        # Order detail
│   │   ├── products/
│   │   │   ├── page.tsx            # Products list
│   │   │   ├── new/
│   │   │   │   └── page.tsx        # Create product
│   │   │   └── [id]/
│   │   │       ├── page.tsx        # Product detail
│   │   │       └── edit/
│   │   │           └── page.tsx    # Edit product
│   │   ├── users/
│   │   ├── categories/
│   │   └── analytics/
│   └── api/
│       └── admin/
│           ├── orders/
│           ├── products/
│           ├── users/
│           ├── categories/
│           └── analytics/
├── components/
│   └── admin/
│       ├── AdminShell.tsx
│       ├── AdminSidebar.tsx
│       ├── AdminTopbar.tsx
│       ├── StatsCard.tsx
│       ├── DataTable.tsx
│       └── ...
└── lib/
    ├── api.ts                      # API helpers (create this)
    ├── csv.ts                      # CSV export (create this)
    ├── pdf.ts                      # PDF generation (create this)
    └── permissions-map.ts          # Permission mapping (create this)
```

## Design Guidelines

1. **Consistency**: Use existing UI components from `components/ui`
2. **Responsive**: Mobile-first, works on all screen sizes
3. **Accessible**: Proper ARIA labels, keyboard navigation
4. **Permission-Aware**: Hide/disable features based on user permissions
5. **Loading States**: Show skeletons during data fetching
6. **Error Handling**: Clear error messages and recovery options
7. **Confirmation**: Ask before destructive actions
8. **Audit Trail**: Log all important actions

## Permission Checks Example

```typescript
// In page component
import { getCurrentUser, hasPermission } from '@/lib/rbac'

export default async function OrdersPage() {
  const user = await getCurrentUser()
  
  if (!user || !(await hasPermission(user, 'orders:read'))) {
    redirect('/')
  }
  
  const canWrite = await hasPermission(user, 'orders:write')
  const canExport = await hasPermission(user, 'orders:export')
  
  return (
    <div>
      {/* Show UI based on permissions */}
      {canWrite && <CreateOrderButton />}
      {canExport && <ExportButton />}
    </div>
  )
}
```

## API Route Example

```typescript
// app/api/admin/orders/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { logAuditWithRequest } from '@/lib/audit'

export async function GET(request: NextRequest) {
  const user = await requirePermission('orders:read')
  
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  
  return NextResponse.json({ orders })
}

export async function POST(request: NextRequest) {
  const user = await requirePermission('orders:write')
  const body = await request.json()
  
  const order = await prisma.order.create({
    data: body,
  })
  
  await logAuditWithRequest({
    userId: user.id,
    action: 'order.create',
    entityType: 'Order',
    entityId: order.id,
  }, request)
  
  return NextResponse.json({ order })
}
```

## Tips

1. Start with the layout and navigation first
2. Use mock data initially to build the UI
3. Then connect to real APIs
4. Test permissions thoroughly
5. Add loading states and error boundaries
6. Document any new permissions needed
7. Keep components small and focused
8. Reuse components across modules

## Need Help?

- Check existing code in `/app/products` for patterns
- Review `components/ui` for available components
- Consult `docs/env-setup.md` for environment variables
- See `docs/PHASE_0_COMPLETE.md` for what's already done
- Test permissions with `npx tsx prisma/seed.permissions.ts`

---

**Ready to build!** 🚀

Start with: `npm run dev` and create `/app/admin/layout.tsx`
