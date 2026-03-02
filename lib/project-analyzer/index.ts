/**
 * Project Analyzer - Public API
 * José Madrid Salsa E-commerce Platform
 */

import * as fs from 'fs'
import * as path from 'path'
import type { ProjectAnalysis } from './types'

const ANALYSIS_DIR = path.join(process.cwd(), '.project-analysis')
const CURRENT_FILE = path.join(ANALYSIS_DIR, 'current.json')

/**
 * Get the latest analysis data
 */
export function getLatestAnalysis(): ProjectAnalysis | null {
  try {
    if (!fs.existsSync(CURRENT_FILE)) {
      return null
    }

    const data = fs.readFileSync(CURRENT_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Error loading analysis:', error)
    return null
  }
}

/**
 * Get analysis history
 */
export function getAnalysisHistory(): ProjectAnalysis[] {
  try {
    const historyDir = path.join(ANALYSIS_DIR, 'history')

    if (!fs.existsSync(historyDir)) {
      return []
    }

    const files = fs.readdirSync(historyDir)
    const analyses = files
      .filter((file) => file.endsWith('.json'))
      .map((file) => {
        const data = fs.readFileSync(path.join(historyDir, file), 'utf-8')
        return JSON.parse(data) as ProjectAnalysis
      })
      .sort((a, b) => b.runNumber - a.runNumber)

    return analyses
  } catch (error) {
    console.error('Error loading history:', error)
    return []
  }
}
