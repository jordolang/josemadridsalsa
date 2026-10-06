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

  adminFundraiserLogo: f({ image: { maxFileSize: '4MB', maxFileCount: 1 } })
    .middleware(async () => {
      const session = await getServerSession(authOptions)
      const role = (session?.user as { role?: string } | undefined)?.role
      if (!session?.user || !role || !['ADMIN', 'DEVELOPER', 'STAFF'].includes(role)) {
        throw new Error('Unauthorized - admin required')
      }
      return { userId: (session.user as any).id as string }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { url: file.url, uploadedBy: metadata.userId }
    }),

  adminFundraiserCoverPhoto: f({ image: { maxFileSize: '8MB', maxFileCount: 1 } })
    .middleware(async () => {
      const session = await getServerSession(authOptions)
      const role = (session?.user as { role?: string } | undefined)?.role
      if (!session?.user || !role || !['ADMIN', 'DEVELOPER', 'STAFF'].includes(role)) {
        throw new Error('Unauthorized - admin required')
      }
      return { userId: (session.user as any).id as string }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { url: file.url, uploadedBy: metadata.userId }
    }),

  /**
   * Photographed paper forms on their way to the ledger.
   *
   * 12MB and up to 10 at a time: a phone photo of a full show settlement sheet is large, and a
   * driver coming home from a weekend usually has a stack of them.
   */
  formCapture: f({ image: { maxFileSize: '16MB', maxFileCount: 10 } })
    .middleware(async () => {
      const session = await getServerSession(authOptions)
      const role = (session?.user as any)?.role
      if (!session?.user || !['ADMIN', 'DEVELOPER', 'STAFF'].includes(role)) {
        throw new Error('Unauthorized - staff account required')
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
