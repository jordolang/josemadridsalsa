import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import {
  checkCredentialAccess,
  encryptCredentialPassword,
  getGrantPermissions,
} from '@/lib/credentials'
import Papa from 'papaparse'
import ExcelJS from 'exceljs'

interface ImportRow {
  provider?: string
  serviceName?: string
  label?: string
  username?: string
  email?: string
  password?: string
  url?: string
  notes?: string
}

function normalizeRow(raw: Record<string, any>): ImportRow {
  const keys = Object.keys(raw)
  const find = (candidates: string[]): string | undefined => {
    for (const c of candidates) {
      const match = keys.find((k) => k.toLowerCase().trim() === c.toLowerCase())
      if (match && raw[match]) return String(raw[match]).trim()
    }
    return undefined
  }

  return {
    provider: find(['provider', 'servicename', 'service_name', 'service name', 'service']),
    label: find(['label', 'description', 'name', 'account name', 'account']),
    username: find(['username', 'email', 'user', 'login', 'user email', 'account email']),
    password: find(['password', 'pass', 'secret', 'credential']),
    url: find(['url', 'website', 'site', 'link', 'login url']),
    notes: find(['notes', 'note', 'comments', 'comment', 'description']),
  }
}

async function parseCSV(text: string): Promise<Record<string, any>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data as Record<string, any>[]),
      error: (err: any) => reject(new Error(err.message)),
    })
  })
}

async function parseXLSX(buffer: ArrayBuffer): Promise<Record<string, any>[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as any)
  const worksheet = workbook.worksheets[0]
  if (!worksheet) throw new Error('No worksheet found in file')

  const rows: Record<string, any>[] = []
  const headers: string[] = []

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell) => {
        headers.push(String(cell.value || '').trim())
      })
    } else {
      const rowData: Record<string, any> = {}
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1]
        if (header) {
          rowData[header] = cell.value
        }
      })
      if (Object.keys(rowData).length > 0) {
        rows.push(rowData)
      }
    }
  })

  return rows
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await requirePermission('credentials:write')

    const accessLevel = await checkCredentialAccess(currentUser.email, currentUser.role)
    if (accessLevel !== 'write') {
      return fail('Forbidden - write access required', 403)
    }

    const grantPerms = await getGrantPermissions(currentUser.email)
    if (!grantPerms?.canUpload) {
      return fail('Forbidden - upload permission required', 403)
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) {
      return fail('No file provided', 400)
    }

    const fileName = file.name.toLowerCase()
    let rawRows: Record<string, any>[]

    if (fileName.endsWith('.csv')) {
      const text = await file.text()
      rawRows = await parseCSV(text)
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const buffer = await file.arrayBuffer()
      rawRows = await parseXLSX(buffer)
    } else {
      return fail('Unsupported file format. Please upload a .csv or .xlsx file.', 400)
    }

    if (rawRows.length === 0) {
      return fail('File contains no data rows', 400)
    }

    const results: { row: number; status: 'success' | 'error'; error?: string }[] = []
    let successCount = 0
    let errorCount = 0
    const now = new Date()

    for (let i = 0; i < rawRows.length; i++) {
      try {
        const normalized = normalizeRow(rawRows[i])
        const serviceName = normalized.provider
        if (!serviceName) {
          throw new Error('Missing provider/service name')
        }

        const label = normalized.label || 'Default'
        const password = normalized.password || ''
        const encFields = password
          ? encryptCredentialPassword(password)
          : { encValue: '', encIv: '', encTag: '' }

        await prisma.serviceCredential.create({
          data: {
            serviceName,
            label,
            username: normalized.username || null,
            encValue: encFields.encValue,
            encIv: encFields.encIv,
            encTag: encFields.encTag,
            url: normalized.url || null,
            notes: normalized.notes || null,
            createdById: currentUser.id,
            passwordChangedAt: password ? now : null,
          },
        })

        results.push({ row: i + 1, status: 'success' })
        successCount++
      } catch (err: any) {
        results.push({ row: i + 1, status: 'error', error: err.message })
        errorCount++
      }
    }

    await logAudit({
      userId: currentUser.id,
      action: 'IMPORT',
      entityType: 'ServiceCredential',
      changes: {
        totalRows: rawRows.length,
        successCount,
        errorCount,
        fileName: file.name,
      },
    })

    return ok({
      totalRows: rawRows.length,
      successCount,
      errorCount,
      results,
    })
  } catch (error: any) {
    return fail(error.message, 400)
  }
}
