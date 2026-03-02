import NextAuth from "next-auth"
import { NextRequest, NextResponse } from "next/server"

// Lazy load authOptions to handle environment issues gracefully
async function getAuthOptions() {
  try {
    const { authOptions } = await import("@/lib/auth")
    return authOptions
  } catch (error) {
    console.error('[NextAuth Route] Failed to load auth options:', error)
    throw error
  }
}

// Wrap the handler with error handling to ensure we always return JSON
async function handlerWithErrorHandling(req: NextRequest, context: any) {
  try {
    // Check if required environment variables are set
    if (!process.env.NEXTAUTH_SECRET) {
      console.error('[NextAuth Route] NEXTAUTH_SECRET is not set')
      return NextResponse.json(
        { error: 'Authentication service not configured' },
        { status: 503 }
      )
    }

    const authOptions = await getAuthOptions()
    const handler = NextAuth(authOptions)
    return await handler(req, context)
  } catch (error) {
    console.error('[NextAuth Route] Error:', error)

    // Log the error details for debugging
    if (error instanceof Error) {
      console.error('[NextAuth Route] Error message:', error.message)
      console.error('[NextAuth Route] Error stack:', error.stack)
    }

    // Return a proper JSON error response instead of HTML
    return NextResponse.json(
      {
        error: 'Authentication service error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export { handlerWithErrorHandling as GET, handlerWithErrorHandling as POST }
