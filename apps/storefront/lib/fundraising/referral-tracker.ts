/**
 * referral-tracker.ts — server-only re-export shim
 *
 * DO NOT import this file from 'use client' components.
 * Client components should import from '@/lib/fundraising/referral-tracker.client'
 * Server components / API routes can import from here or '@/lib/fundraising/referral-tracker.server'
 */
export type { ReferralInfo } from './referral-tracker.client'
export { getReferralFromCookie, getReferralFromCode } from './referral-tracker.server'
export { getReferralCodeFromCookie, setReferralCookie, clearReferralCookie } from './referral-tracker.client'
