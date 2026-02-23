# Inventory Control & Admin System - Implementation Plan

## Phase 1: OWNER Role & Account System

### 1.1 Add OWNER to UserRole enum in Prisma schema
- Add `OWNER` to the `UserRole` enum (above ADMIN to establish hierarchy)
- Add `INVENTORY` to `PermissionCategory` enum for inventory-specific permissions

### 1.2 Add inventory permissions to permissions-data.ts
- Add `inventory:read`, `inventory:write`, `inventory:bulk`, `inventory:export`, `inventory:import`, `inventory:delete`
- Grant all permissions to OWNER and ADMIN in `defaultRolePermissions`

### 1.3 Update RBAC system (lib/rbac.ts)
- Add OWNER to `isAdmin()` and `isStaff()` checks
- Add `isOwner()` helper function
- Add OWNER-specific super admin checks that bypass all permission checks

### 1.4 Update middleware.ts
- Add `OWNER` to `STAFF_ROLES` array for admin panel access

### 1.5 Update auth system (lib/auth.ts)
- Ensure OWNER role is correctly passed through JWT/session callbacks

### 1.6 Update admin layout and navigation
- Add `OWNER` to allowed roles in admin layout
- Add Inventory as a dedicated nav item in permissions-map.ts
- Update user management UI to show OWNER role with special badge

### 1.7 Create OWNER account seed script
- Create migration/seed to add OWNER account: Mike@josemadridsalsa.com
- Hash password: Jl101213@wan with bcrypt
- Enforce single-OWNER constraint in API routes

### 1.8 Update user management API
- Prevent creating/editing OWNER role unless current user IS the OWNER
- Add validation: only 1 OWNER can exist in the system
- Prevent demotion/deletion of OWNER account by non-OWNER users

## Phase 2: Full Inventory Control System

### 2.1 Enhance Inventory Dashboard Page (app/admin/inventory/page.tsx)
Current state: Shows low stock products, active alerts, and recent transactions.
Missing:
- **Full product inventory table** showing ALL products with stock levels
- **Search/filter/sort** by name, SKU, category, stock level, status
- **Bulk stock adjustment** capability
- **Inventory value calculation** (cost price × quantity)
- **Export inventory report** (CSV/PDF)
- **Import inventory** from CSV
- **Stock history chart** per product over time

### 2.2 Create Product Inventory Detail Page
- `/admin/inventory/[productId]` - Detailed inventory view per product
- Full transaction history with filtering
- Stock level chart over time
- Quick adjustment form
- Related alerts for this product
- Reorder point suggestions

### 2.3 Create Bulk Operations Page
- `/admin/inventory/bulk` - Bulk restock/adjustment
- CSV upload for bulk stock updates
- Select multiple products, apply same adjustment
- Preview changes before confirming

### 2.4 Enhance Inventory API Endpoints
- `GET /api/admin/inventory` - Already exists, enhance with filters, pagination, full product list
- `GET /api/admin/inventory/export` - Export inventory data as CSV
- `POST /api/admin/inventory/import` - Import stock updates from CSV
- `GET /api/admin/inventory/report` - Inventory summary report
- `GET /api/admin/inventory/[productId]/history` - Detailed history

### 2.5 Create Inventory Components
- `InventoryTable` - Full product inventory table with sorting/filtering
- `BulkAdjustmentDialog` - Multi-product stock adjustment
- `InventoryExportButton` - Export to CSV/PDF
- `InventoryImportDialog` - Import from CSV
- `StockHistoryChart` - Per-product stock history visualization
- `InventoryValueCard` - Total inventory value dashboard card

## Phase 3: Admin Panel Analysis & Gap Filling

### 3.1 Existing Admin Pages Analysis
(See detailed analysis document below)

### 3.2 Fix Missing/Broken Features
Based on analysis - implement missing features and fix integration gaps.

## Files to Create/Modify

### New Files:
- `prisma/migrations/[timestamp]_add_owner_role/migration.sql`
- `prisma/seed.owner.ts`
- `app/admin/inventory/[productId]/page.tsx`
- `app/admin/inventory/bulk/page.tsx`
- `app/api/admin/inventory/export/route.ts`
- `app/api/admin/inventory/import/route.ts`
- `app/api/admin/inventory/report/route.ts`
- `components/admin/inventory/InventoryTable.tsx`
- `components/admin/inventory/BulkAdjustmentDialog.tsx`
- `components/admin/inventory/InventoryExportButton.tsx`
- `components/admin/inventory/InventoryImportDialog.tsx`
- `components/admin/inventory/StockHistoryChart.tsx`
- `components/admin/inventory/InventoryValueCard.tsx`
- `components/admin/inventory/InventoryFilters.tsx`

### Modified Files:
- `prisma/schema.prisma` - Add OWNER role
- `lib/rbac.ts` - Add OWNER support
- `lib/permissions-data.ts` - Add OWNER permissions + inventory permissions
- `lib/permissions-map.ts` - Add inventory nav item
- `middleware.ts` - Add OWNER to staff roles
- `app/admin/layout.tsx` - Add OWNER to allowed roles
- `app/admin/inventory/page.tsx` - Complete rewrite with full inventory table
- `app/api/admin/inventory/route.ts` - Enhance with full product listing
- `app/api/admin/users/route.ts` - Add OWNER constraints
- `app/admin/users/page.tsx` - Show OWNER role
