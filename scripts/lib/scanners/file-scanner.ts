/**
 * File Scanner - Discovers all relevant files in the Next.js codebase
 * José Madrid Salsa E-commerce Platform
 */

import * as path from 'path'
import * as fs from 'fs'
import type { FileScanResult } from '../../../lib/project-analyzer/types'

const fg = require('fast-glob')

export class FileScanner {
  private projectRoot: string

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot
  }

  /**
   * Scan the entire codebase and categorize files
   */
  async scan(): Promise<FileScanResult> {
    console.log('🔍 Scanning codebase...')

    const [pages, apiRoutes, components, utilities, testFiles] = await Promise.all([
      this.findPages(),
      this.findAPIRoutes(),
      this.findComponents(),
      this.findUtilities(),
      this.findTestFiles(),
    ])

    const prismaSchema = this.findPrismaSchema()

    console.log(`✅ Found:
  - ${pages.length} pages
  - ${apiRoutes.length} API routes
  - ${components.length} components
  - ${utilities.length} utility files
  - ${testFiles.length} test files
  - Prisma schema: ${prismaSchema ? 'Yes' : 'No'}
`)

    return {
      pages,
      apiRoutes,
      components,
      utilities,
      prismaSchema,
      testFiles,
    }
  }

  /**
   * Find all Next.js pages (app/...glob.../page.tsx)
   */
  private async findPages(): Promise<string[]> {
    const patterns = [
      'app/**/page.tsx',
      'app/**/page.ts',
      'app/**/page.jsx',
      'app/**/page.js',
    ]

    const files = await fg(patterns, {
      cwd: this.projectRoot,
      ignore: [
        '**/node_modules/**',
        '**/.next/**',
        '**/dist/**',
        '**/.git/**',
      ],
    })

    return files.map((file: string) => path.join(this.projectRoot, file))
  }

  /**
   * Find all API routes (app/api/...glob.../route.ts)
   */
  private async findAPIRoutes(): Promise<string[]> {
    const patterns = [
      'app/api/**/route.ts',
      'app/api/**/route.js',
    ]

    const files = await fg(patterns, {
      cwd: this.projectRoot,
      ignore: [
        '**/node_modules/**',
        '**/.next/**',
      ],
    })

    return files.map((file: string) => path.join(this.projectRoot, file))
  }

  /**
   * Find all React components
   */
  private async findComponents(): Promise<string[]> {
    const patterns = [
      'components/**/*.tsx',
      'components/**/*.ts',
      'components/**/*.jsx',
      'components/**/*.js',
    ]

    const files = await fg(patterns, {
      cwd: this.projectRoot,
      ignore: [
        '**/node_modules/**',
        '**/.next/**',
        '**/*.test.*',
        '**/*.spec.*',
      ],
    })

    return files.map((file: string) => path.join(this.projectRoot, file))
  }

  /**
   * Find utility files
   */
  private async findUtilities(): Promise<string[]> {
    const patterns = [
      'lib/**/*.ts',
      'lib/**/*.js',
      'utils/**/*.ts',
      'utils/**/*.js',
    ]

    const files = await fg(patterns, {
      cwd: this.projectRoot,
      ignore: [
        '**/node_modules/**',
        '**/*.test.*',
        '**/*.spec.*',
      ],
    })

    return files.map((file: string) => path.join(this.projectRoot, file))
  }

  /**
   * Find test files
   */
  private async findTestFiles(): Promise<string[]> {
    const patterns = [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.test.js',
      '**/*.test.jsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/*.spec.js',
      '**/*.spec.jsx',
    ]

    const files = await fg(patterns, {
      cwd: this.projectRoot,
      ignore: [
        '**/node_modules/**',
        '**/.next/**',
      ],
    })

    return files.map((file: string) => path.join(this.projectRoot, file))
  }

  /**
   * Find Prisma schema
   */
  private findPrismaSchema(): string | null {
    const schemaPath = path.join(this.projectRoot, 'prisma', 'schema.prisma')
    return fs.existsSync(schemaPath) ? schemaPath : null
  }

  /**
   * Get file content
   */
  static readFile(filePath: string): string {
    try {
      return fs.readFileSync(filePath, 'utf-8')
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error)
      return ''
    }
  }

  /**
   * Count lines in a file
   */
  static countLines(content: string): number {
    return content.split('\n').length
  }

  /**
   * Get file size in KB
   */
  static getFileSize(filePath: string): number {
    try {
      const stats = fs.statSync(filePath)
      return Math.round(stats.size / 1024)
    } catch (error) {
      return 0
    }
  }
}
