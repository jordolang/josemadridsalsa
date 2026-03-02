#!/usr/bin/env tsx

/**
 * Validation script for .project-analysis/current.json
 * Ensures the output structure matches the ProjectAnalysis type
 */

import fs from 'fs'
import path from 'path'
import type { ProjectAnalysis } from '../lib/project-analyzer/types'

const ANALYSIS_FILE = path.join(process.cwd(), '.project-analysis/current.json')

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

function validateProjectAnalysis(data: any): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Check top-level required fields
  const requiredFields = [
    'version',
    'timestamp',
    'runNumber',
    'overallCompletion',
    'metrics',
    'technicalDebt',
    'codeQuality',
    'suggestions',
    'workSession',
  ]

  for (const field of requiredFields) {
    if (!(field in data)) {
      errors.push(`Missing required field: ${field}`)
    } else if (data[field] === null && field !== 'workSession') {
      // workSession can be null when project is complete
      errors.push(`Required field is null: ${field}`)
    }
  }

  // Validate field types
  if (typeof data.version !== 'string') {
    errors.push(`version must be a string, got ${typeof data.version}`)
  }

  if (typeof data.timestamp !== 'string') {
    errors.push(`timestamp must be a string, got ${typeof data.timestamp}`)
  }

  if (typeof data.runNumber !== 'number') {
    errors.push(`runNumber must be a number, got ${typeof data.runNumber}`)
  }

  if (typeof data.overallCompletion !== 'number') {
    errors.push(`overallCompletion must be a number, got ${typeof data.overallCompletion}`)
  }

  // Validate metrics structure
  if (data.metrics) {
    if (!data.metrics.frontend) {
      errors.push('metrics.frontend is missing')
    }
    if (!data.metrics.backend) {
      errors.push('metrics.backend is missing')
    }
    if (!data.metrics.database) {
      errors.push('metrics.database is missing')
    }
    if (!data.metrics.packages) {
      errors.push('metrics.packages is missing')
    }
  }

  // Validate technicalDebt structure
  if (data.technicalDebt) {
    if (typeof data.technicalDebt.totalScore !== 'number') {
      errors.push('technicalDebt.totalScore must be a number')
    }
    const debtFields = ['todos', 'consoleLogs', 'anyTypes', 'hardcodedSecrets', 'commentedCode']
    for (const field of debtFields) {
      if (!Array.isArray(data.technicalDebt[field])) {
        errors.push(`technicalDebt.${field} must be an array`)
      }
    }
  }

  // Validate codeQuality structure
  if (data.codeQuality) {
    if (typeof data.codeQuality.typeScriptStrict !== 'boolean') {
      warnings.push('codeQuality.typeScriptStrict should be a boolean')
    }
    if (typeof data.codeQuality.eslintErrors !== 'number') {
      warnings.push('codeQuality.eslintErrors should be a number')
    }
    if (typeof data.codeQuality.eslintWarnings !== 'number') {
      warnings.push('codeQuality.eslintWarnings should be a number')
    }
  }

  // Validate suggestions structure
  if (data.suggestions) {
    const suggestionLevels = ['critical', 'recommended', 'niceToHave', 'future']
    for (const level of suggestionLevels) {
      if (!Array.isArray(data.suggestions[level])) {
        errors.push(`suggestions.${level} must be an array`)
      }
    }
  }

  // Validate workSession structure (if present)
  if (data.workSession !== null) {
    if (!data.workSession.sessionNumber) {
      errors.push('workSession.sessionNumber is missing')
    }
    if (!data.workSession.tasks) {
      errors.push('workSession.tasks is missing')
    } else if (!Array.isArray(data.workSession.tasks)) {
      errors.push('workSession.tasks must be an array')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

async function main() {
  console.log('🔍 Validating .project-analysis/current.json structure...\n')

  // Check if file exists
  if (!fs.existsSync(ANALYSIS_FILE)) {
    console.error('❌ Error: current.json not found at', ANALYSIS_FILE)
    process.exit(1)
  }

  // Read and parse JSON
  let data: any
  try {
    const content = fs.readFileSync(ANALYSIS_FILE, 'utf-8')
    data = JSON.parse(content)
  } catch (error) {
    console.error('❌ Error: Failed to parse current.json as valid JSON')
    console.error(error)
    process.exit(1)
  }

  // Validate structure
  const result = validateProjectAnalysis(data)

  // Report results
  console.log('📊 Validation Results:')
  console.log('─'.repeat(50))

  if (result.errors.length > 0) {
    console.log('\n❌ Errors:')
    result.errors.forEach((error) => console.log(`  - ${error}`))
  }

  if (result.warnings.length > 0) {
    console.log('\n⚠️  Warnings:')
    result.warnings.forEach((warning) => console.log(`  - ${warning}`))
  }

  if (result.valid) {
    console.log('\n✅ Structure validation passed!')
    console.log('\n📋 Summary:')
    console.log(`  Version: ${data.version}`)
    console.log(`  Run Number: ${data.runNumber}`)
    console.log(`  Timestamp: ${data.timestamp}`)
    console.log(`  Overall Completion: ${data.overallCompletion}%`)
    console.log(`  Work Session: ${data.workSession ? `Session ${data.workSession.sessionNumber}` : 'null (project complete)'}`)
    process.exit(0)
  } else {
    console.log('\n❌ Structure validation failed!')
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
