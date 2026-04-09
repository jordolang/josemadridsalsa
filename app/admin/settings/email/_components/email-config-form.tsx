'use client'

import { useState, useTransition } from 'react'
import { Server, Mail, Shield, Clock, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveEmailConfig, testEmailConfig, deleteEmailConfig, updateSmtpPassword } from '../actions'

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
      setTestResult({ success: true, message: 'Password updated and encrypted. Test the connection to verify.' })
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
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Server className="h-5 w-5" />
            Email Configurations
          </h2>

          {configs.map((config) => (
            <Card key={config.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{config.name}</h3>
                    {config.isDefault && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                        Default
                      </span>
                    )}
                    {!config.isActive && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-800 text-xs font-medium rounded">
                        Inactive
                      </span>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-600">SMTP Server</p>
                      <p className="font-medium">
                        {config.smtpHost ? `${config.smtpHost}:${config.smtpPort}` : 'Not configured'}
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-600">From Email</p>
                      <p className="font-medium">{config.fromEmail}</p>
                    </div>

                    <div>
                      <p className="text-slate-600">Security</p>
                      <p className="font-medium">{config.smtpSecure ? 'TLS/SSL' : 'None'}</p>
                    </div>

                    <div>
                      <p className="text-slate-600">Fallback to Resend</p>
                      <p className="font-medium">{config.useResend ? 'Yes' : 'No'}</p>
                    </div>

                    <div>
                      <p className="text-slate-600">Rate Limits</p>
                      <p className="font-medium">
                        {config.maxPerHour}/hr, {config.maxPerDay}/day
                      </p>
                    </div>
                  </div>
                </div>

                {canWrite && (
                  <div className="ml-4 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestConfig(config.id)}
                      disabled={isTestingId === config.id}
                    >
                      {isTestingId === config.id ? (
                        <>
                          <span className="animate-spin mr-2">⏳</span>
                          Testing...
                        </>
                      ) : (
                        'Test Connection'
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(config.id)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {testResult && isTestingId === null && (
                <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
                  testResult.success
                    ? 'bg-green-50 text-green-900'
                    : 'bg-red-50 text-red-900'
                }`}>
                  {testResult.success ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  )}
                  <p className="text-sm">{testResult.message}</p>
                </div>
              )}

              {canWrite && config.smtpHost && (
                <div className="mt-4 border-t pt-4">
                  {editPasswordId === config.id ? (
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <Label htmlFor={`password-${config.id}`}>SMTP Password</Label>
                        <Input
                          id={`password-${config.id}`}
                          type="password"
                          placeholder="Enter Gmail App Password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="mt-1.5"
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
                      <Mail className="h-4 w-4 mr-2" />
                      {config.hasPassword ? 'Update SMTP Password' : 'Set SMTP Password'}
                    </Button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Add New Configuration */}
      {canWrite && (
        <div>
          {!showNewForm ? (
            <Button onClick={() => setShowNewForm(true)}>
              Add New Configuration
            </Button>
          ) : (
            <Card className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <h2 className="text-lg font-semibold">New Email Configuration</h2>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    <p className="text-sm text-red-900">{error}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Configuration Name *</Label>
                    <Input
                      id="name"
                      name="name"
                      required
                      placeholder="e.g., Primary SMTP Server"
                      className="mt-1.5"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="fromEmail">From Email *</Label>
                      <Input
                        id="fromEmail"
                        name="fromEmail"
                        type="email"
                        required
                        placeholder="no-reply@example.com"
                        className="mt-1.5"
                      />
                    </div>

                    <div>
                      <Label htmlFor="fromName">From Name</Label>
                      <Input
                        id="fromName"
                        name="fromName"
                        placeholder="Jose Madrid Salsa"
                        className="mt-1.5"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="replyToEmail">Reply-To Email</Label>
                    <Input
                      id="replyToEmail"
                      name="replyToEmail"
                      type="email"
                      placeholder="support@example.com"
                      className="mt-1.5"
                    />
                  </div>

                  <div className="border-t pt-4 mt-4">
                    <h3 className="font-medium mb-3">SMTP Configuration (Optional)</h3>
                    <p className="text-sm text-slate-600 mb-4">
                      Leave blank to use Resend only
                    </p>

                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                          <Label htmlFor="smtpHost">SMTP Host</Label>
                          <Input
                            id="smtpHost"
                            name="smtpHost"
                            placeholder="smtp.gmail.com"
                            className="mt-1.5"
                          />
                        </div>

                        <div>
                          <Label htmlFor="smtpPort">Port</Label>
                          <Input
                            id="smtpPort"
                            name="smtpPort"
                            type="number"
                            placeholder="587"
                            defaultValue="587"
                            className="mt-1.5"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="smtpUsername">SMTP Username</Label>
                          <Input
                            id="smtpUsername"
                            name="smtpUsername"
                            placeholder="username"
                            className="mt-1.5"
                          />
                        </div>

                        <div>
                          <Label htmlFor="smtpPassword">SMTP Password</Label>
                          <Input
                            id="smtpPassword"
                            name="smtpPassword"
                            type="password"
                            placeholder="••••••••"
                            className="mt-1.5"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="smtpSecure"
                          name="smtpSecure"
                          className="rounded border-slate-300"
                        />
                        <Label htmlFor="smtpSecure" className="font-normal cursor-pointer">
                          Use implicit SSL (port 465 only — leave unchecked for port 587 TLS)
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4 mt-4">
                    <h3 className="font-medium mb-3">Settings</h3>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="useResend"
                          name="useResend"
                          defaultChecked
                          className="rounded border-slate-300"
                        />
                        <Label htmlFor="useResend" className="font-normal cursor-pointer">
                          Fallback to Resend if SMTP fails
                        </Label>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="isDefault"
                          name="isDefault"
                          defaultChecked={configs.length === 0}
                          className="rounded border-slate-300"
                        />
                        <Label htmlFor="isDefault" className="font-normal cursor-pointer">
                          Set as default configuration
                        </Label>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="isActive"
                          name="isActive"
                          defaultChecked
                          className="rounded border-slate-300"
                        />
                        <Label htmlFor="isActive" className="font-normal cursor-pointer">
                          Active
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4 mt-4">
                    <h3 className="font-medium mb-3">Rate Limits</h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="maxPerHour">Max Emails Per Hour</Label>
                        <Input
                          id="maxPerHour"
                          name="maxPerHour"
                          type="number"
                          defaultValue="1000"
                          className="mt-1.5"
                        />
                      </div>

                      <div>
                        <Label htmlFor="maxPerDay">Max Emails Per Day</Label>
                        <Input
                          id="maxPerDay"
                          name="maxPerDay"
                          type="number"
                          defaultValue="10000"
                          className="mt-1.5"
                        />
                      </div>
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
                    {isPending ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Saving...
                      </>
                    ) : (
                      'Save Configuration'
                    )}
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      )}

      {/* Help Text */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-2">Configuration Tips:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>SMTP passwords are encrypted before storing in database</li>
              <li>Test the connection before using in campaigns</li>
              <li>Enable Resend fallback for reliability</li>
              <li>Rate limits help prevent hitting provider quotas</li>
              <li>Use port 587 for TLS or 465 for SSL</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  )
}
