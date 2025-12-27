/**
 * Technical Debt Scanner - Identifies code quality issues
 * José Madrid Salsa E-commerce Platform
 */

import { FileScanner } from '../scanners/file-scanner'
import type { TechnicalDebt, DebtItem } from '../../../lib/project-analyzer/types'

export class TechnicalDebtScanner {
  private allFiles: string[]

  constructor(allFiles: string[]) {
    this.allFiles = allFiles
  }

  /**
   * Scan for technical debt across codebase
   */
  async scan(): Promise<TechnicalDebt> {
    console.log('🔍 Scanning for technical debt...')

    const [todos, consoleLogs, anyTypes, hardcodedSecrets, commentedCode] = await Promise.all([
      this.findTODOs(),
      this.findConsoleLogs(),
      this.findAnyTypes(),
      this.findHardcodedSecrets(),
      this.findCommentedCode(),
    ])

    // Calculate debt score (0-100, lower is better)
    const debtScore = this.calculateDebtScore(
      todos.length,
      consoleLogs.length,
      anyTypes.length,
      hardcodedSecrets.length,
      commentedCode.length
    )

    console.log(`  📊 Technical Debt Score: ${debtScore}/100 (lower is better)
  ⚠️  TODOs: ${todos.length}
  🐛 Console.logs: ${consoleLogs.length}
  ❓ Any types: ${anyTypes.length}
  🔒 Potential secrets: ${hardcodedSecrets.length}
  💬 Commented code blocks: ${commentedCode.length}
`)

    return {
      totalScore: debtScore,
      todos,
      consoleLogs,
      anyTypes,
      hardcodedSecrets,
      commentedCode,
    }
  }

  /**
   * Find TODO/FIXME comments
   */
  private findTODOs(): DebtItem[] {
    const items: DebtItem[] = []
    const todoPattern = /\/\/\s*(TODO|FIXME|HACK|XXX|NOTE):\s*(.+)/gi

    for (const filePath of this.allFiles) {
      const content = FileScanner.readFile(filePath)
      const lines = content.split('\n')
      const relativePath = filePath.replace(process.cwd() + '/', '')

      lines.forEach((line, index) => {
        const match = todoPattern.exec(line)
        if (match) {
          items.push({
            file: relativePath,
            line: index + 1,
            text: match[0].trim(),
            context: line.trim(),
          })
        }
        todoPattern.lastIndex = 0 // Reset regex
      })
    }

    return items
  }

  /**
   * Find console.log statements
   */
  private findConsoleLogs(): DebtItem[] {
    const items: DebtItem[] = []
    const consolePattern = /console\.(log|warn|error|debug|info)\(/g

    for (const filePath of this.allFiles) {
      // Skip test files and build files
      if (filePath.includes('.test.') || filePath.includes('.spec.') || filePath.includes('.next')) {
        continue
      }

      const content = FileScanner.readFile(filePath)
      const lines = content.split('\n')
      const relativePath = filePath.replace(process.cwd() + '/', '')

      lines.forEach((line, index) => {
        if (consolePattern.test(line)) {
          items.push({
            file: relativePath,
            line: index + 1,
            context: line.trim(),
          })
        }
        consolePattern.lastIndex = 0
      })
    }

    return items
  }

  /**
   * Find TypeScript 'any' types
   */
  private findAnyTypes(): DebtItem[] {
    const items: DebtItem[] = []
    const anyPattern = /:\s*any\b/g

    for (const filePath of this.allFiles) {
      // Only check TypeScript files
      if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) {
        continue
      }

      const content = FileScanner.readFile(filePath)
      const lines = content.split('\n')
      const relativePath = filePath.replace(process.cwd() + '/', '')

      lines.forEach((line, index) => {
        if (anyPattern.test(line)) {
          items.push({
            file: relativePath,
            line: index + 1,
            context: line.trim(),
          })
        }
        anyPattern.lastIndex = 0
      })
    }

    return items
  }

  /**
   * Find potential hardcoded secrets
   */
  private findHardcodedSecrets(): DebtItem[] {
    const items: DebtItem[] = []

    // Patterns that might indicate hardcoded secrets
    const secretPatterns = [
      /password\s*[:=]\s*['"][^'"]{8,}['"]/i,
      /api[_-]?key\s*[:=]\s*['"][^'"]{10,}['"]/i,
      /secret\s*[:=]\s*['"][^'"]{10,}['"]/i,
      /token\s*[:=]\s*['"][^'"]{20,}['"]/i,
      /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/,
    ]

    for (const filePath of this.allFiles) {
      // Skip config files, lock files, and build files
      if (
        filePath.includes('.lock') ||
        filePath.includes('.next') ||
        filePath.includes('node_modules') ||
        filePath.endsWith('.json')
      ) {
        continue
      }

      const content = FileScanner.readFile(filePath)
      const lines = content.split('\n')
      const relativePath = filePath.replace(process.cwd() + '/', '')

      lines.forEach((line, index) => {
        // Skip lines that reference env variables
        if (line.includes('process.env') || line.includes('.env')) {
          return
        }

        for (const pattern of secretPatterns) {
          if (pattern.test(line)) {
            items.push({
              file: relativePath,
              line: index + 1,
              text: 'Potential hardcoded secret detected',
              context: line.trim().substring(0, 100), // Truncate for security
            })
            break
          }
        }
      })
    }

    return items
  }

  /**
   * Find commented out code blocks
   */
  private findCommentedCode(): DebtItem[] {
    const items: DebtItem[] = []

    for (const filePath of this.allFiles) {
      const content = FileScanner.readFile(filePath)
      const lines = content.split('\n')
      const relativePath = filePath.replace(process.cwd() + '/', '')

      let commentBlockStart = -1

      lines.forEach((line, index) => {
        const trimmed = line.trim()

        // Detect start of commented code block (3+ consecutive commented lines with code patterns)
        if (
          (trimmed.startsWith('//') && this.looksLikeCode(trimmed.substring(2))) ||
          (trimmed.startsWith('/*') && this.looksLikeCode(trimmed))
        ) {
          if (commentBlockStart === -1) {
            commentBlockStart = index + 1
          }
        } else if (commentBlockStart !== -1) {
          // End of comment block
          if (index - commentBlockStart >= 2) {
            // At least 3 lines
            items.push({
              file: relativePath,
              line: commentBlockStart,
              text: `Commented code block (${index - commentBlockStart + 1} lines)`,
            })
          }
          commentBlockStart = -1
        }
      })
    }

    return items
  }

  /**
   * Check if a commented line looks like code
   */
  private looksLikeCode(line: string): boolean {
    const codePatterns = [
      /const\s+/,
      /let\s+/,
      /var\s+/,
      /function\s+/,
      /import\s+/,
      /export\s+/,
      /return\s+/,
      /if\s*\(/,
      /for\s*\(/,
      /while\s*\(/,
      /\w+\s*\(/,
      /=>/,
    ]

    return codePatterns.some((pattern) => pattern.test(line))
  }

  /**
   * Calculate overall debt score (0-100, lower is better)
   */
  private calculateDebtScore(
    todos: number,
    consoleLogs: number,
    anyTypes: number,
    secrets: number,
    commentedCode: number
  ): number {
    // Weighted scoring
    let score = 0

    score += Math.min(todos * 0.5, 20) // TODOs: max 20 points
    score += Math.min(consoleLogs * 1, 25) // Console logs: max 25 points
    score += Math.min(anyTypes * 0.8, 20) // Any types: max 20 points
    score += Math.min(secrets * 5, 25) // Secrets: max 25 points (critical!)
    score += Math.min(commentedCode * 1, 10) // Commented code: max 10 points

    return Math.min(Math.round(score), 100)
  }
}
