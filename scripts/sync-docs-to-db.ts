import { PrismaClient, DocumentationVisibility } from '@prisma/client'
import { readdir, readFile } from 'fs/promises'
import { join, relative } from 'path'
import matter from 'gray-matter'

const prisma = new PrismaClient()

type DocMetadata = {
  title?: string
  description?: string
  category?: string
  visibility?: 'public' | 'developer'
  tags?: string[]
}

async function getAllMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        return getAllMarkdownFiles(fullPath)
      } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
        return [fullPath]
      }
      return []
    })
  )
  return files.flat()
}

function filePathToSlug(filePath: string, docsDir: string): string {
  const relativePath = relative(docsDir, filePath)
  const slug = relativePath
    .replace(/\.(md|mdx)$/, '')
    .replace(/\\/g, '/')
  
  return slug === 'index' ? 'index' : slug
}

function humanizeTitle(slug: string): string {
  const lastSegment = slug.split('/').pop() || slug
  return lastSegment
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

async function main() {
  console.log('Syncing documentation entries to database...')
  
  try {
    const docsDir = join(process.cwd(), 'docs')
    const markdownFiles = await getAllMarkdownFiles(docsDir)
    
    let created = 0
    let updated = 0
    
    for (const filePath of markdownFiles) {
      const content = await readFile(filePath, 'utf-8')
      const { data } = matter(content)
      const metadata = data as DocMetadata
      
      const slug = filePathToSlug(filePath, docsDir)
      const title = metadata.title || humanizeTitle(slug)
      const visibility: DocumentationVisibility = 
        metadata.visibility === 'developer' ? 'DEVELOPER' : 'PUBLIC'
      
      const payload = {
        title,
        description: metadata.description || null,
        category: metadata.category || null,
        tags: metadata.tags || [],
        visibility,
        sourcePath: relative(process.cwd(), filePath),
        filePath: relative(process.cwd(), filePath),
        lastSyncedAt: new Date(),
      }
      
      const existing = await prisma.documentationEntry.findUnique({
        where: { slug },
      })
      
      if (existing) {
        await prisma.documentationEntry.update({
          where: { slug },
          data: payload,
        })
        updated++
      } else {
        await prisma.documentationEntry.create({
          data: {
            slug,
            isPublished: true,
            ...payload,
          },
        })
        created++
      }
    }
    
    console.log(`✓ Documentation sync complete!`)
    console.log(`  Total: ${markdownFiles.length}`)
    console.log(`  Created: ${created}`)
    console.log(`  Updated: ${updated}`)
    
    await prisma.$disconnect()
  } catch (error) {
    console.error('Error syncing documentation:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

main()
