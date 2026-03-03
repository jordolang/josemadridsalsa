/**
 * Project Status API - Serves project analysis data
 * José Madrid Salsa E-commerce Platform
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import * as fs from 'fs'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const ANALYSIS_FILE = path.join(process.cwd(), '.project-analysis', 'current.json')

/**
 * GET /api/admin/project-status
 * Returns the latest project analysis
 */
export async function GET(req: NextRequest) {
  try {
    // Check authentication and permissions
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'analytics:read'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if analysis file exists
    if (!fs.existsSync(ANALYSIS_FILE)) {
      return NextResponse.json(
        {
          error: 'No analysis data found',
          message: 'Run `npm run analyze` to generate project analysis',
        },
        { status: 404 }
      )
    }

    // Read and return analysis
    const analysisData = fs.readFileSync(ANALYSIS_FILE, 'utf-8')
    const analysis = JSON.parse(analysisData)

    return NextResponse.json(analysis)
  } catch (error: any) {
    console.error('Error fetching project status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch project status', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/project-status
 * Triggers a new analysis (runs in background)
 */
export async function POST(req: NextRequest) {
  try {
    // Check authentication and permissions
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'analytics:export'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Run analyzer in background (don't wait for it)
    execAsync('npm run analyze')
      .then(() => {
        console.log('✅ Project analysis completed')
      })
      .catch((error) => {
        console.error('❌ Project analysis failed:', error)
      })

    return NextResponse.json({
      success: true,
      message: 'Analysis started in background',
    })
  } catch (error: any) {
    console.error('Error triggering analysis:', error)
    return NextResponse.json(
      { error: 'Failed to trigger analysis', details: error.message },
      { status: 500 }
    )
  }
}
