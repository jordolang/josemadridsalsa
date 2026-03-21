'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasAnyPermission } from '@/lib/rbac'
import { parseCSV, parseTextList, sendCampaign } from '@/lib/email/sender'

export async function createCampaign(formData: FormData) {
  const user = await getCurrentUser()
  
  if (!user || !(await hasAnyPermission(user, ['content:write']))) {
    return { error: 'Unauthorized' }
  }
  
  try {
    const name = formData.get('name') as string
    const templateId = formData.get('templateId') as string
    const subject = formData.get('subject') as string
    const recipientsSource = formData.get('recipientsSource') as string // 'csv' | 'text' | 'paste' | 'list'
    const recipientsData = formData.get('recipientsData') as string
    const listId = formData.get('listId') as string | null
    
    if (!name || !templateId || !subject) {
      return { error: 'Missing required fields' }
    }
    
    // Verify template exists
    const template = await prisma.emailTemplate.findUnique({
      where: { id: templateId },
    })
    
    if (!template) {
      return { error: 'Template not found' }
    }
    
    // Parse recipients
    let recipientsList: Array<{ email: string; name?: string; variables?: Record<string, any> }> = []
    let parseErrors: string[] = []
    
    if (recipientsSource === 'list') {
      if (!listId) {
        return { error: 'Mailing list required' }
      }
      const list = await prisma.mailingList.findUnique({
        where: { id: listId },
        include: {
          subscribers: {
            where: { status: 'SUBSCRIBED' },
          },
        },
      })
      if (!list) {
        return { error: 'Mailing list not found' }
      }
      recipientsList = list.subscribers.map((s) => ({
        email: s.email,
        name: [s.firstName, s.lastName].filter(Boolean).join(' ') || undefined,
        variables: {},
      }))
    } else if (recipientsSource === 'csv') {
      const parsed = parseCSV(recipientsData)
      recipientsList = parsed.recipients
      parseErrors = parsed.errors
    } else if (recipientsSource === 'text' || recipientsSource === 'paste') {
      const parsed = parseTextList(recipientsData)
      recipientsList = parsed.recipients
      parseErrors = parsed.errors
    }
    
    if (recipientsList.length === 0) {
      return { error: 'No valid recipients found', parseErrors }
    }
    
    // Create campaign
    const campaign = await prisma.emailCampaign.create({
      data: {
        name,
        templateId,
        subject,
        status: 'DRAFT',
        listId: recipientsSource === 'list' && listId ? listId : null,
        totalRecipients: recipientsList.length,
        createdById: user.id,
        recipients: {
          create: recipientsList.map((r) => ({
            email: r.email,
            name: r.name,
            variables: r.variables,
            status: 'PENDING',
          })),
        },
      },
    })
    
    revalidatePath('/admin/email-campaigns')
    
    return {
      success: true,
      campaignId: campaign.id,
      recipientsCount: recipientsList.length,
      parseErrors: parseErrors.length > 0 ? parseErrors : undefined,
    }
  } catch (error) {
    console.error('Error creating campaign:', error)
    return { error: 'Failed to create campaign' }
  }
}

export async function launchCampaign(campaignId: string) {
  const user = await getCurrentUser()
  
  if (!user || !(await hasAnyPermission(user, ['content:write']))) {
    return { error: 'Unauthorized' }
  }
  
  try {
    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: campaignId },
    })
    
    if (!campaign) {
      return { error: 'Campaign not found' }
    }
    
    if (campaign.status !== 'DRAFT') {
      return { error: 'Campaign must be in DRAFT status to launch' }
    }
    
    // Launch campaign asynchronously
    // In production, you'd use a background job queue
    sendCampaign({ campaignId }).catch((error) => {
      console.error('Campaign send error:', error)
    })
    
    revalidatePath('/admin/email-campaigns')
    revalidatePath(`/admin/email-campaigns/${campaignId}`)
    
    return { success: true }
  } catch (error) {
    console.error('Error launching campaign:', error)
    return { error: 'Failed to launch campaign' }
  }
}

export async function deleteCampaign(campaignId: string) {
  const user = await getCurrentUser()
  
  if (!user || !(await hasAnyPermission(user, ['content:write']))) {
    return { error: 'Unauthorized' }
  }
  
  try {
    await prisma.emailCampaign.delete({
      where: { id: campaignId },
    })
    
    revalidatePath('/admin/email-campaigns')
    
    return { success: true }
  } catch (error) {
    console.error('Error deleting campaign:', error)
    return { error: 'Failed to delete campaign' }
  }
}

export async function pauseCampaign(campaignId: string) {
  const user = await getCurrentUser()
  
  if (!user || !(await hasAnyPermission(user, ['content:write']))) {
    return { error: 'Unauthorized' }
  }
  
  try {
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: 'PAUSED' },
    })
    
    revalidatePath('/admin/email-campaigns')
    revalidatePath(`/admin/email-campaigns/${campaignId}`)
    
    return { success: true }
  } catch (error) {
    console.error('Error pausing campaign:', error)
    return { error: 'Failed to pause campaign' }
  }
}

export async function getCampaignStats(campaignId: string) {
  const user = await getCurrentUser()
  
  if (!user || !(await hasAnyPermission(user, ['content:read']))) {
    return { error: 'Unauthorized' }
  }
  
  try {
    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: campaignId },
      include: {
        template: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            recipients: true,
          },
        },
      },
    })
    
    if (!campaign) {
      return { error: 'Campaign not found' }
    }
    
    const statusCounts = await prisma.emailRecipient.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: true,
    })
    
    return {
      success: true,
      campaign,
      statusCounts: statusCounts.reduce((acc, curr) => {
        acc[curr.status] = curr._count
        return acc
      }, {} as Record<string, number>),
    }
  } catch (error) {
    console.error('Error getting campaign stats:', error)
    return { error: 'Failed to get campaign stats' }
  }
}
