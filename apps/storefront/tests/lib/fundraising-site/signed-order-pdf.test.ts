import { describe, expect, it, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'

vi.mock('server-only', () => ({}))

import { orderSubmissionSchema } from '@/lib/fundraising-site/order-submission'
import { buildSignedOrderPdf, signedOrderPathname } from '@/lib/fundraising-site/signed-order-pdf'

const order = orderSubmissionSchema.parse({
  kit: '25',
  organizationName: 'Lincoln Elementary PTO',
  contactName: 'Pat Smith',
  email: 'pat@example.com',
  phone: '740-555-1212',
  shipName: 'Lincoln Elementary',
  shipStreet: '1 Main St',
  shipCity: 'Zanesville',
  shipState: 'OH',
  shipZip: '43701',
  quantities: { raspberry: 12, 'ghost-of-clovis': 3 },
  paymentMethod: 'check',
  notes: 'Front office, please.',
  confirmFinal: true,
  signature:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEElEQVR4nGNgYGD4D8UQBgAd9AP9yOH2qAAAAABJRU5ErkJggg==',
})

describe('signed order PDF', () => {
  it('files by Eastern date and organization', () => {
    // 01:30 UTC on Oct 1 is still Sept 30 in Zanesville.
    expect(signedOrderPathname(order, new Date('2026-10-01T01:30:00Z'))).toBe(
      'fundraising/order-submissions/2026/09/2026-09-30-lincoln-elementary-pto.pdf',
    )
  })

  it('renders the order with its signature', async () => {
    const bytes = await buildSignedOrderPdf(order, {
      submittedAt: new Date('2026-10-01T15:00:00Z'),
      reference: 'C12345XY',
      ipAddress: '203.0.113.9',
    })
    const pdf = await PDFDocument.load(bytes)
    expect(pdf.getTitle()).toBe('Final Fundraiser Order - Lincoln Elementary PTO')
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1)
  })
})
