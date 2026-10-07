import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FundraiserDownloads } from '@/app/(site)/_components/fundraiser-downloads'

describe('FundraiserDownloads', () => {
  it('links every order form pack and flier to a file in public/', () => {
    render(<FundraiserDownloads />)
    expect(screen.getByRole('heading', { name: 'Order form packs' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Fliers' })).toBeInTheDocument()

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(5)
    for (const link of links) {
      const href = link.getAttribute('href') ?? ''
      expect(link).toHaveAttribute('download')
      expect(existsSync(path.join(__dirname, '../../../../public', href))).toBe(true)
    }
  })
})
