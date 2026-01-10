import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Cron secret for Vercel Cron Jobs
// Set CRON_SECRET in your environment variables
const CRON_SECRET = process.env.CRON_SECRET

/**
 * Vercel Cron Job - Dashboard Analysis
 * Runs every 5 hours to analyze project status and generate metrics
 * Schedule: 0 */5 * * * (00:00, 05:00, 10:00, 15:00, 20:00)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const startTime = Date.now()
    const results = {
      analysisSuccess: false,
      autoExecuteSuccess: false,
      errors: [] as string[],
      duration: 0,
    }

    console.log('🔄 Starting dashboard analysis cron job...')

    // Step 1: Run project analysis
    try {
      console.log('📊 Running project analysis...')
      const { stdout: analysisOutput, stderr: analysisError } = await execAsync(
        'npm run analyze',
        {
          timeout: 300000, // 5 minute timeout
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        }
      )

      if (analysisError) {
        console.warn('⚠️ Analysis stderr:', analysisError)
      }

      console.log('✅ Project analysis completed')
      results.analysisSuccess = true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Project analysis failed:', errorMessage)
      results.errors.push(`Analysis failed: ${errorMessage}`)
    }

    // Step 2: Run autonomous execution (only if analysis succeeded)
    if (results.analysisSuccess) {
      try {
        console.log('🤖 Running autonomous execution...')
        const { stdout: executeOutput, stderr: executeError } = await execAsync(
          'npm run auto-execute',
          {
            timeout: 300000, // 5 minute timeout
            maxBuffer: 10 * 1024 * 1024 // 10MB buffer
          }
        )

        if (executeError) {
          console.warn('⚠️ Auto-execute stderr:', executeError)
        }

        console.log('✅ Autonomous execution completed')
        results.autoExecuteSuccess = true
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('❌ Autonomous execution failed:', errorMessage)
        results.errors.push(`Auto-execute failed: ${errorMessage}`)
      }
    }

    results.duration = Date.now() - startTime

    console.log(`✅ Dashboard analysis cron completed in ${results.duration}ms`)

    return NextResponse.json({
      success: results.analysisSuccess,
      timestamp: new Date().toISOString(),
      ...results,
    })
  } catch (error) {
    console.error('Dashboard analysis cron job error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
