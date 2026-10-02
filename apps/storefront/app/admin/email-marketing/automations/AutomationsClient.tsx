'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Pencil, Trash2, Zap, Users } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

const TRIGGER_LABELS: Record<string, string> = {
  USER_REGISTERED: 'User Registered',
  ORDER_PLACED: 'Order Placed',
  ORDER_SHIPPED: 'Order Shipped',
  ORDER_DELIVERED: 'Order Delivered',
  ORDER_REFUNDED: 'Order Refunded',
  ABANDONED_CART: 'Abandoned Cart',
  LOYALTY_POINTS_EARNED: 'Points Earned',
  LOYALTY_TIER_UPGRADE: 'Tier Upgrade',
  SUBSCRIPTION_CREATED: 'Newsletter Subscribed',
  SUBSCRIPTION_RENEWED: 'Subscription Renewed',
  SUBSCRIPTION_EXPIRING: 'Subscription Expiring',
  SUBSCRIPTION_CANCELLED: 'Subscription Cancelled',
  BIRTHDAY: 'Birthday',
  ANNIVERSARY: 'First-Order Anniversary',
  REENGAGEMENT: 'Re-engagement',
  LOW_STOCK: 'Low Stock Alert',
  CUSTOM: 'Custom',
}

interface AutomationStep {
  id: string
  order: number
  templateId: string | null
  delayHours: number
  subject: string | null
}

interface Automation {
  id: string
  name: string
  description: string | null
  trigger: string
  isActive: boolean
  steps: AutomationStep[]
  _count: { enrollments: number }
}

interface AutomationsClientProps {
  initialAutomations: Automation[]
  templates: { id: string; name: string; key: string }[]
}

export function AutomationsClient({ initialAutomations }: AutomationsClientProps) {
  const [automations, setAutomations] = useState(initialAutomations)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/automations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })
      if (!res.ok) throw new Error('Failed')
      setAutomations((prev) => prev.map((a) => (a.id === id ? { ...a, isActive } : a)))
      toast.success(`Automation ${isActive ? 'enabled' : 'disabled'}`)
    } catch {
      toast.error('Failed to update automation')
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/admin/automations/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setAutomations((prev) => prev.filter((a) => a.id !== deleteId))
      toast.success('Automation deleted')
    } catch {
      toast.error('Failed to delete automation')
    } finally {
      setDeleteId(null)
    }
  }

  if (automations.length === 0) {
    return (
      <div className="text-center py-16 border rounded-lg bg-card">
        <Zap className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2 text-foreground">No automations yet</h3>
        <p className="text-muted-foreground mb-4">
          Create your first automation to send triggered emails automatically.
        </p>
        <Button asChild>
          <Link href="/admin/email-marketing/automations/new">
            Create First Automation
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {automations.map((automation) => (
        <div
          key={automation.id}
          className="flex items-center gap-4 p-4 border rounded-lg bg-card hover:shadow-sm transition-shadow"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold truncate">{automation.name}</h3>
              <Badge variant={automation.isActive ? 'default' : 'secondary'}>
                {automation.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                {TRIGGER_LABELS[automation.trigger] ?? automation.trigger}
              </span>
              <span>
                {automation.steps.length} step{automation.steps.length !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {automation._count.enrollments} enrolled
              </span>
            </div>
            {automation.description && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{automation.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={automation.isActive}
              onCheckedChange={(checked) => handleToggle(automation.id, checked)}
            />
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/email-marketing/automations/${automation.id}`}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDeleteId(automation.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      ))}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete automation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the automation and all its enrollment history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
