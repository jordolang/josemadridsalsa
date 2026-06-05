import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { encryptSecret } from '@/lib/crypto'
import { logAudit } from '@/lib/audit'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { IntegrationHealth } from '@/components/admin/settings/integration-health'

async function saveServiceKey(formData: FormData) {
  'use server'

  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'api_keys:manage'))) {
    throw new Error('Unauthorized')
  }

  const serviceName = String(formData.get('serviceName') || '').trim()
  const keyName = String(formData.get('keyName') || '').trim()
  const rawValue = formData.get('value')
  const value = typeof rawValue === 'string' && rawValue.trim().length > 0 ? rawValue.trim() : null
  const isActive = formData.get('isActive') === 'on'

  if (!serviceName || !keyName) {
    throw new Error('Service name and key name are required')
  }

  const compositeKey = {
    serviceName: serviceName.toLowerCase(),
    keyName: keyName.toLowerCase(),
  }

  const existing = await prisma.serviceKey.findUnique({
    where: {
      serviceName_keyName: compositeKey,
    },
  })

  if (!existing && !value) {
    throw new Error('Please provide a secret value for new integrations')
  }

  const baseData = {
    serviceName: compositeKey.serviceName,
    keyName: compositeKey.keyName,
    isActive,
  }

  const encrypted = value ? encryptSecret(value) : null

  const createData = encrypted
    ? {
        ...baseData,
        encryptedValue: encrypted.encryptedValue,
        iv: encrypted.iv,
      }
    : {
        ...baseData,
        encryptedValue: existing?.encryptedValue ?? '',
        iv: existing?.iv ?? '',
      }

  await prisma.serviceKey.upsert({
    where: { serviceName_keyName: compositeKey },
    update: encrypted
      ? {
          ...baseData,
          encryptedValue: encrypted.encryptedValue,
          iv: encrypted.iv,
        }
      : baseData,
    create: createData,
  })

  await logAudit({
    userId: user.id,
    action: existing ? 'integration.update' : 'integration.create',
    entityType: 'ServiceKey',
    entityId: `${compositeKey.serviceName}:${compositeKey.keyName}`,
    changes: {
      isActive,
      rotated: Boolean(value),
    },
  })

  revalidatePath('/admin/settings/integrations')
}

async function toggleServiceKey(id: string, nextState: 'enable' | 'disable') {
  'use server'

  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'api_keys:manage'))) {
    throw new Error('Unauthorized')
  }

  const isActive = nextState === 'enable'

  await prisma.serviceKey.update({
    where: { id },
    data: {
      isActive,
    },
  })

  await logAudit({
    userId: user.id,
    action: 'integration.toggle',
    entityType: 'ServiceKey',
    entityId: id,
    changes: { isActive },
  })

  revalidatePath('/admin/settings/integrations')
}

export default async function IntegrationsPage() {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'settings:read'))) {
    redirect('/admin')
  }

  const canManage = await hasPermission(user, 'api_keys:manage')

  const serviceKeys = await prisma.serviceKey.findMany({
    orderBy: [{ serviceName: 'asc' }, { keyName: 'asc' }],
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Integrations</h1>
          <p className="text-muted-foreground">
            Manage encrypted API credentials for payments, shipping, calendar sync, email, and social platforms.
          </p>
        </div>
        <div className="rounded-lg bg-muted px-4 py-2 text-sm text-muted-foreground">
          Encryption enabled • Keys stored using AES-256-GCM
        </div>
      </div>

      <IntegrationHealth />

      <Card>
        <CardHeader>
          <CardTitle>Current credentials</CardTitle>
          <CardDescription>
            Whether each stored key is enabled. For live &quot;is it actually working?&quot; status,
            see Service health above.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {serviceKeys.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No integrations configured yet. Add Stripe, shipping provider, Google Calendar, or social media secrets below.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Enabled</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead>Updated</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {serviceKeys.map((serviceKey) => {
                    const enableAction = toggleServiceKey.bind(null, serviceKey.id, 'enable')
                    const disableAction = toggleServiceKey.bind(null, serviceKey.id, 'disable')
                    return (
                      <TableRow key={serviceKey.id}>
                        <TableCell className="font-medium text-foreground">
                          {serviceKey.serviceName}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {serviceKey.keyName}
                        </TableCell>
                        <TableCell>
                          <Badge variant={serviceKey.isActive ? 'default' : 'outline'}>
                            {serviceKey.isActive ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {serviceKey.lastUsed ? serviceKey.lastUsed.toLocaleString() : 'Never'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {serviceKey.updatedAt.toLocaleString()}
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {serviceKey.isActive ? (
                                <form action={disableAction}>
                                  <Button type="submit" variant="ghost" size="sm">
                                    Disable
                                  </Button>
                                </form>
                              ) : (
                                <form action={enableAction}>
                                  <Button type="submit" variant="ghost" size="sm">
                                    Enable
                                  </Button>
                                </form>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add or rotate credentials</CardTitle>
          <CardDescription>
            Secrets are encrypted immediately and never returned in plaintext. Re-enter a value to rotate it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <form action={saveServiceKey} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="serviceName">Service name</Label>
                <Input
                  id="serviceName"
                  name="serviceName"
                  placeholder="stripe"
                  required
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Lowercase identifier, e.g. <code>stripe</code>, <code>shipping</code>, <code>google_calendar</code>.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="keyName">Key name</Label>
                <Input
                  id="keyName"
                  name="keyName"
                  placeholder="api_key"
                  required
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Label for this secret, e.g. <code>api_key</code>, <code>webhook_secret</code>.
                </p>
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="value">Secret value</Label>
                <Textarea
                  id="value"
                  name="value"
                  placeholder="Paste the API key or credential value..."
                  className="h-32 font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to keep the existing value for this service/key combination.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="isActive" name="isActive" defaultChecked />
                <Label htmlFor="isActive" className="font-normal">
                  Enable immediately
                </Label>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button type="submit">Save integration</Button>
              </div>
            </form>
          ) : (
            <Alert>
              <AlertDescription>
                You have read-only access. Contact an administrator with API key permissions to add or rotate credentials.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
