import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

const handler = NextAuth(authOptions)

// Wrap the handler with error handling to ensure we always return JSON
async function handlerWithErrorHandling(req: NextRequest, context: any) {
  try {
    return await handler(req, context)
  } catch (error) {
    console.error('[NextAuth Route] Error:', error)

    // Return a proper JSON error response instead of HTML
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export { handlerWithErrorHandling as GET, handlerWithErrorHandling as POST }
