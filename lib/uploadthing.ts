import { createUploadthing, type FileRouter } from 'uploadthing/next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

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

  fundraiserLogo: f({ image: { maxFileSize: '4MB', maxFileCount: 1 } })
    .middleware(async () => {
      const session = await getServerSession(authOptions)
      if (!session?.user || (session.user as any).role !== 'FUNDRAISER') {
        throw new Error('Unauthorized - fundraiser account required')
      }
      const account = await prisma.fundraiserAccount.findUnique({
        where: { userId: (session.user as any).id as string },
        select: { status: true },
      })
      if (!account || account.status !== 'APPROVED') {
        throw new Error('Unauthorized: account not approved')
      }
      return { userId: (session.user as any).id as string }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { url: file.url, uploadedBy: metadata.userId }
    }),

  fundraiserCoverPhoto: f({ image: { maxFileSize: '8MB', maxFileCount: 1 } })
    .middleware(async () => {
      const session = await getServerSession(authOptions)
      if (!session?.user || (session.user as any).role !== 'FUNDRAISER') {
        throw new Error('Unauthorized - fundraiser account required')
      }
      const account = await prisma.fundraiserAccount.findUnique({
        where: { userId: (session.user as any).id as string },
        select: { status: true },
      })
      if (!account || account.status !== 'APPROVED') {
        throw new Error('Unauthorized: account not approved')
      }
      return { userId: (session.user as any).id as string }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { url: file.url, uploadedBy: metadata.userId }
    }),

  fundraiserGallery: f({ image: { maxFileSize: '8MB', maxFileCount: 10 } })
    .middleware(async () => {
      const session = await getServerSession(authOptions)
      if (!session?.user || (session.user as any).role !== 'FUNDRAISER') {
        throw new Error('Unauthorized - fundraiser account required')
      }
      const account = await prisma.fundraiserAccount.findUnique({
        where: { userId: (session.user as any).id as string },
        select: { status: true },
      })
      if (!account || account.status !== 'APPROVED') {
        throw new Error('Unauthorized: account not approved')
      }
      return { userId: (session.user as any).id as string }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { url: file.url, uploadedBy: metadata.userId }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
