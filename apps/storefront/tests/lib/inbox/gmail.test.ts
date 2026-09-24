import { describe, expect, it } from 'vitest'

import {
  buildReplyMime,
  extractBody,
  gmailThreadUrl,
  headerValue,
  parseAddress,
  parseGmailMessage,
} from '@/lib/inbox/gmail'

/** Base64url, the way Gmail returns part bodies. */
function encode(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

describe('parseAddress', () => {
  it('splits a display name from the address', () => {
    expect(parseAddress('Jane Doe <Jane@Example.COM>')).toEqual({
      email: 'jane@example.com',
      name: 'Jane Doe',
    })
  })

  it('handles a quoted display name', () => {
    expect(parseAddress('"Doe, Jane" <jane@example.com>')).toEqual({
      email: 'jane@example.com',
      name: 'Doe, Jane',
    })
  })

  it('handles a bare address', () => {
    expect(parseAddress('jane@example.com')).toEqual({ email: 'jane@example.com', name: null })
  })

  it('survives a missing header', () => {
    expect(parseAddress(null)).toEqual({ email: '', name: null })
  })
})

describe('headerValue', () => {
  it('matches case-insensitively, because senders do not agree on casing', () => {
    const headers = [{ name: 'message-id', value: '<abc@mail>' }]
    expect(headerValue(headers, 'Message-ID')).toBe('<abc@mail>')
  })

  it('returns null rather than undefined when absent', () => {
    expect(headerValue([], 'Subject')).toBeNull()
    expect(headerValue(undefined, 'Subject')).toBeNull()
  })
})

describe('extractBody', () => {
  it('prefers text/plain', () => {
    const payload = {
      mimeType: 'multipart/alternative',
      parts: [
        { mimeType: 'text/plain', body: { data: encode('the plain one') } },
        { mimeType: 'text/html', body: { data: encode('<p>the html one</p>') } },
      ],
    }

    expect(extractBody(payload)).toBe('the plain one')
  })

  it('walks nested parts, as a message with an attachment produces', () => {
    const payload = {
      mimeType: 'multipart/mixed',
      parts: [
        {
          mimeType: 'multipart/alternative',
          parts: [{ mimeType: 'text/plain', body: { data: encode('buried but found') } }],
        },
        { mimeType: 'image/png', body: { attachmentId: 'x' } },
      ],
    }

    expect(extractBody(payload)).toBe('buried but found')
  })

  it('falls back to stripped html when there is no plain part', () => {
    const payload = {
      mimeType: 'text/html',
      body: { data: encode('<p>Hi&nbsp;there</p><p>Second &amp; last</p>') },
    }

    expect(extractBody(payload)).toBe('Hi there\n\nSecond & last')
  })

  it('returns an empty string rather than throwing on an empty payload', () => {
    expect(extractBody(undefined)).toBe('')
    expect(extractBody({})).toBe('')
  })
})

describe('parseGmailMessage', () => {
  it('reads the fields the triage depends on', () => {
    const message = parseGmailMessage({
      id: 'm1',
      threadId: 't1',
      labelIds: ['INBOX'],
      snippet: 'Where is my order',
      internalDate: '1750000000000',
      payload: {
        headers: [
          { name: 'From', value: 'Jane <jane@example.com>' },
          { name: 'To', value: 'mike@josemadridsalsa.com' },
          { name: 'Subject', value: 'Order JMS-1043' },
          { name: 'Message-ID', value: '<abc@mail>' },
        ],
        mimeType: 'text/plain',
        body: { data: encode('Where is it?') },
      },
    })

    expect(message).toMatchObject({
      id: 'm1',
      threadId: 't1',
      fromEmail: 'jane@example.com',
      fromName: 'Jane',
      toEmail: 'mike@josemadridsalsa.com',
      subject: 'Order JMS-1043',
      body: 'Where is it?',
      rfcMessageId: '<abc@mail>',
    })
    expect(message?.receivedAt.getTime()).toBe(1750000000000)
  })

  it('uses internalDate rather than a sender-supplied Date header', () => {
    const message = parseGmailMessage({
      id: 'm1',
      threadId: 't1',
      internalDate: '1750000000000',
      payload: {
        headers: [
          { name: 'From', value: 'jane@example.com' },
          { name: 'Date', value: 'Tue, 01 Jan 1980 00:00:00 +0000' },
        ],
      },
    })

    expect(message?.receivedAt.getTime()).toBe(1750000000000)
  })

  it('returns null for a message with no id', () => {
    expect(parseGmailMessage({ threadId: 't1' })).toBeNull()
  })
})

describe('buildReplyMime', () => {
  const base = {
    fromMailbox: 'mike@josemadridsalsa.com',
    toEmail: 'jane@example.com',
    body: 'Thanks for writing.\n\n— Jose Madrid Salsa',
    inReplyTo: '<abc@mail>',
    references: null,
  }

  it('threads the reply with both headers Gmail needs', () => {
    const mime = buildReplyMime({ ...base, subject: 'Order JMS-1043' })

    expect(mime).toContain('In-Reply-To: <abc@mail>')
    expect(mime).toContain('References: <abc@mail>')
    expect(mime).toContain('Subject: Re: Order JMS-1043')
  })

  it('does not double up the Re: prefix', () => {
    const mime = buildReplyMime({ ...base, subject: 'Re: Order JMS-1043' })

    expect(mime).toContain('Subject: Re: Order JMS-1043')
    expect(mime).not.toContain('Re: Re:')
  })

  it('keeps an existing References chain rather than truncating it', () => {
    const mime = buildReplyMime({
      ...base,
      subject: 'Hi',
      references: '<one@mail> <two@mail>',
    })

    expect(mime).toContain('References: <one@mail> <two@mail>')
  })

  it('omits the threading headers when there is nothing to thread to', () => {
    const mime = buildReplyMime({ ...base, subject: 'Hi', inReplyTo: null })

    expect(mime).not.toContain('In-Reply-To')
  })

  it('encodes a non-ASCII subject so it does not arrive as mojibake', () => {
    const mime = buildReplyMime({ ...base, subject: 'Pregunta sobre jalapeño' })

    expect(mime).toContain('Subject: =?UTF-8?B?')
  })

  it('separates headers from the body with a blank line', () => {
    const mime = buildReplyMime({ ...base, subject: 'Hi' })

    expect(mime).toContain('\r\n\r\nThanks for writing.')
  })
})

describe('gmailThreadUrl', () => {
  it('points at the thread a human can open', () => {
    expect(gmailThreadUrl('t1')).toBe('https://mail.google.com/mail/u/0/#all/t1')
  })
})
