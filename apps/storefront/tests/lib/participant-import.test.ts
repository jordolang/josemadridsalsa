import { describe, expect, it } from 'vitest'
import { parseParticipantCsv } from '@/lib/fundraisers/participant-import'

const HEADER = 'Fundraiser,Name,Email,Phone,Referral Code,Status'

describe('parseParticipantCsv', () => {
  it('maps a typical participant sheet', () => {
    const csv = `${HEADER}\nspring-band-drive,Jamie Lee,jamie@zhs.org,555-0100,FR-ABCD-1234,active`
    const { rows, missingRequired, mapping } = parseParticipantCsv(csv)

    expect(missingRequired).toEqual([])
    expect(mapping.fundraiser).toBe('Fundraiser')
    expect(rows[0]).toMatchObject({
      fundraiserRef: 'spring-band-drive',
      name: 'Jamie Lee',
      email: 'jamie@zhs.org',
      phone: '555-0100',
      referralCode: 'FR-ABCD-1234',
      status: 'ACTIVE',
      error: null,
    })
  })

  it('uppercases a supplied referral code and lowercases email', () => {
    const { rows } = parseParticipantCsv(
      `${HEADER}\nMyFund,Ann,ANN@x.org,,fr-xy-9,`
    )
    expect(rows[0].email).toBe('ann@x.org')
    expect(rows[0].referralCode).toBe('FR-XY-9')
  })

  it('defaults status to ACTIVE and normalizes unknown values', () => {
    const { rows } = parseParticipantCsv(`${HEADER}\nF,N,n@x.org,,,retired`)
    expect(rows[0].status).toBe('ACTIVE')
  })

  it('flags a missing fundraiser reference', () => {
    const { rows } = parseParticipantCsv(`${HEADER}\n,Ann,ann@x.org,,,`)
    expect(rows[0].error).toBe('Missing fundraiser')
  })

  it('flags a malformed email', () => {
    const { rows } = parseParticipantCsv(`${HEADER}\nF,Ann,nope,,,`)
    expect(rows[0].error).toMatch(/Invalid email/)
  })

  it('reports required columns that are absent', () => {
    const { missingRequired } = parseParticipantCsv('Name,Email\nAnn,a@b.org')
    expect(missingRequired).toEqual(['fundraiser'])
  })
})
