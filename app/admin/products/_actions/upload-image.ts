'use server'

import { put } from '@vercel/blob'
import { requirePermission } from '@/lib/rbac'

export interface UploadImageResult {
  success: boolean
  url?: string
  error?: string
}

/**
 * Upload an image to Vercel Blob storage
 * Requires products:write permission
 *
 * @param formData - FormData containing the file to upload
 * @returns UploadImageResult with success status and URL or error message
 */
export async function uploadProductImage(
  formData: FormData
): Promise<UploadImageResult> {
  try {
    // Verify permissions
    await requirePermission('products:write')

    // Extract file from FormData
    const file = formData.get('file') as File | null

    if (!file) {
      return {
        success: false,
        error: 'No file provided',
      }
    }

    // Validate file type (images only)
    if (!file.type.startsWith('image/')) {
      return {
        success: false,
        error: 'File must be an image',
      }
    }

    // Validate file size (max 4.5MB for server uploads on Vercel)
    const maxSize = 4.5 * 1024 * 1024 // 4.5MB in bytes
    if (file.size > maxSize) {
      return {
        success: false,
        error: 'File size must be less than 4.5MB',
      }
    }

    // Generate a unique filename with timestamp
    const timestamp = Date.now()
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-')
    const filename = `products/${timestamp}-${originalName}`

    // Upload to Vercel Blob
    const blob = await put(filename, file, {
      access: 'public',
    })

    return {
      success: true,
      url: blob.url,
    }
  } catch (error: any) {
    console.error('Error uploading product image:', error)

    // Handle permission errors
    if (error.message?.includes('permission')) {
      return {
        success: false,
        error: 'You do not have permission to upload product images',
      }
    }

    // Handle authentication errors
    if (error.message?.includes('Unauthorized')) {
      return {
        success: false,
        error: 'Unauthorized - not authenticated',
      }
    }

    // Handle Vercel Blob errors
    if (error.message?.includes('BLOB_READ_WRITE_TOKEN')) {
      console.error('CRITICAL: BLOB_READ_WRITE_TOKEN environment variable is missing')
      return {
        success: false,
        error: 'Image upload service is not configured. Please contact support.',
      }
    }

    return {
      success: false,
      error: error.message || 'Failed to upload image',
    }
  }
}
