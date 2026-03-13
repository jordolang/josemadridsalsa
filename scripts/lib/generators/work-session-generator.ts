/**
 * Work Session Generator - Creates 5-hour Claude Code work batches
 * José Madrid Salsa E-commerce Platform
 */

import type {
  WorkSession,
  WorkTask,
  FeatureSuggestions,
  TechnicalDebt,
  FrontendMetrics,
  BackendMetrics,
} from '../../../lib/project-analyzer/types'

export class WorkSessionGenerator {
  private sessionNumber: number
  private suggestions: FeatureSuggestions
  private technicalDebt: TechnicalDebt
  private frontendMetrics: FrontendMetrics
  private backendMetrics: BackendMetrics

  constructor(
    sessionNumber: number,
    suggestions: FeatureSuggestions,
    technicalDebt: TechnicalDebt,
    frontendMetrics: FrontendMetrics,
    backendMetrics: BackendMetrics
  ) {
    this.sessionNumber = sessionNumber
    this.suggestions = suggestions
    this.technicalDebt = technicalDebt
    this.frontendMetrics = frontendMetrics
    this.backendMetrics = backendMetrics
  }

  /**
   * Generate a 5-hour work session with prioritized tasks
   */
  generate(): WorkSession | null {
    console.log('📋 Generating 5-hour work session...')

    // Collect all potential tasks
    const allTasks = this.collectAllTasks()

    if (allTasks.length === 0) {
      console.log('  ✅ No tasks remaining - project is complete!')
      return null
    }

    // Sort by priority and business impact
    const sortedTasks = this.prioritizeTasks(allTasks)

    // Select tasks that fit in 5 hours
    const selectedTasks = this.selectTasksForSession(sortedTasks, 5)

    const totalHours = selectedTasks.reduce((sum, task) => sum + task.estimatedHours, 0)
    const focus = this.determineFocus(selectedTasks)
    const priority = this.determineSessionPriority(selectedTasks)

    // Calculate projected completion
    const currentCompletion =
      (this.frontendMetrics.completion + this.backendMetrics.completion) / 2
    const expectedProgress = (selectedTasks.length / allTasks.length) * 10 // Assume each session completes ~10%
    const projectedCompletion = Math.min(currentCompletion + expectedProgress, 100)

    console.log(`  📦 Session #${this.sessionNumber}
  🎯 Focus: ${focus}
  ⏱️  Estimated: ${totalHours} hours
  ✅ Tasks: ${selectedTasks.length}
  📊 Projected completion: ${Math.round(projectedCompletion)}%
`)

    return {
      sessionNumber: this.sessionNumber,
      estimatedHours: totalHours,
      focus,
      priority,
      tasks: selectedTasks,
      estimatedCompletion: {
        totalHours,
        expectedProgress: Math.round(expectedProgress),
        tasksToComplete: selectedTasks.length,
        projectedCompletion: Math.round(projectedCompletion),
      },
    }
  }

  /**
   * Collect all tasks from various sources
   */
  private collectAllTasks(): WorkTask[] {
    const tasks: WorkTask[] = []
    let taskNumber = 1

    // Critical features
    this.suggestions.critical.forEach((suggestion) => {
      tasks.push({
        taskNumber: taskNumber++,
        title: suggestion.title,
        description: suggestion.description,
        priority: 'critical',
        estimatedHours: suggestion.estimatedHours,
        files: suggestion.files || [],
        dependencies: suggestion.dependencies,
        instructions: this.generateInstructions(suggestion, 'critical'),
        testing: this.generateTestCriteria(suggestion),
      })
    })

    // Recommended features
    this.suggestions.recommended.forEach((suggestion) => {
      tasks.push({
        taskNumber: taskNumber++,
        title: suggestion.title,
        description: suggestion.description,
        priority: 'high',
        estimatedHours: suggestion.estimatedHours,
        files: suggestion.files || [],
        dependencies: suggestion.dependencies,
        instructions: this.generateInstructions(suggestion, 'high'),
        testing: this.generateTestCriteria(suggestion),
      })
    })

    // High-priority technical debt (hardcoded secrets)
    if (this.technicalDebt.hardcodedSecrets.length > 0) {
      tasks.push({
        taskNumber: taskNumber++,
        title: 'Fix Hardcoded Secrets',
        description: `Remove ${this.technicalDebt.hardcodedSecrets.length} potential hardcoded secrets and move to environment variables.`,
        priority: 'critical',
        estimatedHours: 1,
        files: [...new Set(this.technicalDebt.hardcodedSecrets.map((s) => s.file))],
        dependencies: ['.env file setup'],
        instructions: this.generateSecurityFixInstructions(),
        testing: {
          functional: ['Verify app still works after changes'],
          visual: [],
          performance: [],
          accessibility: [],
        },
      })
    }

    // Incomplete pages
    const incompleteFrontendPages = this.frontendMetrics.pages.filter((p) => p.completion < 80)
    if (incompleteFrontendPages.length > 0) {
      const topIncomplete = incompleteFrontendPages.slice(0, 3) // Top 3 most incomplete

      topIncomplete.forEach((page) => {
        tasks.push({
          taskNumber: taskNumber++,
          title: `Complete ${page.name} Page`,
          description: `Finish implementing ${page.name} page. Current completion: ${page.completion}%`,
          priority: page.completion < 50 ? 'high' : 'medium',
          estimatedHours: 2,
          files: [page.path],
          dependencies: [],
          instructions: this.generatePageCompletionInstructions(page),
          testing: {
            functional: ['Page loads without errors', 'All features work'],
            visual: ['Responsive on mobile/tablet/desktop', 'Matches design system'],
            performance: ['Page loads in <3 seconds'],
            accessibility: ['Keyboard navigation works', 'Screen reader compatible'],
          },
        })
      })
    }

    // Incomplete API routes
    const incompleteBackendRoutes = this.backendMetrics.routes.filter((r) => r.completion < 80)
    if (incompleteBackendRoutes.length > 0) {
      const topIncomplete = incompleteBackendRoutes.slice(0, 3)

      topIncomplete.forEach((route) => {
        tasks.push({
          taskNumber: taskNumber++,
          title: `Complete API Route: ${route.path}`,
          description: `Add missing features to ${route.path}. Issues: ${route.issues.join(', ')}`,
          priority: 'medium',
          estimatedHours: 1.5,
          files: [route.path],
          dependencies: [],
          instructions: this.generateAPICompletionInstructions(route),
          testing: {
            functional: ['All HTTP methods work', 'Error handling tested'],
            visual: [],
            performance: ['Response time <500ms'],
            accessibility: [],
          },
        })
      })
    }

    return tasks
  }

  /**
   * Prioritize tasks by business impact and urgency
   */
  private prioritizeTasks(tasks: WorkTask[]): WorkTask[] {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }

    return tasks.sort((a, b) => {
      // First by priority
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
      if (priorityDiff !== 0) return priorityDiff

      // Then by estimated hours (shorter tasks first for quick wins)
      return a.estimatedHours - b.estimatedHours
    })
  }

  /**
   * Select tasks that fit in the time budget
   */
  private selectTasksForSession(tasks: WorkTask[], maxHours: number): WorkTask[] {
    const selected: WorkTask[] = []
    let totalHours = 0

    for (const task of tasks) {
      if (totalHours + task.estimatedHours <= maxHours) {
        selected.push(task)
        totalHours += task.estimatedHours
      }

      // Stop when we're close to the limit
      if (totalHours >= maxHours - 0.5) break
    }

    // Re-number tasks sequentially
    selected.forEach((task, index) => {
      task.taskNumber = index + 1
    })

    return selected
  }

  /**
   * Determine session focus based on task types
   */
  private determineFocus(tasks: WorkTask[]): string {
    const hasCritical = tasks.some((t) => t.priority === 'critical')
    const hasFeatures = tasks.some((t) => t.title.includes('Implement') || t.title.includes('Add'))
    const hasPages = tasks.some((t) => t.title.includes('Page'))
    const hasAPI = tasks.some((t) => t.title.includes('API'))
    const hasSecurity = tasks.some((t) => t.title.includes('Secret') || t.title.includes('Security'))

    if (hasSecurity) return 'Critical Security Fixes'
    if (hasCritical) return 'Critical E-commerce Features'
    if (hasFeatures) return 'High Priority Feature Development'
    if (hasPages) return 'Frontend Page Completion'
    if (hasAPI) return 'Backend API Enhancement'
    return 'General Improvements'
  }

  /**
   * Determine overall session priority
   */
  private determineSessionPriority(tasks: WorkTask[]): 'critical' | 'high' | 'medium' | 'low' {
    if (tasks.some((t) => t.priority === 'critical')) return 'critical'
    if (tasks.some((t) => t.priority === 'high')) return 'high'
    if (tasks.some((t) => t.priority === 'medium')) return 'medium'
    return 'low'
  }

  /**
   * Generate detailed instructions for a feature
   */
  private generateInstructions(suggestion: any, priority: string): string {
    return `## ${priority.toUpperCase()} PRIORITY: ${suggestion.title}

### 🎯 Objective
${suggestion.description}

**Category:** ${suggestion.category}
**Estimated Time:** ${suggestion.estimatedHours} hours
**Business Impact:** ${suggestion.businessImpact}
**Technical Complexity:** ${suggestion.technicalComplexity}

### 📋 Implementation Steps

1. **Planning & Setup**
   - Review existing similar features in the codebase
   - ${suggestion.dependencies.length > 0 ? `Install/configure: ${suggestion.dependencies.join(', ')}` : 'No external dependencies needed'}
   - Design data models if needed

2. **Core Implementation**
   ${suggestion.files && suggestion.files.length > 0 ? `   - Create/modify files: ${suggestion.files.join(', ')}` : '   - Identify appropriate file locations'}
   - Implement core functionality
   - Add proper TypeScript types
   - Include error handling and validation

3. **Integration**
   - Integrate with existing features
   - Add to navigation if user-facing
   - Update any affected components

4. **Testing & Polish**
   - Test all functionality thoroughly
   - Verify responsive design
   - Check error states and edge cases
   - Optimize performance

### ✅ Definition of Done
- Feature works as specified
- No console errors
- Responsive on all screen sizes
- Proper error handling
- Code follows project conventions
- TypeScript types complete
`
  }

  /**
   * Generate test criteria based on feature category
   */
  private generateTestCriteria(suggestion: any): {
    functional: string[]
    visual: string[]
    performance: string[]
    accessibility: string[]
  } {
    return {
      functional: [
        'Feature works as designed',
        'All user interactions function correctly',
        'Data persists correctly',
        'Error cases handled gracefully',
      ],
      visual: [
        'Responsive on mobile, tablet, and desktop',
        'Consistent with existing design system',
        'Loading states display properly',
        'Error messages are clear and helpful',
      ],
      performance: [
        'Page/API loads within acceptable time (<3s for pages, <500ms for APIs)',
        'No memory leaks',
        'Optimized database queries',
        'Minimal bundle size impact',
      ],
      accessibility: [
        'Keyboard navigation works',
        'Screen reader compatible',
        'Sufficient color contrast',
        'Focus indicators visible',
      ],
    }
  }

  /**
   * Generate security fix instructions
   */
  private generateSecurityFixInstructions(): string {
    const files = [...new Set(this.technicalDebt.hardcodedSecrets.map((s) => s.file))].join(', ')

    return `## CRITICAL SECURITY FIX: Remove Hardcoded Secrets

### 🚨 Security Issue
Found ${this.technicalDebt.hardcodedSecrets.length} potential hardcoded secrets in: ${files}

### 🔧 Fix Steps

1. **Identify secrets**
   - Review each flagged line
   - Determine which are actual secrets vs false positives

2. **Move to environment variables**
   - Add to .env.local (development)
   - Add to Vercel environment variables (production)
   - Update .env.example with placeholder values

3. **Update code**
   - Replace hardcoded values with process.env.VARIABLE_NAME
   - Add runtime checks for missing variables
   - Update TypeScript types if needed

4. **Verify**
   - Test that app works with new env variables
   - Check that no secrets remain in code
   - Run security scan again: npm run security:scan

### ⚠️ Important
- Never commit .env files to git
- Rotate any exposed secrets immediately
- Update deployment environment variables
`
  }

  /**
   * Generate page completion instructions
   */
  private generatePageCompletionInstructions(page: any): string {
    return `## Complete ${page.name} Page

### Current Status
- **Completion:** ${page.completion}%
- **Issues:** ${page.issues.join(', ')}
- **File:** ${page.path}

### Tasks
${!page.hasContent ? '- Add meaningful content (currently <100 lines)' : ''}
${!page.hasTypeScript ? '- Convert to TypeScript' : ''}
${!page.hasErrorHandling ? '- Add error handling/error boundary' : ''}
${!page.hasLoadingState ? '- Add loading state (Suspense or loading.tsx)' : ''}
${!page.hasTests ? '- Write tests for critical functionality' : ''}

### Implementation
1. Review existing similar pages for patterns
2. Fix each issue listed above
3. Ensure responsive design
4. Test thoroughly on all devices
`
  }

  /**
   * Generate API completion instructions
   */
  private generateAPICompletionInstructions(route: any): string {
    return `## Complete API Route: ${route.path}

### Current Status
- **Completion:** ${route.completion}%
- **Methods:** ${route.methods.join(', ')}
- **Issues:** ${route.issues.join(', ')}

### Tasks
${!route.hasAuth ? '- Add authentication check (getCurrentUser or requirePermission)' : ''}
${!route.hasValidation ? '- Add Zod validation schema' : ''}
${!route.hasErrorHandling ? '- Wrap in try-catch with proper error responses' : ''}
${!route.hasAuditLogging ? '- Add audit logging for mutations' : ''}
${!route.hasTests ? '- Write API tests' : ''}

### Implementation
1. Review similar API routes for patterns
2. Add missing functionality from issues list
3. Test all HTTP methods
4. Verify error handling
5. Check performance (<500ms response time)
`
  }
}
