import { createUploadthing, type FileRouter } from 'uploadthing/next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const f = createUploadthing()

export const ourFileRouter = {
  emailTemplateImage: f({ image: { maxFileSize: '8MB', maxFileCount: 1 } })
    .middleware(async () => {
      const session = await getServerSession(authOptions)
      if (!session?.user) throw new Error('Unauthorized')
      return { userId: (session.user as any).id as string }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { url: file.url, uploadedBy: metadata.userId }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
