'use client'

import { useState, useTransition } from 'react'
import { Server, Mail, Shield, AlertCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  saveEmailConfig,
  testEmailConfig,
  deleteEmailConfig,
  updateSmtpPassword,
} from '../actions'

interface EmailConfig {
  id: string
  name: string
  smtpHost: string | null
  smtpPort: number | null
  smtpUsername: string | null
  smtpSecure: boolean
  fromEmail: string
  fromName: string | null
  replyToEmail: string | null
  isDefault: boolean
  isActive: boolean
  useResend: boolean
  maxPerHour: number
  maxPerDay: number
  hasPassword: boolean
  createdAt: Date
}

interface EmailConfigFormProps {
  configs: EmailConfig[]
  canWrite: boolean
}

export function EmailConfigForm({ configs, canWrite }: EmailConfigFormProps) {
  const [isPending, startTransition] = useTransition()
  const [isTestingId, setIsTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editPasswordId, setEditPasswordId] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)

  const handleTestConfig = async (configId: string) => {
    setIsTestingId(configId)
    setTestResult(null)

    const result = await testEmailConfig(configId)
    setTestResult(result)
    setIsTestingId(null)
  }

  const handleUpdatePassword = async (configId: string) => {
    if (!newPassword.trim()) return
    setPasswordSaving(true)

    const result = await updateSmtpPassword(configId, newPassword)

    setPasswordSaving(false)
    if (result.success) {
      setEditPasswordId(null)
      setNewPassword('')
      setTestResult({
        success: true,
        message: 'Password updated and encrypted. Test the connection to verify.',
      })
    } else {
      setTestResult({ success: false, message: result.error || 'Failed to update password' })
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await saveEmailConfig(formData)

      if (result.error) {
        setError(result.error)
      } else if (result.success) {
        setShowNewForm(false)
        setError(null)
      }
    })
  }

  const handleDelete = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this configuration?')) {
      return
    }

    startTransition(async () => {
      await deleteEmailConfig(configId)
    })
  }

  return (
    <div className="space-y-6">
      {/* Current Configurations */}
      {configs.length > 0 && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Server className="h-5 w-5" />
            Email Configurations
          </h2>

          {configs.map((config) => (
            <Card key={config.id}>
              <CardContent className="pt-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold">{config.name}</h3>
                      {config.isDefault && <Badge>Default</Badge>}
                      {!config.isActive && <Badge variant="outline">Inactive</Badge>}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">SMTP Server</p>
                        <p className="font-medium">
                          {config.smtpHost
                            ? `${config.smtpHost}:${config.smtpPort}`
                            : 'Not configured'}
                        </p>
                      </div>

                      <div>
                        <p className="text-muted-foreground">From Email</p>
                        <p className="font-medium">{config.fromEmail}</p>
                      </div>

                      <div>
                        <p className="text-muted-foreground">Security</p>
                        <p className="font-medium">{config.smtpSecure ? 'TLS/SSL' : 'None'}</p>
                      </div>

                      <div>
                        <p className="text-muted-foreground">Fallback to Resend</p>
                        <p className="font-medium">{config.useResend ? 'Yes' : 'No'}</p>
                      </div>

                      <div>
                        <p className="text-muted-foreground">Rate Limits</p>
                        <p className="font-medium">
                          {config.maxPerHour}/hr, {config.maxPerDay}/day
                        </p>
                      </div>
                    </div>
                  </div>

                  {canWrite && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestConfig(config.id)}
                        disabled={isTestingId === config.id}
                      >
                        {isTestingId === config.id ? 'Testing…' : 'Test Connection'}
                      </Button>

                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDelete(config.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete configuration</span>
                      </Button>
                    </div>
                  )}
                </div>

                {testResult && isTestingId === null && (
                  <Alert
                    variant={testResult.success ? 'default' : 'destructive'}
                    className="mt-4"
                  >
                    <AlertDescription>{testResult.message}</AlertDescription>
                  </Alert>
                )}

                {canWrite && config.smtpHost && (
                  <>
                    <Separator className="my-4" />
                    {editPasswordId === config.id ? (
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="flex-1 min-w-[200px] space-y-1.5">
                          <Label htmlFor={`password-${config.id}`}>SMTP Password</Label>
                          <Input
                            id={`password-${config.id}`}
                            type="password"
                            placeholder="Enter Gmail App Password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleUpdatePassword(config.id)}
                          disabled={passwordSaving || !newPassword.trim()}
                        >
                          {passwordSaving ? 'Saving...' : 'Save'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditPasswordId(null)
                            setNewPassword('')
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditPasswordId(config.id)}
                      >
                        <Mail className="mr-2 h-4 w-4" />
                        {config.hasPassword ? 'Update SMTP Password' : 'Set SMTP Password'}
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add New Configuration */}
      {canWrite && (
        <div>
          {!showNewForm ? (
            <Button onClick={() => setShowNewForm(true)}>Add New Configuration</Button>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>New Email Configuration</CardTitle>
                <CardDescription>
                  Configure an SMTP provider or use Resend as the transport.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Configuration Name *</Label>
                      <Input
                        id="name"
                        name="name"
                        required
                        placeholder="e.g., Primary SMTP Server"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="fromEmail">From Email *</Label>
                        <Input
                          id="fromEmail"
                          name="fromEmail"
                          type="email"
                          required
                          placeholder="no-reply@example.com"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="fromName">From Name</Label>
                        <Input
                          id="fromName"
                          name="fromName"
                          placeholder="Jose Madrid Salsa"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="replyToEmail">Reply-To Email</Label>
                      <Input
                        id="replyToEmail"
                        name="replyToEmail"
                        type="email"
                        placeholder="support@example.com"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium">SMTP Configuration (Optional)</h3>
                      <p className="text-sm text-muted-foreground">
                        Leave blank to use Resend only
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2 space-y-1.5">
                        <Label htmlFor="smtpHost">SMTP Host</Label>
                        <Input
                          id="smtpHost"
                          name="smtpHost"
                          placeholder="smtp.gmail.com"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="smtpPort">Port</Label>
                        <Input
                          id="smtpPort"
                          name="smtpPort"
                          type="number"
                          placeholder="587"
                          defaultValue="587"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="smtpUsername">SMTP Username</Label>
                        <Input
                          id="smtpUsername"
                          name="smtpUsername"
                          placeholder="username"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="smtpPassword">SMTP Password</Label>
                        <Input
                          id="smtpPassword"
                          name="smtpPassword"
                          type="password"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox id="smtpSecure" name="smtpSecure" />
                      <Label htmlFor="smtpSecure" className="font-normal">
                        Use implicit SSL (port 465 only — leave unchecked for port 587 TLS)
                      </Label>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="font-medium">Settings</h3>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Checkbox id="useResend" name="useResend" defaultChecked />
                        <Label htmlFor="useResend" className="font-normal">
                          Fallback to Resend if SMTP fails
                        </Label>
                      </div>

                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="isDefault"
                          name="isDefault"
                          defaultChecked={configs.length === 0}
                        />
                        <Label htmlFor="isDefault" className="font-normal">
                          Set as default configuration
                        </Label>
                      </div>

                      <div className="flex items-center gap-2">
                        <Checkbox id="isActive" name="isActive" defaultChecked />
                        <Label htmlFor="isActive" className="font-normal">
                          Active
                        </Label>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="font-medium">Rate Limits</h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="maxPerHour">Max Emails Per Hour</Label>
                        <Input
                          id="maxPerHour"
                          name="maxPerHour"
                          type="number"
                          defaultValue="1000"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="maxPerDay">Max Emails Per Day</Label>
                        <Input
                          id="maxPerDay"
                          name="maxPerDay"
                          type="number"
                          defaultValue="10000"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowNewForm(false)
                        setError(null)
                      }}
                      disabled={isPending}
                    >
                      Cancel
                    </Button>

                    <Button type="submit" disabled={isPending}>
                      {isPending ? 'Saving…' : 'Save Configuration'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Help Text */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>Configuration Tips</AlertTitle>
        <AlertDescription>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>SMTP passwords are encrypted before storing in database</li>
            <li>Test the connection before using in campaigns</li>
            <li>Enable Resend fallback for reliability</li>
            <li>Rate limits help prevent hitting provider quotas</li>
            <li>Use port 587 for TLS or 465 for SSL</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  )
}
