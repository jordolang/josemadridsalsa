// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { buildMime, parseMailMessage, summarizeThread } from '@/lib/inbox/mailbox'

const b64url = (s: string) => Buffer.from(s).toString('base64url')

describe('buildMime', () => {
  const mail = { to: ['a@x.com'], cc: [], bcc: [], subject: 'Hi', body: 'Hello', attachments: [] }

  it('threads a reply and strips header injection', () => {
    const mime = buildMime('mike@josemadridsalsa.com', {
      ...mail,
      subject: 'Re: Order\r\nBcc: evil@x.com',
      inReplyTo: '<abc@mail>',
      references: '<root@mail>',
    })
    expect(mime).toContain('In-Reply-To: <abc@mail>')
    expect(mime).toContain('References: <root@mail>')
    expect(mime).not.toMatch(/\r\nBcc: evil/)
  })

  it('encodes a non-ASCII subject and builds multipart with attachments', () => {
    const mime = buildMime('mike@josemadridsalsa.com', {
      ...mail,
      subject: 'José',
      attachments: [{ filename: 'menu.pdf', mimeType: 'application/pdf', data: Buffer.from('pdf').toString('base64') }],
    })
    expect(mime).toContain(`Subject: =?UTF-8?B?${Buffer.from('José').toString('base64')}?=`)
    expect(mime).toMatch(/Content-Type: multipart\/mixed; boundary="jms_/)
    expect(mime).toContain('Content-Disposition: attachment; filename="menu.pdf"')
  })
})

describe('parsing', () => {
  it('finds html, text and attachments in nested parts', () => {
    const message = parseMailMessage({
      id: 'm1',
      internalDate: '1700000000000',
      labelIds: ['INBOX'],
      payload: {
        mimeType: 'multipart/mixed',
        headers: [{ name: 'From', value: 'Pat <pat@x.com>' }, { name: 'Subject', value: 'Order' }],
        parts: [
          { mimeType: 'multipart/alternative', parts: [
            { mimeType: 'text/plain', body: { data: b64url('plain') } },
            { mimeType: 'text/html', body: { data: b64url('<b>html</b>') } },
          ] },
          { mimeType: 'application/pdf', filename: 'inv.pdf', body: { attachmentId: 'A1', size: 10 } },
        ],
      },
    })
    expect(message).toMatchObject({ text: 'plain', html: '<b>html</b>', subject: 'Order' })
    expect(message.attachments).toEqual([{ attachmentId: 'A1', filename: 'inv.pdf', mimeType: 'application/pdf', size: 10 }])
  })

  it('summarizes a thread by its first subject and latest sender', () => {
    const summary = summarizeThread({
      id: 't1',
      messages: [
        { id: 'a', labelIds: ['INBOX'], internalDate: '1', payload: { headers: [{ name: 'Subject', value: 'First' }, { name: 'From', value: 'a@x.com' }] } },
        { id: 'b', labelIds: ['UNREAD'], internalDate: '2', snippet: 'latest', payload: { headers: [{ name: 'From', value: 'Bo <b@x.com>' }] } },
      ],
    })
    expect(summary).toMatchObject({ subject: 'First', from: 'Bo', snippet: 'latest', unread: true, messageCount: 2 })
  })
})
