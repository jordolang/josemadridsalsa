import { PrismaAdapter } from '@auth/prisma-adapter'
import CredentialsProvider from 'next-auth/providers/credentials'
import type { NextAuthOptions } from 'next-auth'
import bcrypt from 'bcryptjs'

// Lazy load Prisma to handle initialization errors gracefully
let prismaClient: any = null
async function getPrisma() {
  if (!prismaClient) {
    try {
      const { prisma } = await import('@/lib/prisma')
      prismaClient = prisma
      console.log('[Auth] Prisma client loaded successfully')
    } catch (error) {
      console.error('[Auth] Failed to load Prisma client:', error)
      throw new Error('Database connection failed')
    }
  }
  return prismaClient
}

// Validate NEXTAUTH_SECRET
if (!process.env.NEXTAUTH_SECRET) {
  console.error('[Auth] CRITICAL: NEXTAUTH_SECRET is not set in environment variables')
  if (process.env.NODE_ENV === 'development') {
    throw new Error('NEXTAUTH_SECRET is required in development')
  }
  // In production, this will cause auth to fail - but we'll handle it gracefully
}

// Log the NEXTAUTH_URL configuration (without exposing secrets)
if (process.env.NEXTAUTH_URL) {
  console.log('[Auth] NEXTAUTH_URL configured:', process.env.NEXTAUTH_URL)
} else {
  console.log('[Auth] NEXTAUTH_URL not set - will be auto-detected')
}

// Don't initialize adapter at module load time - it will cause crashes
// NextAuth will work fine with JWT strategy without an adapter
export const authOptions: NextAuthOptions = {
  adapter: undefined,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  // Trust the proxy/host in production (required for Vercel and other hosting platforms)
  useSecureCookies: process.env.NODE_ENV === 'production',
  debug: false, // Disable debug to prevent /api/auth/_log 405 errors
  logger: {
    error(code, metadata) {
      console.error('[NextAuth Error]', code, metadata)
    },
    warn(code) {
      console.warn('[NextAuth Warn]', code)
    },
    debug(code, metadata) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[NextAuth Debug]', code, metadata)
      }
    },
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        try {
          if (!credentials?.email || !credentials?.password) {
            console.error('[Auth] Missing credentials')
            return null
          }

          console.log('[Auth] Attempting login for:', credentials.email)

          const prisma = await getPrisma()
          const user = await prisma.user.findUnique({ where: { email: credentials.email } })
          if (!user) {
            console.error('[Auth] User not found:', credentials.email)
            return null
          }

          if (!user.password) {
            console.error('[Auth] User has no password set:', credentials.email)
            return null
          }

          const isValid = await bcrypt.compare(credentials.password, user.password)
          if (!isValid) {
            console.error('[Auth] Invalid password for:', credentials.email)
            return null
          }

          console.log('[Auth] Login successful for:', credentials.email)
          return {
            id: user.id,
            email: user.email,
            name: user.name ?? undefined,
            role: user.role,
          } as any
        } catch (error) {
          console.error('[Auth] Authentication error:', error)
          if (error instanceof Error) {
            console.error('[Auth] Error details:', error.message, error.stack)
          }
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      try {
        console.log('[JWT Callback] Trigger:', trigger || 'initial')
        
        // On sign in, add user data to token
        if (user) {
          console.log('[JWT Callback] Sign in - User:', user.email, 'Role:', (user as any).role)
          token.id = (user as any).id
          token.role = (user as any).role
        }

        // Only fetch from DB if token is missing critical data and we have an email
        // This should rarely happen since user object should have role on sign in
        if (!token.role && token.email) {
          console.log('[JWT Callback] No role in token, fetching from DB for:', token.email)
          try {
            const prisma = await getPrisma()
            const dbUser = await prisma.user.findUnique({
              where: { email: token.email as string },
              select: { id: true, role: true },
            })
            if (dbUser) {
              console.log('[JWT Callback] Fetched role from DB:', dbUser.role)
              token.id = dbUser.id
              token.role = dbUser.role
            }
          } catch (dbError) {
            console.error('[JWT Callback] Database error:', dbError)
            // Continue with existing token data
          }
        }

        console.log('[JWT Callback] Returning token with role:', token.role)
        return token
      } catch (error) {
        console.error('[JWT Callback] Unexpected error:', error)
        return token
      }
    },
    async session({ session, token }) {
      try {
        console.log('[Session Callback] Token role:', token.role)
        if (session.user) {
          ;(session.user as any).id = token.id as string
          ;(session.user as any).role = token.role as string
          console.log('[Session Callback] Session user role:', (session.user as any).role)
        }
        return session
      } catch (error) {
        console.error('[Session Callback] Error:', error)
        return session
      }
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}
