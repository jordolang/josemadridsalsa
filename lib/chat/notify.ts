import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email/sender'

type HandoffNotifyInput = {
  threadId: string
  customerName?: string | null
  customerEmail?: string | null
  preview?: string | null
  source?: string | null
  offline?: boolean
}

const SUBJECT_PREFIX = 'Jose Madrid Salsa'

export async function notifyAdminsOfHandoff(input: HandoffNotifyInput): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'STAFF', 'DEVELOPER'] }, isActive: true },
    select: { email: true, name: true },
  })

  if (admins.length === 0) return

  const subject = input.offline
    ? `${SUBJECT_PREFIX}: After-hours chat request`
    : `${SUBJECT_PREFIX}: A visitor is asking to chat with a human`

  const name = input.customerName?.trim() || 'A site visitor'
  const emailLine = input.customerEmail ? `Reply-to: ${input.customerEmail}` : ''
  const sourceLine = input.source ? `Source: ${input.source}` : ''
  const previewLine = input.preview ? `Message: ${input.preview.slice(0, 500)}` : ''
  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/admin/messages/live`

  const text = [
    `${name} ${input.offline ? 'left a message after hours' : 'is waiting to chat live'}.`,
    emailLine,
    sourceLine,
    previewLine,
    '',
    `Open the live queue: ${url}`,
  ]
    .filter(Boolean)
    .join('\n')

  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, sans-serif; line-height: 1.5;">
      <h2 style="margin:0 0 12px;">${name} ${input.offline ? 'left a message after hours' : 'is waiting to chat live'}</h2>
      ${emailLine ? `<p><strong>Reply-to:</strong> ${input.customerEmail}</p>` : ''}
      ${sourceLine ? `<p><strong>Source:</strong> ${input.source}</p>` : ''}
      ${previewLine ? `<blockquote style="border-left:3px solid #ddd;padding:8px 12px;color:#555;">${input.preview}</blockquote>` : ''}
      <p><a href="${url}" style="background:#dc2626;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">Open live queue</a></p>
    </div>
  `

  await Promise.all(
    admins.map((admin) =>
      sendEmail({ to: admin.email, subject, html, text }).catch((error) => {
        console.error('[chat-handoff] admin email failed', { to: admin.email, error })
      }),
    ),
  )
}
