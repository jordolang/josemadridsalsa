#!/usr/bin/env tsx
/**
 * Project Analyzer - Main orchestrator script
 * José Madrid Salsa E-commerce Platform
 *
 * Analyzes the entire codebase and generates:
 * - Completion metrics (frontend, backend, database)
 * - Technical debt report
 * - Feature suggestions
 * - 5-hour Claude Code work sessions
 *
 * Usage:
 *   npm run analyze
 *   npm run analyze -- --export markdown
 *   npm run analyze -- --watch
 */

import * as fs from 'fs'
import * as path from 'path'
import { FileScanner } from './lib/scanners/file-scanner'
import { FrontendAnalyzer } from './lib/analyzers/frontend-analyzer'
import { BackendAnalyzer } from './lib/analyzers/backend-analyzer'
import { DatabaseAnalyzer } from './lib/analyzers/database-analyzer'
import { TechnicalDebtScanner } from './lib/analyzers/technical-debt-scanner'
import { FeatureSuggester } from './lib/analyzers/feature-suggester'
import { WorkSessionGenerator } from './lib/generators/work-session-generator'
import type { ProjectAnalysis } from '../lib/project-analyzer/types'

// Configuration
const PROJECT_ROOT = process.cwd()
const OUTPUT_DIR = path.join(PROJECT_ROOT, '.project-analysis')
const CURRENT_FILE = path.join(OUTPUT_DIR, 'current.json')
const HISTORY_DIR = path.join(OUTPUT_DIR, 'history')

// Parse command line arguments
const args = process.argv.slice(2)
const shouldWatch = args.includes('--watch')
const exportFormat = args.find((arg) => arg.startsWith('--export'))?.split('=')[1] || null

async function main() {
  console.log('🚀 José Madrid Salsa - Project Analyzer\n')
  console.log(`📁 Project Root: ${PROJECT_ROOT}`)
  console.log(`📊 Output Dir: ${OUTPUT_DIR}\n`)

  // Ensure output directories exist
  ensureOutputDirectories()

  // Run analysis
  const analysis = await runAnalysis()

  // Save results
  saveAnalysis(analysis)

  // Export if requested
  if (exportFormat) {
    exportAnalysis(analysis, exportFormat)
  }

  // Print summary
  printSummary(analysis)

  // Watch mode
  if (shouldWatch) {
    console.log('\n👀 Watching for changes... (Press Ctrl+C to stop)')
    watchForChanges()
  }
}

async function runAnalysis(): Promise<ProjectAnalysis> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('PHASE 1: FILE SCANNING')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const scanner = new FileScanner(PROJECT_ROOT)
  const files = await scanner.scan()

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('PHASE 2: ANALYZING METRICS')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // Run analyzers in parallel for performance
  const [frontendMetrics, backendMetrics, databaseMetrics] = await Promise.all([
    new FrontendAnalyzer(files.pages).analyze(),
    new BackendAnalyzer(files.apiRoutes).analyze(),
    new DatabaseAnalyzer(files.prismaSchema).analyze(),
  ])

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('PHASE 3: SCANNING TECHNICAL DEBT')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const allFiles = [
    ...files.pages,
    ...files.apiRoutes,
    ...files.components,
    ...files.utilities,
  ]
  const technicalDebt = await new TechnicalDebtScanner(allFiles).scan()

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('PHASE 4: GENERATING SUGGESTIONS')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const suggestions = await new FeatureSuggester(
    frontendMetrics,
    backendMetrics,
    technicalDebt
  ).suggest()

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('PHASE 5: GENERATING WORK SESSION')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const runNumber = getNextRunNumber()
  const workSession = new WorkSessionGenerator(
    runNumber,
    suggestions,
    technicalDebt,
    frontendMetrics,
    backendMetrics
  ).generate()

  // Calculate overall completion
  const overallCompletion = Math.round(
    (frontendMetrics.completion +
      backendMetrics.completion +
      databaseMetrics.completion) /
      3
  )

  // Code quality metrics (simplified for now)
  const codeQuality = {
    typeScriptStrict: true, // Assume true, can be verified by reading tsconfig.json
    eslintErrors: 0, // Would need to run ESLint
    eslintWarnings: 0,
    testCoverage: 0, // Would need to run tests
    averageComplexity: 0,
  }

  const analysis: ProjectAnalysis = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    runNumber,
    overallCompletion,
    metrics: {
      frontend: frontendMetrics,
      backend: backendMetrics,
      database: databaseMetrics,
      packages: {
        totalPackages: 0,
        outdatedCount: 0,
        vulnerabilityCount: 0,
        outdated: [],
        vulnerabilities: [],
      },
    },
    technicalDebt,
    codeQuality,
    suggestions,
    workSession,
  }

  return analysis
}

function ensureOutputDirectories() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true })
  }
}

function getNextRunNumber(): number {
  if (!fs.existsSync(CURRENT_FILE)) {
    return 1
  }

  try {
    const current = JSON.parse(fs.readFileSync(CURRENT_FILE, 'utf-8'))
    return (current.runNumber || 0) + 1
  } catch {
    return 1
  }
}

function saveAnalysis(analysis: ProjectAnalysis) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('SAVING RESULTS')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // Save current analysis
  fs.writeFileSync(CURRENT_FILE, JSON.stringify(analysis, null, 2))
  console.log(`✅ Saved current analysis: ${CURRENT_FILE}`)

  // Save to history
  const date = new Date().toISOString().split('T')[0]
  const historyFile = path.join(HISTORY_DIR, `${date}-run-${analysis.runNumber}.json`)
  fs.writeFileSync(historyFile, JSON.stringify(analysis, null, 2))
  console.log(`✅ Saved to history: ${historyFile}`)

  // Save work session separately for easy access
  if (analysis.workSession) {
    const sessionFile = path.join(OUTPUT_DIR, `session-${analysis.runNumber}.json`)
    fs.writeFileSync(sessionFile, JSON.stringify(analysis.workSession, null, 2))
    console.log(`✅ Saved work session: ${sessionFile}`)
  }
}

function exportAnalysis(analysis: ProjectAnalysis, format: string) {
  console.log(`\n📤 Exporting as ${format}...`)

  const exportFile = path.join(OUTPUT_DIR, `analysis-${analysis.runNumber}.${format}`)

  switch (format) {
    case 'markdown':
    case 'md':
      const markdown = generateMarkdownReport(analysis)
      fs.writeFileSync(exportFile, markdown)
      console.log(`✅ Markdown report: ${exportFile}`)
      break

    case 'json':
      fs.writeFileSync(exportFile, JSON.stringify(analysis, null, 2))
      console.log(`✅ JSON export: ${exportFile}`)
      break

    default:
      console.log(`⚠️  Unknown export format: ${format}`)
  }
}

function generateMarkdownReport(analysis: ProjectAnalysis): string {
  const { metrics, technicalDebt, suggestions, workSession, overallCompletion } = analysis

  let md = `# José Madrid Salsa - Project Status Report

**Generated:** ${new Date(analysis.timestamp).toLocaleString()}
**Run Number:** ${analysis.runNumber}
**Overall Completion:** ${overallCompletion}%

---

## 📊 Metrics Summary

### Frontend
- **Completion:** ${metrics.frontend.completion}%
- **Pages:** ${metrics.frontend.pagesComplete}/${metrics.frontend.pagesTotal} complete
- **TypeScript Coverage:** ${metrics.frontend.typeScriptCoverage}%

### Backend
- **Completion:** ${metrics.backend.completion}%
- **API Routes:** ${metrics.backend.apiRoutesComplete}/${metrics.backend.apiRoutesTotal} complete
- **Auth Coverage:** ${metrics.backend.authCoverage}%
- **Validation Coverage:** ${metrics.backend.validationCoverage}%

### Database
- **Completion:** ${metrics.database.completion}%
- **Models:** ${metrics.database.modelsCount}
- **Relationships:** ${metrics.database.relationshipsCount}
- **Index Coverage:** ${metrics.database.indexCoverage}%

---

## 🔍 Technical Debt

**Debt Score:** ${technicalDebt.totalScore}/100 (lower is better)

- ⚠️  TODOs: ${technicalDebt.todos.length}
- 🐛 Console.logs: ${technicalDebt.consoleLogs.length}
- ❓ Any types: ${technicalDebt.anyTypes.length}
- 🔒 Potential secrets: ${technicalDebt.hardcodedSecrets.length}
- 💬 Commented code: ${technicalDebt.commentedCode.length}

---

## 💡 Feature Suggestions

### Critical (${suggestions.critical.length})
${suggestions.critical.map((s) => `- **${s.title}** (${s.estimatedHours}h) - ${s.description}`).join('\n')}

### Recommended (${suggestions.recommended.length})
${suggestions.recommended.map((s) => `- **${s.title}** (${s.estimatedHours}h) - ${s.description}`).join('\n')}

### Nice-to-Have (${suggestions.niceToHave.length})
${suggestions.niceToHave.map((s) => `- **${s.title}** (${s.estimatedHours}h) - ${s.description}`).join('\n')}

---

## 📋 Work Session #${analysis.runNumber}

${workSession ? `
**Focus:** ${workSession.focus}
**Priority:** ${workSession.priority}
**Estimated Time:** ${workSession.estimatedHours} hours
**Tasks:** ${workSession.tasks.length}

### Tasks

${workSession.tasks.map((task) => `
#### Task ${task.taskNumber}: ${task.title}
- **Priority:** ${task.priority}
- **Estimated:** ${task.estimatedHours}h
- **Files:** ${task.files.join(', ')}

${task.instructions}
`).join('\n')}
` : 'No tasks - project is complete! 🎉'}

---

Generated with [José Madrid Salsa Project Analyzer](https://github.com/josemadridsalsa)
`

  return md
}

function printSummary(analysis: ProjectAnalysis) {
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 ANALYSIS COMPLETE')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  console.log(`🎯 Overall Completion: ${analysis.overallCompletion}%`)
  console.log(`📱 Frontend: ${analysis.metrics.frontend.completion}%`)
  console.log(`⚙️  Backend: ${analysis.metrics.backend.completion}%`)
  console.log(`🗄️  Database: ${analysis.metrics.database.completion}%`)
  console.log(`🔍 Technical Debt Score: ${analysis.technicalDebt.totalScore}/100`)
  console.log(`💡 Feature Suggestions: ${analysis.suggestions.critical.length} critical, ${analysis.suggestions.recommended.length} recommended`)

  if (analysis.workSession) {
    console.log(`\n📋 Next Work Session:`)
    console.log(`   Focus: ${analysis.workSession.focus}`)
    console.log(`   Tasks: ${analysis.workSession.tasks.length}`)
    console.log(`   Estimated: ${analysis.workSession.estimatedHours} hours`)
  }

  console.log(`\n✅ Results saved to: ${OUTPUT_DIR}`)
  console.log(`\n💻 View dashboard: http://localhost:3000/admin/project-status`)
}

function watchForChanges() {
  fs.watch(PROJECT_ROOT, { recursive: true }, async (eventType, filename) => {
    if (
      filename &&
      (filename.endsWith('.ts') ||
        filename.endsWith('.tsx') ||
        filename.endsWith('.js') ||
        filename.endsWith('.jsx')) &&
      !filename.includes('node_modules') &&
      !filename.includes('.next')
    ) {
      console.log(`\n📝 Change detected: ${filename}`)
      console.log('⏳ Re-running analysis...\n')

      const analysis = await runAnalysis()
      saveAnalysis(analysis)
      printSummary(analysis)
    }
  })
}

// Run the analyzer
main().catch((error) => {
  console.error('\n❌ Error running analyzer:', error)
  process.exit(1)
})
