import { Resend } from 'resend'

const resendApiKey = process.env.RESEND_API_KEY
const fromEmail = process.env.FROM_EMAIL || 'no-reply@example.com'

export async function sendAdminReplyEmail(to: string, subject: string, message: string) {
  if (!resendApiKey) {
    console.warn('RESEND_API_KEY not set; skipping email send')
    return { skipped: true }
  }

  try {
    const resend = new Resend(resendApiKey)

    // Try to load email template
    let finalSubject = subject || 'Reply from Jose Madrid Salsa'
    let html: string | undefined
    try {
      const { prisma } = await import('@/lib/prisma')
      const tpl = await prisma.emailTemplate.findUnique({ where: { key: 'admin_reply' } })
      if (tpl) {
        finalSubject = tpl.subject || finalSubject
        html = tpl.html.replace('{{message}}', escapeHtml(message))
      }
    } catch {}

    const res = await resend.emails.send({
      from: fromEmail,
      to,
      subject: finalSubject,
      ...(html ? { html } : { text: message }),
    })
    return res
  } catch (e) {
    console.error('Failed to send email', e)
    return { error: true }
  }
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
