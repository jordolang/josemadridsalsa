import { PrismaAdapter } from '@auth/prisma-adapter'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import GitHubProvider from 'next-auth/providers/github'
import FacebookProvider from 'next-auth/providers/facebook'
import AppleProvider from 'next-auth/providers/apple'
import type { NextAuthOptions } from 'next-auth'
import bcrypt from 'bcryptjs'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter'
import { DEVELOPER_ACCOUNT_EMAIL } from '@/lib/developer/constants'

/** Cached Prisma client instance for lazy loading */
let prismaClient: any = null

/**
 * Lazily load and cache the Prisma client for authentication operations.
 *
 * Defers Prisma import to runtime to handle initialization errors gracefully
 * and avoid module-load-time crashes when the database is unavailable.
 *
 * @returns The Prisma client instance
 * @throws {Error} If the database connection fails
 */
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

/**
 * NextAuth.js configuration options.
 *
 * Uses JWT-based sessions (no database adapter at module load time to prevent
 * crashes). Provides credentials-based authentication with bcrypt password
 * verification. JWT callbacks enrich tokens with user role and fundraiser
 * account data for authorization checks throughout the application.
 */
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
  debug: process.env.NODE_ENV === 'development', // Enable debug in development only
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
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    }),
    AppleProvider({
      clientId: process.env.APPLE_CLIENT_ID!,
      clientSecret: process.env.APPLE_CLIENT_SECRET!,
    }),
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

          // Normalize email to lowercase for case-insensitive matching (matches registration flow)
          const normalizedEmail = credentials.email.toLowerCase().trim()
          console.log('[Auth] Attempting login for:', normalizedEmail)

          // Rate limiting: 5 login attempts per 15 minutes per email
          const rateLimitResult = await checkRateLimit({
            identifier: `auth:login:${normalizedEmail}`,
            maxRequests: RATE_LIMITS.AUTH_LOGIN.maxRequests,
            windowSeconds: RATE_LIMITS.AUTH_LOGIN.windowSeconds,
          })

          if (!rateLimitResult.allowed) {
            console.error('[Auth] Rate limit exceeded for:', normalizedEmail, `- ${rateLimitResult.remaining} attempts remaining, resets in ${rateLimitResult.resetIn}s`)
            return null
          }

          const prisma = await getPrisma()
          const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              password: true,
            }
          })

          if (!user) {
            console.error('[Auth] User not found:', normalizedEmail)
            return null
          }

          if (!user.password) {
            console.error('[Auth] User has no password set:', normalizedEmail)
            return null
          }

          const isValid = await bcrypt.compare(credentials.password, user.password)
          if (!isValid) {
            console.error('[Auth] Invalid password for:', normalizedEmail)
            return null
          }

          console.log('[Auth] Login successful for:', normalizedEmail)
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
    async jwt({ token, user, account, trigger }) {
      try {
        console.log('[JWT Callback] Trigger:', trigger || 'initial')

        // Handle OAuth sign-in (Google, GitHub, Facebook, Apple) — upsert user in DB
        const oauthProviders = ['google', 'github', 'facebook', 'apple']
        if (account?.provider && oauthProviders.includes(account.provider) && token.email) {
          try {
            const prisma = await getPrisma()
            const normalizedEmail = (token.email as string).toLowerCase().trim()
            let dbUser = await prisma.user.findUnique({
              where: { email: normalizedEmail },
              select: { id: true, role: true, name: true },
            })
            if (!dbUser) {
              dbUser = await prisma.user.create({
                data: {
                  email: normalizedEmail,
                  name: token.name as string ?? null,
                  isEmailVerified: true,
                  role: 'CUSTOMER',
                },
                select: { id: true, role: true, name: true },
              })
              console.log(`[JWT Callback] Created new user via ${account.provider} OAuth:`, normalizedEmail)
            }
            token.id = dbUser.id
            token.role = dbUser.role
            // Store profile picture from token if available
            if (token.picture) {
              token.avatar = typeof token.picture === 'string'
                ? token.picture
                : (token.picture as any)?.data?.url ?? null
            }
          } catch (oauthError) {
            console.error(`[JWT Callback] ${account.provider} OAuth DB error:`, oauthError)
          }
        }

        // On sign in via credentials, add user data to token
        if (user && !token.id) {
          console.log('[JWT Callback] Sign in - User:', user.email, 'Role:', (user as any).role)
          token.id = (user as any).id
          token.role = (user as any).role
        }

        // For fundraiser users, store their fundraiserId in the token
        if (token.id && (token.role === 'FUNDRAISER') && !token.fundraiserId) {
          try {
            const prisma = await getPrisma()
            const fundraiserAccount = await prisma.fundraiserAccount.findUnique({
              where: { userId: token.id as string },
              select: { fundraiserId: true },
            })
            if (fundraiserAccount) {
              token.fundraiserId = fundraiserAccount.fundraiserId
            }
          } catch (faError) {
            console.error('[JWT Callback] Error fetching fundraiser account:', faError)
          }
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

        // The designated developer account is always the DEVELOPER (super admin) role.
        // Promote it in the database and token if it ever holds a different role.
        if (
          typeof token.email === 'string' &&
          token.email.toLowerCase().trim() === DEVELOPER_ACCOUNT_EMAIL &&
          token.role !== 'DEVELOPER'
        ) {
          try {
            const prisma = await getPrisma()
            const promoted = await prisma.user.update({
              where: { email: DEVELOPER_ACCOUNT_EMAIL },
              data: { role: 'DEVELOPER' },
              select: { id: true, role: true },
            })
            token.id = promoted.id
            token.role = promoted.role
            console.log('[JWT Callback] Promoted developer account to DEVELOPER role')
          } catch (promoteError) {
            console.error('[JWT Callback] Developer account promotion error:', promoteError)
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
          if (token.fundraiserId) {
            ;(session.user as any).fundraiserId = token.fundraiserId as string
          }
          // Include avatar from Google profile if available
          if (token.avatar) {
            ;(session.user as any).image = token.avatar as string
          }
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
