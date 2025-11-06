import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FetchPhotosButton } from './_components/FetchPhotosButton'

async function getLocations() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/admin/locations`, { cache: 'no-store' })
  if (!res.ok) return { locations: [] }
  return res.json() as Promise<{ locations: any[] }>
}

export default async function AdminLocationsPage() {
  const { locations } = await getLocations()
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Retail Locations</h1>
        <div className="flex items-center gap-3">
          <FetchPhotosButton />
          <Button asChild>
            <Link href="/admin/locations/new">Add Location</Link>
          </Button>
        </div>
      </div>
      <Card className="bg-card">
        <CardHeader>
          <CardTitle>All Locations ({locations.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Business</th>
                  <th className="py-2 pr-4">City</th>
                  <th className="py-2 pr-4">State</th>
                  <th className="py-2 pr-4">Phone</th>
                  <th className="py-2 pr-4">Active</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((loc) => (
                  <tr key={loc.id} className="border-t border-border">
                    <td className="py-2 pr-4">{loc.businessName}</td>
                    <td className="py-2 pr-4">{loc.city}</td>
                    <td className="py-2 pr-4">{loc.state}</td>
                    <td className="py-2 pr-4">{loc.phone || '-'}</td>
                    <td className="py-2 pr-4">{loc.isActive ? 'Yes' : 'No'}</td>
                    <td className="py-2 pr-4">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/locations/${loc.id}/edit`}>Edit</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


