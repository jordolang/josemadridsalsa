import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { RecordSheet } from '@/components/admin-desktop/record-sheet'

/**
 * The sheet is the one form the whole window uses, so the things worth pinning
 * are the ones every form inherits: that a description turns into inputs, that
 * a picker's choices are fetched rather than shipped, that a wall-clock time
 * becomes an instant exactly once, and that a server refusal lands on the field
 * that caused it instead of disappearing.
 */

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const body = handler(url, init)
    return { ok: true, status: 200, json: async () => body } as Response
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('drawing a form from its description', () => {
  it('renders every field in the spec, with the record it was given filled in', async () => {
    mockFetch(() => ({ options: [] }))

    render(
      <RecordSheet
        request={{
          form: 'customer.edit',
          recordId: 'c1',
          title: 'Vera Ortiz',
          values: { email: 'vera@example.com', firstName: 'Vera', accountType: 'WHOLESALE' },
        }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'Vera Ortiz' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Email/)).toHaveValue('vera@example.com')
    expect(screen.getByLabelText(/First name/)).toHaveValue('Vera')
    expect(screen.getByLabelText(/Account type/)).toHaveValue('WHOLESALE')
    // A field the loader had nothing for opens blank rather than undefined.
    expect(screen.getByLabelText(/Phone/)).toHaveValue('')
  })

  it('opens a create sheet on the spec’s own defaults', () => {
    mockFetch(() => ({ options: [] }))

    render(<RecordSheet request={{ form: 'fundraiser.create' }} onClose={vi.fn()} onSaved={vi.fn()} />)

    // The house split and the standard jar price, so the common campaign is
    // one where nobody has to remember either number.
    expect(screen.getByLabelText(/Group’s share/)).toHaveValue(50)
    expect(screen.getByLabelText(/Price per jar/)).toHaveValue(10)
    expect(screen.getByLabelText(/Status/)).toHaveValue('DRAFT')
  })

  it('fetches the choices behind a picker instead of shipping them', async () => {
    const fetchMock = mockFetch(() => ({
      options: [{ value: 'cat1', label: 'Salsas' }],
    }))

    render(<RecordSheet request={{ form: 'product.create' }} onClose={vi.fn()} onSaved={vi.fn()} />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/desktop/options/categories', expect.anything())
    })

    const category = screen.getByLabelText(/Category/) as HTMLSelectElement
    await waitFor(() => {
      expect([...category.options].map((option) => option.textContent)).toContain('Salsas')
    })

    // Heat is an enum, so it needs no round trip at all.
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/admin/desktop/options/heatLevel',
      expect.anything(),
    )
  })

  it('carries on with an empty picker when the option list cannot be built', async () => {
    // An options endpoint that fails should cost the operator one dropdown, not
    // the whole sheet.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )

    render(<RecordSheet request={{ form: 'product.create' }} onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(await screen.findByLabelText(/Name/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Category/)).toBeInTheDocument()
  })
})

describe('the slug that follows its source', () => {
  it('fills in from the name until somebody types over it', async () => {
    mockFetch(() => ({ options: [] }))
    const user = userEvent.setup()

    render(<RecordSheet request={{ form: 'fundraiser.create' }} onClose={vi.fn()} onSaved={vi.fn()} />)

    await user.type(screen.getByLabelText(/Campaign name/), 'Ridgewood Band 2026')
    expect(screen.getByLabelText(/URL slug/)).toHaveValue('ridgewood-band-2026')

    // Once it has been edited by hand it stops following, because the operator
    // has said what they want the URL to be.
    await user.clear(screen.getByLabelText(/URL slug/))
    await user.type(screen.getByLabelText(/URL slug/), 'ridgewood')
    await user.type(screen.getByLabelText(/Campaign name/), ' Fall')
    expect(screen.getByLabelText(/URL slug/)).toHaveValue('ridgewood')
  })
})

describe('saving', () => {
  it('posts the operation, the record and the values to the one write route', async () => {
    const fetchMock = mockFetch((url) =>
      url.includes('/write') ? { ok: true, message: 'Vera saved', recordId: 'c1' } : { options: [] },
    )
    const onSaved = vi.fn()
    const user = userEvent.setup()

    render(
      <RecordSheet
        request={{
          form: 'customer.edit',
          recordId: 'c1',
          values: { email: 'vera@example.com', accountType: 'STANDARD' },
        }}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Save customer' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('Vera saved', 'c1'))

    const write = fetchMock.mock.calls.find(([url]) => String(url).includes('/write'))
    const body = JSON.parse(String((write?.[1] as RequestInit).body))
    expect(body.op).toBe('customer.edit')
    expect(body.recordId).toBe('c1')
    expect(body.values.email).toBe('vera@example.com')
  })

  it('converts a wall-clock time into an instant exactly once', async () => {
    // The input shows the operator's own clock; the server stores an instant.
    // Doing the conversion anywhere but here would shift a scheduled send by
    // the offset every time the sheet was reopened and saved.
    const fetchMock = mockFetch((url) =>
      url.includes('/write')
        ? { ok: true, message: 'Saved' }
        : url.includes('emailTemplates')
          ? { options: [{ value: 't1', label: 'Newsletter' }] }
          : { options: [] },
    )
    const user = userEvent.setup()

    render(<RecordSheet request={{ form: 'campaign.create' }} onClose={vi.fn()} onSaved={vi.fn()} />)

    await user.type(screen.getByLabelText(/Internal name/), 'Autumn')
    await user.type(screen.getByLabelText(/Subject line/), 'Autumn heat')

    const template = screen.getByLabelText(/Template/) as HTMLSelectElement
    await waitFor(() => expect(template.options.length).toBeGreaterThan(1))
    await user.selectOptions(template, 't1')

    await user.type(screen.getByLabelText(/Send at/), '2026-10-01T09:30')
    await user.click(screen.getByRole('button', { name: 'Create campaign' }))

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/write'))).toBe(true)
    })

    const write = fetchMock.mock.calls.find(([url]) => String(url).includes('/write'))
    const body = JSON.parse(String((write?.[1] as RequestInit).body))
    expect(body.values.scheduledAt).toBe(new Date('2026-10-01T09:30').toISOString())
  })

  it('shows a refusal and marks the field the server blamed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (!url.includes('/write')) return { ok: true, json: async () => ({ options: [] }) } as Response
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: 'Another record already uses that email.', field: 'email' }),
        } as Response
      }),
    )
    const onSaved = vi.fn()
    const user = userEvent.setup()

    render(
      <RecordSheet
        request={{
          form: 'customer.edit',
          recordId: 'c1',
          values: { email: 'taken@example.com', accountType: 'STANDARD' },
        }}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Save customer' }))

    expect(await screen.findByText('Another record already uses that email.')).toBeInTheDocument()
    // The sheet stays open with what was typed still in it.
    expect(onSaved).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/Email/)).toHaveValue('taken@example.com')
  })

  it('says so when the server cannot be reached at all', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('/write')) throw new Error('offline')
        return { ok: true, json: async () => ({ options: [] }) } as Response
      }),
    )
    const user = userEvent.setup()

    render(
      <RecordSheet
        request={{
          form: 'customer.edit',
          recordId: 'c1',
          values: { email: 'vera@example.com', accountType: 'STANDARD' },
        }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Save customer' }))
    expect(await screen.findByText(/Could not reach the server/)).toBeInTheDocument()
  })
})

describe('line items', () => {
  it('adds and removes rows, and fills a line’s price from the product picked', async () => {
    mockFetch((url) =>
      url.includes('/options/products')
        ? { options: [{ value: 'p1', label: 'Peach', hint: 'JMS-PCH-16 · $11.95' }] }
        : { options: [] },
    )
    const user = userEvent.setup()

    render(<RecordSheet request={{ form: 'order.create' }} onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(screen.getByText('No lines yet.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Add a line/ }))

    // Picking the product carries its catalogue price across, so the common
    // case is one click rather than looking the number up.
    const line = screen.getByRole('combobox', { name: 'Product, line 1' }) as HTMLSelectElement
    await waitFor(() => expect(line.options.length).toBeGreaterThan(1))
    await user.selectOptions(line, 'p1')

    await waitFor(() => {
      expect(screen.getByDisplayValue('11.95')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Remove line 1' }))
    expect(screen.getByText('No lines yet.')).toBeInTheDocument()
  })
})

describe('closing', () => {
  it('closes on Escape without saving', async () => {
    mockFetch(() => ({ options: [] }))
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<RecordSheet request={{ form: 'customer.create' }} onClose={onClose} onSaved={vi.fn()} />)

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})
