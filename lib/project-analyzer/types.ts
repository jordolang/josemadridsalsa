/**
 * TypeScript types for the Project Completion Dashboard
 * José Madrid Salsa E-commerce Platform
 */

export interface ProjectAnalysis {
  version: string
  timestamp: string
  runNumber: number
  overallCompletion: number
  metrics: ProjectMetrics
  technicalDebt: TechnicalDebt
  codeQuality: CodeQuality
  suggestions: FeatureSuggestions
  workSession: WorkSession | null
}

export interface ProjectMetrics {
  frontend: FrontendMetrics
  backend: BackendMetrics
  database: DatabaseMetrics
  packages: PackageMetrics
}

export interface FrontendMetrics {
  completion: number
  pagesTotal: number
  pagesComplete: number
  pagesInProgress: number
  componentCount: number
  typeScriptCoverage: number
  pages: PageAnalysis[]
}

export interface PageAnalysis {
  name: string
  path: string
  exists: boolean
  completion: number
  lineCount: number
  hasContent: boolean
  hasTypeScript: boolean
  hasErrorHandling: boolean
  hasLoadingState: boolean
  hasTests: boolean
  issues: string[]
}

export interface BackendMetrics {
  completion: number
  apiRoutesTotal: number
  apiRoutesComplete: number
  authCoverage: number
  validationCoverage: number
  routes: APIRouteAnalysis[]
}

export interface APIRouteAnalysis {
  path: string
  methods: string[]
  hasAuth: boolean
  hasValidation: boolean
  hasErrorHandling: boolean
  hasAuditLogging: boolean
  hasTests: boolean
  completion: number
  issues: string[]
}

export interface DatabaseMetrics {
  completion: number
  modelsCount: number
  relationshipsCount: number
  indexCoverage: number
  hasSeedData: boolean
  models: string[]
  relationships: DatabaseRelationship[]
}

export interface DatabaseRelationship {
  from: string
  to: string
  type: 'one-to-one' | 'one-to-many' | 'many-to-many'
  hasIndex: boolean
}

export interface PackageMetrics {
  totalPackages: number
  outdatedCount: number
  vulnerabilityCount: number
  outdated: OutdatedPackage[]
  vulnerabilities: PackageVulnerability[]
}

export interface OutdatedPackage {
  name: string
  current: string
  wanted: string
  latest: string
}

export interface PackageVulnerability {
  name: string
  severity: 'low' | 'moderate' | 'high' | 'critical'
  description: string
}

export interface TechnicalDebt {
  totalScore: number
  todos: DebtItem[]
  consoleLogs: DebtItem[]
  anyTypes: DebtItem[]
  hardcodedSecrets: DebtItem[]
  commentedCode: DebtItem[]
}

export interface DebtItem {
  file: string
  line: number
  text?: string
  context?: string
}

export interface CodeQuality {
  typeScriptStrict: boolean
  eslintErrors: number
  eslintWarnings: number
  testCoverage: number
  averageComplexity: number
}

export interface FeatureSuggestions {
  critical: FeatureSuggestion[]
  recommended: FeatureSuggestion[]
  niceToHave: FeatureSuggestion[]
  future: FeatureSuggestion[]
}

export interface FeatureSuggestion {
  title: string
  description: string
  category: string
  estimatedHours: number
  businessImpact: 'critical' | 'high' | 'medium' | 'low'
  technicalComplexity: 'low' | 'medium' | 'high'
  dependencies: string[]
  files?: string[]
}

export interface WorkSession {
  sessionNumber: number
  estimatedHours: number
  focus: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  tasks: WorkTask[]
  estimatedCompletion: {
    totalHours: number
    expectedProgress: number
    tasksToComplete: number
    projectedCompletion: number
  }
}

export interface WorkTask {
  taskNumber: number
  title: string
  description: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  estimatedHours: number
  files: string[]
  dependencies: string[]
  instructions: string
  testing: {
    functional: string[]
    visual: string[]
    performance: string[]
    accessibility: string[]
  }
}

export interface FileScanResult {
  pages: string[]
  apiRoutes: string[]
  components: string[]
  utilities: string[]
  prismaSchema: string | null
  testFiles: string[]
}

export interface AnalyzerOptions {
  projectRoot: string
  outputDir?: string
  verbose?: boolean
  export?: 'json' | 'csv' | 'markdown' | null
}
