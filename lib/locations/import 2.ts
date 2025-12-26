import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import Papa from 'papaparse'

export const LocationImportSchema = z.object({
  businessName: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(2),
  zipCode: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  photoUrl: z.string().url().optional().or(z.literal('')),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  county: z.string().optional(),
  isActive: z.coerce.boolean().default(true),
})

export type LocationImportRow = z.infer<typeof LocationImportSchema>

export async function importLocations(rows: any[], updateExisting = true): Promise<{
  created: number
  updated: number
  errors: Array<{ row: number; message: string }>
}> {
  const result = {
    created: 0,
    updated: 0,
    errors: [] as Array<{ row: number; message: string }>,
  }

  for (let i = 0; i < rows.length; i++) {
    try {
      const validated = LocationImportSchema.parse(rows[i])

      const existing = await prisma.retailLocation.findUnique({
        where: {
          businessName_address: {
            businessName: validated.businessName,
            address: validated.address,
          },
        },
      })

      if (existing && updateExisting) {
        await prisma.retailLocation.update({
          where: { id: existing.id },
          data: validated as any,
        })
        result.updated++
      } else if (!existing) {
        await prisma.retailLocation.create({
          data: validated as any,
        })
        result.created++
      }
    } catch (error) {
      result.errors.push({
        row: i + 2,
        message: String(error),
      })
    }
  }

  return result
}

export async function exportLocations(filters?: {
  state?: string
  city?: string
  isActive?: boolean
}): Promise<string> {
  const locations = await prisma.retailLocation.findMany({
    where: {
      ...(filters?.state && { state: filters.state }),
      ...(filters?.city && { city: filters.city }),
      ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
    },
    orderBy: [{ state: 'asc' }, { city: 'asc' }, { businessName: 'asc' }],
  })

  const csvData = locations.map((loc) => ({
    businessName: loc.businessName,
    address: loc.address,
    city: loc.city,
    state: loc.state,
    zipCode: loc.zipCode || '',
    phone: loc.phone || '',
    website: loc.website || '',
    photoUrl: loc.photoUrl || '',
    latitude: loc.latitude?.toString() || '',
    longitude: loc.longitude?.toString() || '',
    county: loc.county || '',
    isActive: loc.isActive,
  }))

  return Papa.unparse(csvData)
}
