'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

type TeamMember = {
  id: string
  email: string
  role: string
  createdAt: string
}

export function TeamClient({ fundraiserId }: { fundraiserId: string }) {
  const [team, setTeam] = useState<TeamMember[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    fetchTeam()
  }, [fundraiserId])

  async function fetchTeam() {
    try {
      const res = await fetch(`/api/fundraisers/${fundraiserId}/team`)
      if (res.ok) {
        const data = await res.json()
        setTeam(Array.isArray(data?.team) ? data.team : [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail.trim()) return

    setIsAdding(true)
    setMessage(null)

    try {
      const res = await fetch(`/api/fundraisers/${fundraiserId}/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail }),
      })

      const data = await res.json()

      if (res.ok) {
        setTeam((prev) => [...prev, data])
        setNewEmail('')
        setMessage({ type: 'success', text: 'Team member added successfully.' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to add team member.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'An unexpected error occurred.' })
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemove = async (email: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) return

    try {
      const res = await fetch(`/api/fundraisers/${fundraiserId}/team?email=${encodeURIComponent(email)}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setTeam((prev) => prev.filter((member) => member.email !== email))
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to remove team member.')
      }
    } catch {
      alert('An unexpected error occurred.')
    }
  }

  if (isLoading) {
    return <div className="p-6 text-gray-500">Loading team...</div>
  }

  return (
    <div className="p-6 lg:p-8">
      <h1 className="mb-2 font-serif text-2xl font-bold text-gray-900">
        Team Access
      </h1>
      <p className="mb-6 text-gray-600">
        Grant write access to up to 20 team members to help manage your fundraiser.
      </p>

      <div className="max-w-2xl space-y-8">
        {/* Add new member */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-900">Add Team Member ({team.length}/20)</h2>
          
          <form onSubmit={handleAdd} className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="newEmail">Email Address</Label>
              <Input
                id="newEmail"
                name="newEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="colleague@example.com"
                required
                disabled={team.length >= 20 || isAdding}
              />
            </div>
            <Button
              type="submit"
              disabled={team.length >= 20 || isAdding}
              className="bg-salsa-500 hover:bg-salsa-600 font-semibold"
            >
              {isAdding ? 'Adding...' : 'Add Member'}
            </Button>
          </form>

          {message && (
            <div className={`mt-4 text-sm ${message.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
              {message.text}
            </div>
          )}
          {team.length >= 20 && (
            <p className="mt-4 text-sm text-amber-600">
              You have reached the maximum number of team members (20).
            </p>
          )}
        </div>

        {/* Existing members */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-900">Current Team Members</h2>
          
          {team.length === 0 ? (
            <p className="text-gray-500 text-sm">No team members added yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100 border border-gray-100 rounded-md">
              {team.map((member) => (
                <li key={member.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium text-gray-900">{member.email}</p>
                    <p className="text-sm text-gray-500">Role: {member.role}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    onClick={() => handleRemove(member.email)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  )
}
