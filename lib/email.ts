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

export async function sendPasswordResetEmail(email: string, token: string) {
  if (!resendApiKey) {
    console.warn('RESEND_API_KEY not set; skipping password reset email')
    return { skipped: true }
  }

  try {
    const resend = new Resend(resendApiKey)
    const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}`

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Reset Your Password</h1>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hello,</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              We received a request to reset the password for your Jose Madrid Salsa account. 
              Click the button below to create a new password:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background: #dc2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px;">
                Reset Password
              </a>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin-bottom: 20px;">
              Or copy and paste this link into your browser:
            </p>
            <p style="font-size: 14px; color: #3b82f6; word-break: break-all; margin-bottom: 20px;">
              ${resetUrl}
            </p>
            
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                <strong>⏰ This link will expire in 1 hour</strong> for security reasons.
              </p>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
              If you didn't request a password reset, you can safely ignore this email. 
              Your password will not be changed.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
              Jose Madrid Salsa<br>
              This is an automated message, please do not reply.
            </p>
          </div>
        </body>
      </html>
    `

    const res = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: 'Reset Your Password - Jose Madrid Salsa',
      html,
    })
    return res
  } catch (e) {
    console.error('Failed to send password reset email', e)
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
