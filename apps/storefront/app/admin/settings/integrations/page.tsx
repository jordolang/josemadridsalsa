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
import {
  getQuickBooksAppCredentials,
  saveQuickBooksAppCredentials,
  getDefaultEnvironment,
  getQuickBooksRedirectUri,
  type QuickBooksEnvironment,
} from '@/lib/quickbooks/config'
import { getConnectionStatus, disconnect } from '@/lib/quickbooks/connection'
import Link from 'next/link'

async function saveQuickBooksCredentialsAction(formData: FormData) {
  'use server'

  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'api_keys:manage'))) {
    throw new Error('Unauthorized')
  }

  const environment: QuickBooksEnvironment =
    formData.get('environment') === 'production' ? 'production' : 'sandbox'
  const clientId = String(formData.get('clientId') || '').trim()
  const clientSecret = String(formData.get('clientSecret') || '').trim()

  if (!clientId || !clientSecret) {
    throw new Error('Client ID and Client Secret are required')
  }

  await saveQuickBooksAppCredentials({
    environment,
    clientId,
    clientSecret,
    updatedById: user.id,
  })

  await logAudit({
    userId: user.id,
    action: 'integration.update',
    entityType: 'QuickBooksAppCredential',
    entityId: environment,
    changes: { rotated: true },
  })

  revalidatePath('/admin/settings/integrations')
}

async function disconnectQuickBooksAction() {
  'use server'

  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'api_keys:manage'))) {
    throw new Error('Unauthorized')
  }

  await disconnect()

  await logAudit({
    userId: user.id,
    action: 'integration.disconnect',
    entityType: 'QuickBooksConnection',
  })

  revalidatePath('/admin/settings/integrations')
}

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
          rotatedAt: new Date(),
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

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ quickbooks?: string; message?: string }>
}) {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'settings:read'))) {
    redirect('/admin')
  }

  const canManage = await hasPermission(user, 'api_keys:manage')

  const serviceKeys = await prisma.serviceKey.findMany({
    orderBy: [{ serviceName: 'asc' }, { keyName: 'asc' }],
  })

  const { quickbooks: qbResult, message: qbMessage } = await searchParams
  const qbEnvironment = getDefaultEnvironment()
  const [qbStatus, qbCreds] = await Promise.all([
    getConnectionStatus(),
    getQuickBooksAppCredentials(qbEnvironment),
  ])
  const qbRedirectUri = getQuickBooksRedirectUri()

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
          <CardTitle>QuickBooks Online</CardTitle>
          <CardDescription>
            Sync orders, customers, and payments into QuickBooks. Connect a company below;
            sales flow into your books automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {qbResult === 'connected' && (
            <Alert>
              <AlertDescription>QuickBooks connected successfully.</AlertDescription>
            </Alert>
          )}
          {qbResult === 'error' && (
            <Alert variant="destructive">
              <AlertDescription>
                QuickBooks connection failed{qbMessage ? `: ${qbMessage}` : '.'}
              </AlertDescription>
            </Alert>
          )}
          {qbResult === 'disconnected' && (
            <Alert>
              <AlertDescription>
                Disconnected from QuickBooks. Order sync is stopped until you reconnect.
              </AlertDescription>
            </Alert>
          )}
          {qbResult === 'unverified' && (
            <Alert>
              <AlertDescription>
                QuickBooks reported a disconnect we could not match to this company. If the
                connection below still shows as active, disconnect it here as well.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">Status:</span>
            {qbStatus.connected ? (
              <>
                <Badge>Connected</Badge>
                <span className="text-sm text-muted-foreground">
                  {qbStatus.companyName ?? `Realm ${qbStatus.realmId}`} • {qbStatus.environment}
                </span>
              </>
            ) : (
              <Badge variant="outline">Not connected</Badge>
            )}
          </div>

          {qbStatus.connected && qbStatus.connectionError && (
            <Alert variant="destructive">
              <AlertDescription>{qbStatus.connectionError}</AlertDescription>
            </Alert>
          )}

          {qbStatus.connected && (
            <p className="text-xs text-muted-foreground">
              Last synced:{' '}
              {qbStatus.lastSyncedAt ? qbStatus.lastSyncedAt.toLocaleString() : 'Never'}
            </p>
          )}

          {canManage ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {qbCreds ? (
                  <Button asChild>
                    <a href={`/api/integrations/quickbooks/connect?environment=${qbEnvironment}`}>
                      {qbStatus.connected ? 'Reconnect' : 'Connect QuickBooks'}
                    </a>
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Add your Client ID and Secret below to enable connecting.
                  </p>
                )}
                {qbStatus.connected && (
                  <Button asChild variant="outline">
                    <Link href="/admin/settings/integrations/quickbooks">Sync settings</Link>
                  </Button>
                )}
                {qbStatus.connected && (
                  <form action={disconnectQuickBooksAction}>
                    <Button type="submit" variant="outline">
                      Disconnect
                    </Button>
                  </form>
                )}
              </div>

              <form action={saveQuickBooksCredentialsAction} className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="qbClientId">Client ID</Label>
                  <Input
                    id="qbClientId"
                    name="clientId"
                    placeholder="Intuit app Client ID"
                    defaultValue={qbCreds?.clientId ?? ''}
                    className="font-mono text-sm"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qbEnvironment">Environment</Label>
                  <select
                    id="qbEnvironment"
                    name="environment"
                    defaultValue={qbEnvironment}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="sandbox">Sandbox</option>
                    <option value="production">Production</option>
                  </select>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="qbClientSecret">Client Secret</Label>
                  <Input
                    id="qbClientSecret"
                    name="clientSecret"
                    type="password"
                    placeholder="Paste the Intuit app Client Secret..."
                    className="font-mono text-sm"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Encrypted immediately with AES-256-GCM. Register your app at
                    developer.intuit.com and set the Redirect URI to{' '}
                    <code className="break-all">{qbRedirectUri}</code>.
                  </p>
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button type="submit" variant="secondary">
                    Save QuickBooks credentials
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <Alert>
              <AlertDescription>
                You have read-only access. Contact an administrator with API key permissions to
                connect QuickBooks.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

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
