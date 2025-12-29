#!/usr/bin/env tsx
/**
 * Autonomous Session Executor - Claude API Version
 * José Madrid Salsa E-commerce Platform
 *
 * Fully autonomous execution using Claude API:
 * 1. Reads latest work session from analyzer
 * 2. Generates comprehensive execution prompt
 * 3. Executes via Claude API with tool support
 * 4. Handles bash, file operations, git, deployment
 * 5. Infinite retry until success
 *
 * Usage:
 *   npm run auto-execute
 *   tsx scripts/auto-execute-session.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import Anthropic from '@anthropic-ai/sdk'
import { ClaudePromptGenerator } from './lib/generators/claude-prompt-generator'
import type { ProjectAnalysis } from '../lib/project-analyzer/types'

const execAsync = promisify(exec)

// Configuration
const PROJECT_ROOT = process.cwd()
const ANALYSIS_DIR = path.join(PROJECT_ROOT, '.project-analysis')
const CURRENT_ANALYSIS = path.join(ANALYSIS_DIR, 'current.json')
const PROMPTS_DIR = path.join(ANALYSIS_DIR, 'prompts')
const LOGS_DIR = path.join(PROJECT_ROOT, 'logs', 'auto-executor')

// Lock file to prevent concurrent executions
const LOCK_FILE = path.join(ANALYSIS_DIR, 'executor.lock')
const MAX_LOCK_AGE_HOURS = 12

// API Configuration
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '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'
const MODEL = 'claude-sonnet-4-5-20250929'
const MAX_TOKENS = 8000

async function main() {
  console.log('🤖 José Madrid Salsa - Autonomous Session Executor (Claude API)\n')

  // Check for lock file
  if (isLocked()) {
    console.log('⚠️  Another execution is in progress or a stale lock exists')
    console.log('   Lock file:', LOCK_FILE)

    if (isLockStale()) {
      console.log('   Lock is stale (>12 hours), removing...')
      fs.unlinkSync(LOCK_FILE)
    } else {
      console.log('   Exiting to prevent concurrent executions')
      process.exit(0)
    }
  }

  // Create lock
  createLock()

  try {
    // Ensure directories exist
    ensureDirectories()

    // Load latest analysis
    console.log('📊 Loading latest analysis...')
    const analysis = loadAnalysis()

    if (!analysis) {
      console.log('❌ No analysis found. Run `npm run analyze` first.')
      removeLock()
      process.exit(1)
    }

    if (!analysis.workSession || analysis.workSession.tasks.length === 0) {
      console.log('✅ No work session found - project is complete!')
      console.log('   Overall completion:', analysis.overallCompletion + '%')
      removeLock()
      process.exit(0)
    }

    console.log(`✅ Loaded analysis run #${analysis.runNumber}`)
    console.log(`   Overall completion: ${analysis.overallCompletion}%`)
    console.log(`   Work session: ${analysis.workSession.focus}`)
    console.log(`   Tasks: ${analysis.workSession.tasks.length}`)
    console.log(`   Estimated: ${analysis.workSession.estimatedHours}h\n`)

    // Generate Claude Code prompt
    console.log('📝 Generating execution prompt...')
    const promptGenerator = new ClaudePromptGenerator(analysis.workSession)
    const prompt = promptGenerator.generate()

    // Save prompt to file
    const promptFile = path.join(
      PROMPTS_DIR,
      `session-${analysis.runNumber}-${Date.now()}.md`
    )
    fs.writeFileSync(promptFile, prompt)
    console.log(`✅ Prompt saved: ${promptFile}\n`)

    // Initialize Claude API
    console.log('🔑 Initializing Claude API...')
    const anthropic = new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
    })
    console.log('✅ API initialized\n')

    // Execute with Claude API
    console.log('🚀 Starting autonomous execution...')
    console.log('━'.repeat(80))
    console.log()

    const logFile = path.join(LOGS_DIR, `session-${analysis.runNumber}-${Date.now()}.log`)
    await executeWithClaudeAPI(anthropic, prompt, logFile, analysis.runNumber)

    console.log()
    console.log('━'.repeat(80))
    console.log('✅ Autonomous execution completed!')
    console.log()

  } catch (error) {
    console.error('❌ Error during execution:', error)
    throw error
  } finally {
    removeLock()
  }
}

async function executeWithClaudeAPI(
  anthropic: Anthropic,
  prompt: string,
  logFile: string,
  runNumber: number
): Promise<void> {
  const logStream = fs.createWriteStream(logFile, { flags: 'a' })

  function log(message: string) {
    console.log(message)
    logStream.write(message + '\n')
  }

  log(`📄 Execution log: ${logFile}\n`)
  log(`🎯 Starting autonomous session #${runNumber}`)
  log(`⏰ Started at: ${new Date().toISOString()}\n`)

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: prompt,
    },
  ]

  let conversationActive = true
  let turnCount = 0
  const MAX_TURNS = 100 // Safety limit

  while (conversationActive && turnCount < MAX_TURNS) {
    turnCount++
    log(`\n${'='.repeat(80)}`)
    log(`Turn ${turnCount}`)
    log('='.repeat(80))

    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: messages,
        tools: [
          {
            name: 'bash',
            description: 'Execute bash commands in the project directory. Use this for git, npm, vercel, and other command-line operations.',
            input_schema: {
              type: 'object',
              properties: {
                command: {
                  type: 'string',
                  description: 'The bash command to execute',
                },
              },
              required: ['command'],
            },
          },
          {
            name: 'read_file',
            description: 'Read contents of a file',
            input_schema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: 'Absolute path to the file to read',
                },
              },
              required: ['file_path'],
            },
          },
          {
            name: 'write_file',
            description: 'Write or create a file with given content',
            input_schema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: 'Absolute path to the file to write',
                },
                content: {
                  type: 'string',
                  description: 'Content to write to the file',
                },
              },
              required: ['file_path', 'content'],
            },
          },
          {
            name: 'edit_file',
            description: 'Edit a file by replacing old_string with new_string',
            input_schema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: 'Absolute path to the file to edit',
                },
                old_string: {
                  type: 'string',
                  description: 'The exact string to replace',
                },
                new_string: {
                  type: 'string',
                  description: 'The new string to replace with',
                },
              },
              required: ['file_path', 'old_string', 'new_string'],
            },
          },
        ],
      })

      // Log assistant response
      for (const block of response.content) {
        if (block.type === 'text') {
          log(`\n💭 Assistant: ${block.text}`)
        }
      }

      // Check if conversation should continue
      if (response.stop_reason === 'end_turn') {
        log('\n✅ Assistant completed execution (end_turn)')
        conversationActive = false
        break
      }

      // Handle tool calls
      if (response.stop_reason === 'tool_use') {
        const toolResults: Anthropic.MessageParam = {
          role: 'user',
          content: [],
        }

        for (const block of response.content) {
          if (block.type === 'tool_use') {
            log(`\n🔧 Tool: ${block.name}`)
            log(`📋 Input: ${JSON.stringify(block.input, null, 2)}`)

            let result: string
            let isError = false

            try {
              const input = block.input as any
              switch (block.name) {
                case 'bash':
                  result = await executeBash(input.command)
                  break
                case 'read_file':
                  result = await readFile(input.file_path)
                  break
                case 'write_file':
                  result = await writeFile(input.file_path, input.content)
                  break
                case 'edit_file':
                  result = await editFile(
                    input.file_path,
                    input.old_string,
                    input.new_string
                  )
                  break
                default:
                  result = `Unknown tool: ${block.name}`
                  isError = true
              }
            } catch (error: any) {
              result = `Error: ${error.message}`
              isError = true
            }

            log(`✅ Result: ${result.substring(0, 500)}${result.length > 500 ? '...' : ''}`)

            ;(toolResults.content as any[]).push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: result,
              is_error: isError,
            })
          }
        }

        // Add assistant message and tool results to conversation
        messages.push({
          role: 'assistant',
          content: response.content,
        })
        messages.push(toolResults)
      } else {
        log(`\n⚠️  Unexpected stop_reason: ${response.stop_reason}`)
        conversationActive = false
      }

    } catch (error: any) {
      log(`\n❌ API Error: ${error.message}`)
      throw error
    }
  }

  if (turnCount >= MAX_TURNS) {
    log(`\n⚠️  Reached maximum turn limit (${MAX_TURNS})`)
  }

  log(`\n⏰ Completed at: ${new Date().toISOString()}`)
  log(`📊 Total turns: ${turnCount}`)
  logStream.end()
}

async function executeBash(command: string): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: PROJECT_ROOT,
      maxBuffer: 10 * 1024 * 1024, // 10MB
      timeout: 600000, // 10 minutes
    })

    let output = ''
    if (stdout) output += stdout
    if (stderr) output += '\nSTDERR:\n' + stderr

    return output || 'Command completed successfully (no output)'
  } catch (error: any) {
    return `Error executing command: ${error.message}\nStdout: ${error.stdout}\nStderr: ${error.stderr}`
  }
}

async function readFile(filePath: string): Promise<string> {
  try {
    // Make path absolute if relative
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(PROJECT_ROOT, filePath)

    if (!fs.existsSync(absolutePath)) {
      return `Error: File not found: ${absolutePath}`
    }

    const content = fs.readFileSync(absolutePath, 'utf-8')
    return content
  } catch (error: any) {
    return `Error reading file: ${error.message}`
  }
}

async function writeFile(filePath: string, content: string): Promise<string> {
  try {
    // Make path absolute if relative
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(PROJECT_ROOT, filePath)

    // Ensure directory exists
    const dir = path.dirname(absolutePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(absolutePath, content, 'utf-8')
    return `File written successfully: ${absolutePath}`
  } catch (error: any) {
    return `Error writing file: ${error.message}`
  }
}

async function editFile(filePath: string, oldString: string, newString: string): Promise<string> {
  try {
    // Make path absolute if relative
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(PROJECT_ROOT, filePath)

    if (!fs.existsSync(absolutePath)) {
      return `Error: File not found: ${absolutePath}`
    }

    const content = fs.readFileSync(absolutePath, 'utf-8')

    if (!content.includes(oldString)) {
      return `Error: String not found in file. Looking for:\n${oldString}`
    }

    const newContent = content.replace(oldString, newString)
    fs.writeFileSync(absolutePath, newContent, 'utf-8')

    return `File edited successfully: ${absolutePath}`
  } catch (error: any) {
    return `Error editing file: ${error.message}`
  }
}

function loadAnalysis(): ProjectAnalysis | null {
  try {
    if (!fs.existsSync(CURRENT_ANALYSIS)) {
      return null
    }

    const data = fs.readFileSync(CURRENT_ANALYSIS, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Error loading analysis:', error)
    return null
  }
}

function ensureDirectories() {
  const dirs = [ANALYSIS_DIR, PROMPTS_DIR, LOGS_DIR]

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }
}

function isLocked(): boolean {
  return fs.existsSync(LOCK_FILE)
}

function isLockStale(): boolean {
  if (!fs.existsSync(LOCK_FILE)) {
    return false
  }

  const stats = fs.statSync(LOCK_FILE)
  const ageMs = Date.now() - stats.mtimeMs
  const ageHours = ageMs / (1000 * 60 * 60)

  return ageHours > MAX_LOCK_AGE_HOURS
}

function createLock() {
  const lockData = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    host: require('os').hostname(),
  }

  fs.writeFileSync(LOCK_FILE, JSON.stringify(lockData, null, 2))
}

function removeLock() {
  if (fs.existsSync(LOCK_FILE)) {
    fs.unlinkSync(LOCK_FILE)
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Execution interrupted by user')
  removeLock()
  process.exit(130)
})

process.on('SIGTERM', () => {
  console.log('\n\n⚠️  Execution terminated')
  removeLock()
  process.exit(143)
})

// Run
main().catch((error) => {
  console.error('\n❌ Fatal error:', error)
  removeLock()
  process.exit(1)
})
