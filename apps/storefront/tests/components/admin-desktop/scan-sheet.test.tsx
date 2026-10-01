import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ScanSheet } from '@/components/admin-desktop/scan-sheet'

const products = [
  { id: 'p1', name: 'Peach Mild', sku: 'JMS-FRUIT-003', barcode: '093662452874', inventory: 10 },
  { id: 'p2', name: 'Spanish Verde Hot', sku: 'JMS-HOT-010', barcode: '093662452959', inventory: 4 },
]

function setup() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ products }) }),
  )
  const postWrite = vi.fn().mockResolvedValue({ message: 'ok' })
  const onApplied = vi.fn()
  const onClose = vi.fn()
  render(<ScanSheet postWrite={postWrite} onApplied={onApplied} onClose={onClose} />)
  return { postWrite, onApplied, onClose }
}

async function scan(code: string) {
  const input = await screen.findByPlaceholderText(/Scan a barcode/)
  fireEvent.change(input, { target: { value: code } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

afterEach(() => vi.unstubAllGlobals())

describe('ScanSheet', () => {
  it('tallies scans and applies a count as one stock write per product', async () => {
    const { postWrite, onApplied } = setup()

    await scan('093662452874')
    await scan('0093662452874') // the same jar, read as EAN-13
    await scan('093662452959')
    expect(screen.getByRole('status')).toHaveTextContent('Spanish Verde Hot · 1 scanned')

    fireEvent.click(screen.getByRole('button', { name: 'One more Spanish Verde Hot' }))
    fireEvent.click(screen.getByText('Apply count'))

    await waitFor(() => expect(onApplied).toHaveBeenCalledWith('Count applied to 2 products'))
    expect(postWrite.mock.calls.map(([command]) => [command.recordId, command.values])).toEqual([
      ['p1', { mode: 'SET', amount: '2', reason: 'Stock count (scanned)' }],
      ['p2', { mode: 'SET', amount: '2', reason: 'Stock count (scanned)' }],
    ])
  })

  it('says so when a code matches nothing, and counts nothing for it', async () => {
    setup()
    await scan('012345678905')
    expect(screen.getByRole('status')).toHaveTextContent('No product has the code 012345678905')
    expect(screen.getByText('Apply count')).toBeDisabled()
  })

  it('adds a receipt to what is on hand, and keeps only failures for another try', async () => {
    const { postWrite, onApplied } = setup()
    postWrite.mockImplementation(async (command) =>
      command.recordId === 'p2' ? { error: 'The count changed' } : { message: 'ok' },
    )

    fireEvent.click(await screen.findByText('Receiving'))
    await scan('093662452874')
    await scan('093662452959')
    expect(screen.getByText('11')).toBeInTheDocument() // 10 on hand + 1 received

    fireEvent.click(screen.getByText('Add to stock'))
    await waitFor(() => expect(screen.getByText('The count changed')).toBeInTheDocument())
    expect(onApplied).not.toHaveBeenCalled()
    // Peach went through, so it is gone — applying again cannot receive it twice.
    expect(screen.queryByText('Peach Mild')).not.toBeInTheDocument()
  })

  it('asks before discarding scans', async () => {
    const { onClose } = setup()
    await scan('093662452874')

    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Discard scans'))
    expect(onClose).toHaveBeenCalled()
  })
})
