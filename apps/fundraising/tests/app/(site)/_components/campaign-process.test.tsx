import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { CAMPAIGN_GUIDE_PDF, CAMPAIGN_STEPS, CampaignProcess } from '@/app/(site)/_components/campaign-process'

const PUBLIC_DIR = path.join(__dirname, '../../../../public')

describe('CampaignProcess', () => {
  it('lists the six campaign steps in order', () => {
    render(<CampaignProcess />)
    expect(screen.getByRole('heading', { name: 'How a fundraising campaign works' })).toBeInTheDocument()
    const headings = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
    expect(headings).toEqual(CAMPAIGN_STEPS.map((step) => step.title))
  })

  it('links the start page, the final order page and a PDF guide that exists in public/', () => {
    render(<CampaignProcess />)
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(hrefs).toContain('/start')
    expect(hrefs).toContain('/submit')

    const pdf = screen.getByRole('link', { name: /step-by-step guide \(PDF\)/ })
    expect(pdf).toHaveAttribute('href', CAMPAIGN_GUIDE_PDF)
    expect(pdf).toHaveAttribute('download')
    expect(existsSync(path.join(PUBLIC_DIR, CAMPAIGN_GUIDE_PDF))).toBe(true)
  })

  it('marks the submit step as new and shows the portal screenshot', () => {
    render(<CampaignProcess />)
    const submit = screen.getByRole('heading', { name: 'Submit your final totals' }).closest('article')
    expect(submit).not.toBeNull()
    expect(within(submit as HTMLElement).getByText('New step')).toBeInTheDocument()

    const image = CAMPAIGN_STEPS.find((step) => step.image)?.image
    expect(image && existsSync(path.join(PUBLIC_DIR, image.src))).toBe(true)
  })
})
