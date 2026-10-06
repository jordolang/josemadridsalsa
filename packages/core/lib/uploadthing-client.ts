import { generateReactHelpers } from '@uploadthing/react'
import type { OurFileRouter } from '@/lib/uploadthing'

export const { useUploadThing, uploadFiles } = generateReactHelpers<OurFileRouter>()
