'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import {
  saveGoogleAnalyticsSettings,
  addGoogleAnalyticsChartDefinition,
  deleteGoogleAnalyticsChartDefinition,
  GOOGLE_ANALYTICS_CHART_COLORS,
} from '@/lib/google-analytics-config'
import type { GoogleAnalyticsChartType } from '@/types/analytics'

const REQUIRED_PERMISSION = 'analytics:export'

export type GoogleAnalyticsActionResult =
  | { success: true }
  | { error: string }

function coerceChartType(value: string | null): GoogleAnalyticsChartType {
  if (value === 'bar' || value === 'pie' || value === 'line') {
    return value
  }
  return 'line'
}

export async function saveGoogleAnalyticsSettingsAction(
  formData: FormData,
): Promise<GoogleAnalyticsActionResult> {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, REQUIRED_PERMISSION))) {
    return { error: 'Unauthorized' }
  }

  const measurementId = String(formData.get('measurementId') || '').trim()
  const propertyId = String(formData.get('propertyId') || '').trim()
  const dataStreamId = String(formData.get('dataStreamId') || '').trim()

  try {
    await saveGoogleAnalyticsSettings({
      measurementId: measurementId || null,
      propertyId: propertyId || null,
      dataStreamId: dataStreamId || null,
      updatedBy: user.id,
    })
  } catch (error) {
    return { error: 'Failed to save Google Analytics settings' }
  }

  revalidatePath('/admin/analytics')
  return { success: true }
}

export async function addGoogleAnalyticsChartAction(
  formData: FormData,
): Promise<GoogleAnalyticsActionResult> {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, REQUIRED_PERMISSION))) {
    return { error: 'Unauthorized' }
  }

  const title = String(formData.get('title') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const metric = String(formData.get('metric') || '').trim()
  const dimension = String(formData.get('dimension') || '').trim()
  const chartType = coerceChartType(String(formData.get('chartType') || '').trim())
  const limitValue = formData.get('limit')
  const colorRaw = String(formData.get('color') || '').trim()
  const color = (GOOGLE_ANALYTICS_CHART_COLORS.find((option) => option.value === colorRaw)?.value) ?? 'indigo'

  if (!metric || !dimension) {
    return { error: 'Metric and dimension are required for a custom chart' }
  }

  const limit = limitValue ? Number(limitValue) : null

  try {
    await addGoogleAnalyticsChartDefinition({
      title,
      description: description || null,
      metric,
      dimension,
      chartType,
      limit: limit && Number.isFinite(limit) ? limit : null,
      color,
      updatedBy: user.id,
    })
  } catch (error) {
    return { error: 'Failed to add Google Analytics chart' }
  }

  revalidatePath('/admin/analytics')
  return { success: true }
}

export async function deleteGoogleAnalyticsChartAction(
  formData: FormData,
): Promise<GoogleAnalyticsActionResult> {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, REQUIRED_PERMISSION))) {
    return { error: 'Unauthorized' }
  }

  const chartId = String(formData.get('chartId') || '').trim()
  if (!chartId) {
    return { error: 'Chart ID is required' }
  }

  try {
    await deleteGoogleAnalyticsChartDefinition(chartId, user.id)
  } catch (error) {
    return { error: 'Failed to delete Google Analytics chart' }
  }

  revalidatePath('/admin/analytics')
  return { success: true }
}
