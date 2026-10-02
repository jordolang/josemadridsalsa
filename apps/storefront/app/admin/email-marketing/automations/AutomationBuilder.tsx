'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import {
  Plus,
  Trash2,
  Clock,
  Mail,
  ArrowDown,
  Loader2,
  Check,
  ChevronsUpDown,
} from 'lucide-react'
import { toast } from 'sonner'

// `unavailable` triggers have no event source in this system — there is no product subscription
// model, and "custom" has nothing to fire it — so they stay listed (an existing automation must
// still display its trigger) but cannot be chosen.
const TRIGGER_OPTIONS: { value: string; label: string; unavailable?: boolean }[] = [
  { value: 'USER_REGISTERED', label: 'User Registered' },
  { value: 'ORDER_PLACED', label: 'Order Placed' },
  { value: 'ORDER_SHIPPED', label: 'Order Shipped' },
  { value: 'ORDER_DELIVERED', label: 'Order Delivered' },
  { value: 'ORDER_REFUNDED', label: 'Order Refunded' },
  { value: 'ABANDONED_CART', label: 'Abandoned Cart' },
  { value: 'LOYALTY_POINTS_EARNED', label: 'Loyalty Points Earned' },
  { value: 'LOYALTY_TIER_UPGRADE', label: 'Loyalty Tier Upgrade' },
  { value: 'SUBSCRIPTION_CREATED', label: 'Newsletter Subscribed' },
  { value: 'SUBSCRIPTION_RENEWED', label: 'Subscription Renewed', unavailable: true },
  { value: 'SUBSCRIPTION_EXPIRING', label: 'Subscription Expiring', unavailable: true },
  { value: 'SUBSCRIPTION_CANCELLED', label: 'Subscription Cancelled', unavailable: true },
  { value: 'BIRTHDAY', label: 'Birthday (from account settings)' },
  { value: 'ANNIVERSARY', label: 'First-Order Anniversary' },
  { value: 'REENGAGEMENT', label: 'Re-engagement (90 days since last order)' },
  { value: 'LOW_STOCK', label: 'Low Stock Alert (to INVENTORY_ALERT_EMAILS)' },
  { value: 'CUSTOM', label: 'Custom', unavailable: true },
]

interface Step {
  templateId: string
  delayHours: number
  subject: string
}

interface AutomationBuilderProps {
  templates: { id: string; name: string; key: string; subject: string }[]
  initialData?: {
    id: string
    name: string
    description: string | null
    trigger: string
    isActive: boolean
    stopConditions: Record<string, boolean> | null
    steps: Step[]
  }
}

export function AutomationBuilder({ templates, initialData }: AutomationBuilderProps) {
  const router = useRouter()
  const isEditing = !!initialData?.id

  const [name, setName] = useState(initialData?.name ?? '')
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [trigger, setTrigger] = useState(initialData?.trigger ?? '')
  const [isActive, setIsActive] = useState(initialData?.isActive ?? false)
  const [stopOnPurchase, setStopOnPurchase] = useState(
    initialData?.stopConditions?.onPurchase ?? false
  )
  const [steps, setSteps] = useState<Step[]>(
    initialData?.steps ?? [{ templateId: '', delayHours: 0, subject: '' }]
  )
  const [loading, setLoading] = useState(false)

  const addStep = () => {
    setSteps((prev) => [...prev, { templateId: '', delayHours: 24, subject: '' }])
  }

  const removeStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index))
  }

  const updateStep = (index: number, field: keyof Step, value: string | number) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !trigger) {
      toast.error('Name and trigger are required')
      return
    }
    if (steps.length === 0 || steps.some((s) => !s.templateId)) {
      toast.error('Each step must have a template selected')
      return
    }

    setLoading(true)
    try {
      const payload = {
        name,
        description: description || null,
        trigger,
        isActive,
        stopConditions: { onUnsubscribe: true, onPurchase: stopOnPurchase },
        steps: steps.map((s) => ({
          templateId: s.templateId,
          delayHours: s.delayHours,
          subject: s.subject || null,
        })),
      }

      const url = isEditing
        ? `/api/admin/automations/${initialData.id}`
        : '/api/admin/automations'
      const method = isEditing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('Failed')
      toast.success(isEditing ? 'Automation updated' : 'Automation created')
      router.push('/admin/email-marketing/automations')
      router.refresh()
    } catch {
      toast.error('Failed to save automation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Automation Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Welcome Series"
              required
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
            />
          </div>
          <div>
            <Label>Trigger *</Label>
            <Select value={trigger} onValueChange={setTrigger} required>
              <SelectTrigger>
                <SelectValue placeholder="Select trigger event..." />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} disabled={opt.unavailable}>
                    {opt.unavailable ? `${opt.label} (unavailable)` : opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="font-medium text-sm">Active</p>
              <p className="text-xs text-muted-foreground">
                Enable this automation to start processing enrollments
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stop Conditions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            {/* Always enforced by the engine: suppressed and unsubscribed addresses are never mailed. */}
            <Label>Stop when subscriber unsubscribes (always on)</Label>
            <Switch checked disabled />
          </div>
          <div className="flex items-center justify-between">
            <Label>Stop when subscriber makes a purchase</Label>
            <Switch checked={stopOnPurchase} onCheckedChange={setStopOnPurchase} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Email Steps</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addStep}>
              <Plus className="mr-2 h-4 w-4" />
              Add Step
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {steps.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <Mail className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>Add at least one email step</p>
            </div>
          )}
          {steps.map((step, index) => (
            <div key={index}>
              {index > 0 && (
                <div className="flex items-center gap-2 my-2 text-muted-foreground text-sm">
                  <ArrowDown className="h-4 w-4" />
                  <Clock className="h-4 w-4" />
                  <span>
                    Wait {step.delayHours} hour{step.delayHours !== 1 ? 's' : ''} after previous
                    step
                  </span>
                </div>
              )}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Step {index + 1}</h4>
                  {steps.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStep(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                {index > 0 && (
                  <div>
                    <Label className="text-xs">Delay (hours after previous step)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={step.delayHours}
                      onChange={(e) =>
                        updateStep(index, 'delayHours', parseInt(e.target.value) || 0)
                      }
                    />
                  </div>
                )}
                <div>
                  <Label className="text-xs">Email Template *</Label>
                  <TemplateCombobox
                    templates={templates}
                    value={step.templateId}
                    onChange={(v) => updateStep(index, 'templateId', v)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Subject Override (optional)</Label>
                  <Input
                    value={step.subject}
                    onChange={(e) => updateStep(index, 'subject', e.target.value)}
                    placeholder="Leave blank to use template subject"
                  />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isEditing ? 'Saving...' : 'Creating...'}
            </>
          ) : isEditing ? (
            'Save Automation'
          ) : (
            'Create Automation'
          )}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

interface TemplateComboboxProps {
  templates: { id: string; name: string; key: string; subject: string }[]
  value: string
  onChange: (id: string) => void
}

/**
 * Searchable template picker. Replaces the bare Select so a user can
 * type-to-filter by template name, key, or subject — necessary when
 * the template list grows past what fits in a dropdown panel.
 */
function TemplateCombobox({ templates, value, onChange }: TemplateComboboxProps) {
  const [open, setOpen] = useState(false)
  const selected = templates.find((t) => t.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between font-normal',
            !selected && 'text-muted-foreground',
          )}
        >
          <span className="truncate">
            {selected ? selected.name : 'Select template...'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command
          filter={(itemValue, search) =>
            // itemValue is the joined "name|key|subject" we set on each
            // CommandItem below. Case-insensitive substring wins.
            itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder="Search templates by name or subject..." />
          <CommandList className="max-h-80">
            <CommandEmpty>No matching templates.</CommandEmpty>
            <CommandGroup>
              {templates.map((t) => (
                <CommandItem
                  key={t.id}
                  value={`${t.name}|${t.key}|${t.subject}`}
                  onSelect={() => {
                    onChange(t.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === t.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{t.name}</span>
                    {t.subject && (
                      <span className="truncate text-xs text-muted-foreground">
                        {t.subject}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
