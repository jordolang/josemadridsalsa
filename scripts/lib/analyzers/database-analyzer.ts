/**
 * Database Analyzer - Analyzes Prisma schema
 * José Madrid Salsa E-commerce Platform
 */

import { FileScanner } from '../scanners/file-scanner'
import type { DatabaseMetrics, DatabaseRelationship } from '../../../lib/project-analyzer/types'

export class DatabaseAnalyzer {
  private schemaPath: string | null

  constructor(schemaPath: string | null) {
    this.schemaPath = schemaPath
  }

  /**
   * Analyze Prisma schema
   */
  async analyze(): Promise<DatabaseMetrics> {
    console.log('🗄️  Analyzing database schema...')

    if (!this.schemaPath) {
      console.log('  ⚠️  No Prisma schema found')
      return this.getEmptyMetrics()
    }

    const content = FileScanner.readFile(this.schemaPath)

    const models = this.extractModels(content)
    const relationships = this.extractRelationships(content, models)
    const indexedRelationships = relationships.filter((r) => r.hasIndex).length
    const indexCoverage = (indexedRelationships / relationships.length) * 100 || 0
    const hasSeedData = this.checkForSeedData()

    // Calculate completion
    let completion = 25 // Models exist

    if (relationships.length > 0) {
      completion += 20 // Relationships defined
    }

    if (indexCoverage > 50) {
      completion += 20 // Good index coverage
    } else if (indexCoverage > 0) {
      completion += 10 // Some indexes
    }

    completion += 15 // Migrations (assume clean if schema exists)

    if (hasSeedData) {
      completion += 10
    }

    completion += 10 // Schema comments/documentation (partial credit)

    console.log(`  ✅ Models: ${models.length}
  ✅ Relationships: ${relationships.length}
  📊 Index coverage: ${Math.round(indexCoverage)}%
  🌱 Seed data: ${hasSeedData ? 'Yes' : 'No'}
  📊 Completion: ${completion}%
`)

    return {
      completion,
      modelsCount: models.length,
      relationshipsCount: relationships.length,
      indexCoverage: Math.round(indexCoverage),
      hasSeedData,
      models,
      relationships,
    }
  }

  /**
   * Extract model names from schema
   */
  private extractModels(content: string): string[] {
    const modelRegex = /model\s+(\w+)\s*{/g
    const models: string[] = []
    let match

    while ((match = modelRegex.exec(content)) !== null) {
      models.push(match[1])
    }

    return models
  }

  /**
   * Extract relationships from schema
   */
  private extractRelationships(content: string, models: string[]): DatabaseRelationship[] {
    const relationships: DatabaseRelationship[] = []

    // Parse each model for relationships
    for (const model of models) {
      const modelRegex = new RegExp(`model\\s+${model}\\s*{([^}]+)}`, 's')
      const modelMatch = content.match(modelRegex)

      if (!modelMatch) continue

      const modelBody = modelMatch[1]

      // Find relation fields
      const relationRegex = /(\w+)\s+(\w+)(\[\])?\s+@relation/g
      let relationMatch

      while ((relationMatch = relationRegex.exec(modelBody)) !== null) {
        const fieldName = relationMatch[1]
        const relatedModel = relationMatch[2]
        const isArray = !!relationMatch[3]

        // Check if there's an index on the foreign key
        const hasIndex = this.checkFieldIndex(modelBody, fieldName)

        relationships.push({
          from: model,
          to: relatedModel,
          type: isArray ? 'one-to-many' : 'one-to-one',
          hasIndex,
        })
      }
    }

    return relationships
  }

  /**
   * Check if a field has an index
   */
  private checkFieldIndex(modelBody: string, fieldName: string): boolean {
    const indexPatterns = [
      new RegExp(`@@index\\(\\[${fieldName}\\]\\)`),
      new RegExp(`${fieldName}\\s+\\w+\\s+@[^\\n]*@index`),
      new RegExp(`@unique`),
      new RegExp(`@id`),
    ]

    return indexPatterns.some((pattern) => pattern.test(modelBody))
  }

  /**
   * Check if seed data exists
   */
  private checkForSeedData(): boolean {
    const fs = require('fs')
    const path = require('path')

    const seedPaths = [
      path.join(process.cwd(), 'prisma', 'seed.ts'),
      path.join(process.cwd(), 'prisma', 'seed.js'),
      path.join(process.cwd(), 'scripts', 'seed.ts'),
    ]

    return seedPaths.some((seedPath) => fs.existsSync(seedPath))
  }

  /**
   * Get empty metrics when no schema exists
   */
  private getEmptyMetrics(): DatabaseMetrics {
    return {
      completion: 0,
      modelsCount: 0,
      relationshipsCount: 0,
      indexCoverage: 0,
      hasSeedData: false,
      models: [],
      relationships: [],
    }
  }
}
