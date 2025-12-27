/**
 * Frontend Analyzer - Analyzes Next.js pages and components
 * José Madrid Salsa E-commerce Platform
 */

import { FileScanner } from '../scanners/file-scanner'
import type { FrontendMetrics, PageAnalysis } from '../../../lib/project-analyzer/types'

export class FrontendAnalyzer {
  private pages: string[]

  constructor(pages: string[]) {
    this.pages = pages
  }

  /**
   * Analyze all frontend pages
   */
  async analyze(): Promise<FrontendMetrics> {
    console.log('📱 Analyzing frontend pages...')

    const pageAnalyses = await Promise.all(
      this.pages.map((pagePath) => this.analyzePage(pagePath))
    )

    const pagesComplete = pageAnalyses.filter((p) => p.completion >= 80).length
    const pagesInProgress = pageAnalyses.filter(
      (p) => p.completion >= 30 && p.completion < 80
    ).length
    const avgCompletion =
      pageAnalyses.reduce((sum, p) => sum + p.completion, 0) / pageAnalyses.length || 0

    // Calculate TypeScript coverage
    const pagesWithTypeScript = pageAnalyses.filter((p) => p.hasTypeScript).length
    const typeScriptCoverage = (pagesWithTypeScript / pageAnalyses.length) * 100 || 0

    console.log(`  ✅ Pages analyzed: ${pageAnalyses.length}
  ✅ Complete (≥80%): ${pagesComplete}
  🚧 In Progress (30-79%): ${pagesInProgress}
  📊 Average completion: ${Math.round(avgCompletion)}%
  📝 TypeScript coverage: ${Math.round(typeScriptCoverage)}%
`)

    return {
      completion: Math.round(avgCompletion),
      pagesTotal: pageAnalyses.length,
      pagesComplete,
      pagesInProgress,
      componentCount: 0, // Will be filled by component scanner if needed
      typeScriptCoverage: Math.round(typeScriptCoverage),
      pages: pageAnalyses,
    }
  }

  /**
   * Analyze a single page
   */
  private analyzePage(pagePath: string): PageAnalysis {
    const content = FileScanner.readFile(pagePath)
    const lineCount = FileScanner.countLines(content)
    const relativePath = pagePath.replace(process.cwd() + '/', '')
    const pageName = this.extractPageName(relativePath)

    // Calculate individual scores
    const hasContent = lineCount > 100
    const hasTypeScript = !pagePath.endsWith('.js') && !pagePath.endsWith('.jsx')
    const hasErrorHandling = this.checkErrorHandling(content)
    const hasLoadingState = this.checkLoadingState(relativePath, content)
    const hasTests = false // Will be cross-referenced with test files later

    const issues: string[] = []

    // Calculate completion score
    let completion = 30 // File exists

    if (hasContent) {
      completion += 20
    } else {
      issues.push('Page has minimal content (<100 LOC)')
    }

    if (hasTypeScript) {
      completion += 15
    } else {
      issues.push('Not using TypeScript')
    }

    if (hasErrorHandling) {
      completion += 15
    } else {
      issues.push('Missing error handling/error boundary')
    }

    if (hasLoadingState) {
      completion += 10
    } else {
      issues.push('Missing loading state')
    }

    if (hasTests) {
      completion += 10
    } else {
      issues.push('No tests found')
    }

    return {
      name: pageName,
      path: relativePath,
      exists: true,
      completion,
      lineCount,
      hasContent,
      hasTypeScript,
      hasErrorHandling,
      hasLoadingState,
      hasTests,
      issues,
    }
  }

  /**
   * Extract page name from path
   */
  private extractPageName(path: string): string {
    // app/admin/products/page.tsx -> Admin Products
    // app/page.tsx -> Home
    // app/salsas/[id]/page.tsx -> Salsa Detail

    if (path === 'app/page.tsx' || path === 'app/page.ts') {
      return 'Home'
    }

    const parts = path.split('/')
    const relevantParts = parts.slice(1, -1) // Remove 'app' and 'page.tsx'

    if (relevantParts.length === 0) {
      return 'Home'
    }

    // Handle dynamic routes
    const name = relevantParts
      .map((part) => {
        if (part.startsWith('[') && part.endsWith(']')) {
          const param = part.slice(1, -1)
          return param.charAt(0).toUpperCase() + param.slice(1) + ' Detail'
        }
        return part.charAt(0).toUpperCase() + part.slice(1)
      })
      .join(' ')

    return name
  }

  /**
   * Check if page has error handling
   */
  private checkErrorHandling(content: string): boolean {
    // Check for error.tsx, try-catch blocks, or error boundaries
    const patterns = [
      /try\s*{/,
      /catch\s*\(/,
      /<ErrorBoundary/,
      /error\.tsx/,
      /ErrorFallback/,
    ]

    return patterns.some((pattern) => pattern.test(content))
  }

  /**
   * Check if page has loading state
   */
  private checkLoadingState(path: string, content: string): boolean {
    // Check for loading.tsx file or loading states in the component
    const hasLoadingFile = path.replace('page.tsx', 'loading.tsx')

    const patterns = [
      /loading\.tsx/,
      /isLoading/,
      /isPending/,
      /loading\s*:/,
      /<Suspense/,
      /Skeleton/,
      /Loading/,
    ]

    return patterns.some((pattern) => pattern.test(content))
  }

  /**
   * Get critical pages that should exist for e-commerce
   */
  static getCriticalPages(): string[] {
    return [
      'Home',
      'Products',
      'Product Detail',
      'Cart',
      'Checkout',
      'Account',
      'Admin',
      'About',
      'Contact',
      'Salsas',
      'Recipes',
      'Find Us',
      'Fundraisers',
      'Wholesale',
      'Gift Certificates',
    ]
  }

  /**
   * Identify missing critical pages
   */
  static findMissingPages(analyzedPages: PageAnalysis[]): string[] {
    const criticalPages = FrontendAnalyzer.getCriticalPages()
    const existingPageNames = analyzedPages.map((p) => p.name)

    return criticalPages.filter((criticalPage) => {
      // Fuzzy match to account for different naming
      return !existingPageNames.some((existing) =>
        existing.toLowerCase().includes(criticalPage.toLowerCase())
      )
    })
  }
}
