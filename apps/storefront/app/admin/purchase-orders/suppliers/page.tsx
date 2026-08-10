import Link from 'next/link'
import { redirect } from 'next/navigation'

import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { isNextControlFlowError } from '@/lib/next-errors'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SupplierForm } from '@/components/admin/SupplierForm'

export const metadata = { title: 'Suppliers | Jose Madrid Salsa Admin' }

export default async function SuppliersPage() {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'inventory:read'))) {
      redirect('/admin')
    }

    const canWrite = await hasPermission(user, 'products:write')
    const suppliers = await prisma.supplier.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { purchaseOrders: true } } },
    })

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/admin/purchase-orders"
              className="text-sm text-muted-foreground hover:underline"
            >
              ← Purchase orders
            </Link>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Suppliers</h1>
            <p className="text-sm text-muted-foreground">
              {suppliers.length} supplier{suppliers.length === 1 ? '' : 's'}
            </p>
          </div>
          {canWrite && <SupplierForm />}
        </div>

        <Card>
          <CardContent className="pt-6">
            {suppliers.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground">
                No suppliers yet. Add the businesses you buy stock from.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Purchase orders</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.map((supplier) => (
                      <TableRow key={supplier.id}>
                        <TableCell className="font-medium">{supplier.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {[supplier.contactName, supplier.email, supplier.phone]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {[supplier.city, supplier.state].filter(Boolean).join(', ') || '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {supplier._count.purchaseOrders}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  } catch (error) {
    if (isNextControlFlowError(error)) throw error
    console.error('Suppliers page error:', error)
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Could not load suppliers.</p>
      </div>
    )
  }
}
