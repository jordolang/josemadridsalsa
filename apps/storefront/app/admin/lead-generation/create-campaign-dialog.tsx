'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createLeadCampaign } from '@/lib/actions/lead-generation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type LeadType = 'SCHOOL_ATHLETICS' | 'LOCAL_BUSINESS' | 'LOCAL_SCHOOL' | 'FUNDRAISER_ORG'

const LEAD_TYPE_LABELS: Record<LeadType, string> = {
  SCHOOL_ATHLETICS: 'School Athletics',
  LOCAL_BUSINESS: 'Local Businesses',
  LOCAL_SCHOOL: 'Local Schools',
  FUNDRAISER_ORG: 'Fundraiser Orgs',
}

// Organization types that commonly run fundraisers. Must match the labels in
// lib/scraper/fundraiser-config.ts so the search stage can expand them.
const FUNDRAISER_CATEGORIES = [
  'Youth Sports Leagues',
  'Booster Clubs & PTA/PTO',
  'Bands & Performing Arts',
  'Cheer, Dance & Gymnastics',
  'Scouts & Youth Clubs',
  'Churches & Faith Groups',
  'Nonprofits & Charities',
  'Schools & Preschools',
  'Civic & Community',
] as const

const BUSINESS_CATEGORIES = [
  'Restaurants',
  'Gyms & Fitness',
  'Dentists',
  'Salons & Spas',
  'Auto Repair',
  'Real Estate',
  'Law Firms',
  'Medical Clinics',
  'Pet Services',
  'Home Services',
  'Retail Stores',
  'Other',
] as const

export function CreateCampaignDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [leadType, setLeadType] = useState<LeadType>('SCHOOL_ATHLETICS')
  const [businessCategory, setBusinessCategory] = useState('')
  const [radius, setRadius] = useState('10mi')
  const router = useRouter()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)

    try {
      const id = await createLeadCampaign({
        name: fd.get('name') as string,
        city: fd.get('city') as string,
        state: fd.get('state') as string,
        leadType,
        district: (fd.get('district') as string) || undefined,
        schoolType: (fd.get('schoolType') as string) || undefined,
        businessCategory: businessCategory || undefined,
        searchQuery: (fd.get('searchQuery') as string) || undefined,
        radius: radius || undefined,
        limit: parseInt(fd.get('limit') as string) || 50,
      })
      setOpen(false)
      router.push(`/admin/lead-generation/${id}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      alert(`Failed to create campaign: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setLeadType('SCHOOL_ATHLETICS')
      setBusinessCategory('')
      setRadius('10mi')
    }
  }

  const isSchoolType = leadType === 'SCHOOL_ATHLETICS' || leadType === 'LOCAL_SCHOOL'
  const isBusinessType = leadType === 'LOCAL_BUSINESS'
  const isFundraiserType = leadType === 'FUNDRAISER_ORG'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>New Campaign</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Create Lead Campaign</DialogTitle>
            <DialogDescription>
              Choose a lead type and configure search parameters.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Lead Type Selector */}
            <div className="grid gap-2">
              <Label>Lead Type</Label>
              <Tabs
                value={leadType}
                onValueChange={(v) => setLeadType(v as LeadType)}
              >
                <TabsList className="w-full">
                  {(Object.entries(LEAD_TYPE_LABELS) as [LeadType, string][]).map(
                    ([value, label]) => (
                      <TabsTrigger key={value} value={value} className="flex-1 text-xs">
                        {label}
                      </TabsTrigger>
                    )
                  )}
                </TabsList>
              </Tabs>
            </div>

            {/* Campaign Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">Campaign Name</Label>
              <Input
                id="name"
                name="name"
                placeholder={
                  isBusinessType
                    ? 'E.g., Columbus OH Restaurants'
                    : 'E.g., Columbus OH High Schools'
                }
                required
              />
            </div>

            {/* City + State (always shown) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="city"
                  placeholder="E.g., Columbus"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  name="state"
                  placeholder="E.g., Ohio or OH"
                  required
                />
              </div>
            </div>

            {/* School-specific fields */}
            {isSchoolType && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="district">School District (Optional)</Label>
                  <Input
                    id="district"
                    name="district"
                    placeholder="E.g., Columbus City Schools"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="schoolType">School Type</Label>
                  <Input
                    id="schoolType"
                    name="schoolType"
                    defaultValue="high school"
                    placeholder="E.g., high school, middle school"
                    required
                  />
                </div>
              </>
            )}

            {/* Business-specific fields */}
            {isBusinessType && (
              <>
                <div className="grid gap-2">
                  <Label>Business Category</Label>
                  <Select value={businessCategory} onValueChange={setBusinessCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {BUSINESS_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="radius">Search Radius</Label>
                  <Select value={radius} onValueChange={setRadius}>
                    <SelectTrigger id="radius">
                      <SelectValue placeholder="Select radius" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5mi">5 miles</SelectItem>
                      <SelectItem value="10mi">10 miles</SelectItem>
                      <SelectItem value="25mi">25 miles</SelectItem>
                      <SelectItem value="50mi">50 miles</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Fundraiser-org-specific fields */}
            {isFundraiserType && (
              <div className="grid gap-2">
                <Label>Organization Type (Optional)</Label>
                <Select value={businessCategory} onValueChange={setBusinessCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="All fundraiser organizations" />
                  </SelectTrigger>
                  <SelectContent>
                    {FUNDRAISER_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Leave unset to search every fundraiser-prone organization type
                  (booster clubs, PTAs, youth sports, bands, scouts, churches, nonprofits, and more).
                </p>
              </div>
            )}

            {/* Custom Search Query (all types) */}
            <div className="grid gap-2">
              <Label htmlFor="searchQuery">Custom Search Query (Optional)</Label>
              <Input
                id="searchQuery"
                name="searchQuery"
                placeholder={
                  isBusinessType
                    ? 'E.g., "pizza restaurants near downtown"'
                    : 'E.g., "varsity football coach"'
                }
              />
              <p className="text-xs text-muted-foreground">
                Override the auto-generated search query for advanced targeting.
              </p>
            </div>

            {/* Max Results */}
            <div className="grid gap-2">
              <Label htmlFor="limit">Max Results Limit</Label>
              <Input
                id="limit"
                name="limit"
                type="number"
                defaultValue={50}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Campaign'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
