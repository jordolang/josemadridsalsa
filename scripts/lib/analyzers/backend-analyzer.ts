/**
 * Backend Analyzer - Analyzes API routes and backend functionality
 * José Madrid Salsa E-commerce Platform
 */

import { FileScanner } from '../scanners/file-scanner'
import type { BackendMetrics, APIRouteAnalysis } from '../../../lib/project-analyzer/types'

export class BackendAnalyzer {
  private apiRoutes: string[]

  constructor(apiRoutes: string[]) {
    this.apiRoutes = apiRoutes
  }

  /**
   * Analyze all API routes
   */
  async analyze(): Promise<BackendMetrics> {
    console.log('⚙️  Analyzing backend API routes...')

    const routeAnalyses = await Promise.all(
      this.apiRoutes.map((routePath) => this.analyzeRoute(routePath))
    )

    const routesComplete = routeAnalyses.filter((r) => r.completion >= 80).length
    const avgCompletion =
      routeAnalyses.reduce((sum, r) => sum + r.completion, 0) / routeAnalyses.length || 0

    // Calculate coverage metrics
    const routesWithAuth = routeAnalyses.filter((r) => r.hasAuth).length
    const routesWithValidation = routeAnalyses.filter((r) => r.hasValidation).length

    const authCoverage = (routesWithAuth / routeAnalyses.length) * 100 || 0
    const validationCoverage = (routesWithValidation / routeAnalyses.length) * 100 || 0

    console.log(`  ✅ API routes analyzed: ${routeAnalyses.length}
  ✅ Complete (≥80%): ${routesComplete}
  🔒 Auth coverage: ${Math.round(authCoverage)}%
  ✔️  Validation coverage: ${Math.round(validationCoverage)}%
  📊 Average completion: ${Math.round(avgCompletion)}%
`)

    return {
      completion: Math.round(avgCompletion),
      apiRoutesTotal: routeAnalyses.length,
      apiRoutesComplete: routesComplete,
      authCoverage: Math.round(authCoverage),
      validationCoverage: Math.round(validationCoverage),
      routes: routeAnalyses,
    }
  }

  /**
   * Analyze a single API route
   */
  private analyzeRoute(routePath: string): APIRouteAnalysis {
    const content = FileScanner.readFile(routePath)
    const relativePath = routePath.replace(process.cwd() + '/', '')

    // Detect HTTP methods
    const methods = this.detectHTTPMethods(content)

    // Check for various features
    const hasAuth = this.checkAuth(content)
    const hasValidation = this.checkValidation(content)
    const hasErrorHandling = this.checkErrorHandling(content)
    const hasAuditLogging = this.checkAuditLogging(content)
    const hasTests = false // Will be cross-referenced later

    const issues: string[] = []

    // Calculate completion score
    let completion = 30 // Route exists

    if (hasAuth) {
      completion += 20
    } else {
      // Only flag auth as missing for non-public routes
      if (!relativePath.includes('/api/auth') && !relativePath.includes('/api/public')) {
        issues.push('Missing authentication check')
      } else {
        completion += 20 // Public routes get credit for intentionally not having auth
      }
    }

    if (hasValidation) {
      completion += 20
    } else {
      issues.push('Missing request validation (Zod schema)')
    }

    if (hasErrorHandling) {
      completion += 15
    } else {
      issues.push('Missing proper error handling (try-catch)')
    }

    if (hasAuditLogging) {
      completion += 10
    } else {
      if (relativePath.includes('/admin/')) {
        issues.push('Missing audit logging for admin action')
      } else {
        completion += 5 // Partial credit for non-admin routes
      }
    }

    if (hasTests) {
      completion += 5
    } else {
      issues.push('No tests found')
    }

    return {
      path: relativePath,
      methods,
      hasAuth,
      hasValidation,
      hasErrorHandling,
      hasAuditLogging,
      hasTests,
      completion: Math.min(completion, 100),
      issues,
    }
  }

  /**
   * Detect HTTP methods in the route
   */
  private detectHTTPMethods(content: string): string[] {
    const methods: string[] = []

    const methodPatterns = {
      GET: /export\s+async\s+function\s+GET/,
      POST: /export\s+async\s+function\s+POST/,
      PUT: /export\s+async\s+function\s+PUT/,
      PATCH: /export\s+async\s+function\s+PATCH/,
      DELETE: /export\s+async\s+function\s+DELETE/,
    }

    for (const [method, pattern] of Object.entries(methodPatterns)) {
      if (pattern.test(content)) {
        methods.push(method)
      }
    }

    return methods
  }

  /**
   * Check if route has authentication
   */
  private checkAuth(content: string): boolean {
    const authPatterns = [
      /getCurrentUser/,
      /requirePermission/,
      /hasPermission/,
      /getServerSession/,
      /auth\(/,
      /isAuthenticated/,
      /requireAuth/,
      /verifyToken/,
    ]

    return authPatterns.some((pattern) => pattern.test(content))
  }

  /**
   * Check if route has validation
   */
  private checkValidation(content: string): boolean {
    const validationPatterns = [
      /\.parse\(/,
      /\.safeParse\(/,
      /z\./,
      /zod/,
      /validate\(/,
      /schema\./,
    ]

    return validationPatterns.some((pattern) => pattern.test(content))
  }

  /**
   * Check if route has error handling
   */
  private checkErrorHandling(content: string): boolean {
    const errorPatterns = [
      /try\s*{/,
      /catch\s*\(/,
      /fail\(/,
      /NextResponse\.json\(\s*{[^}]*error/,
    ]

    return errorPatterns.some((pattern) => pattern.test(content))
  }

  /**
   * Check if route has audit logging
   */
  private checkAuditLogging(content: string): boolean {
    const auditPatterns = [
      /logAudit/,
      /createAuditLog/,
      /auditLog\.create/,
      /audit\./,
    ]

    return auditPatterns.some((pattern) => pattern.test(content))
  }

  /**
   * Get critical API routes that should exist
   */
  static getCriticalAPIRoutes(): string[] {
    return [
      '/api/products',
      '/api/products/[id]',
      '/api/cart',
      '/api/checkout',
      '/api/orders',
      '/api/admin/products',
      '/api/admin/orders',
      '/api/admin/users',
      '/api/auth/[...nextauth]',
      '/api/webhooks/stripe',
    ]
  }
}
