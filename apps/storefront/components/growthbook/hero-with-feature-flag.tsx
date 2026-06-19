'use client'

import { useFeatureIsOn } from '@growthbook/growthbook-react'

import type { AppFeatures } from '@/lib/growthbook'
import { HomeHero } from '@/components/store/home-hero'
import { PersonalizedHero } from '@/components/store/personalized-hero'

interface HeroWithFeatureFlagProps {
  hasSession: boolean
}

/**
 * Wrapper component that controls whether the personalized hero shows based
 * on the 'personalized-homepage-hero' feature flag.
 *
 * - Control group (flag OFF): always shows HomeHero
 * - Treatment group (flag ON): shows PersonalizedHero if logged in, HomeHero otherwise
 */
export function HeroWithFeatureFlag({ hasSession }: HeroWithFeatureFlagProps) {
  const personalizedHeroEnabled = useFeatureIsOn<AppFeatures>('personalized-homepage-hero')

  // If feature flag is off (control group), always show default hero
  if (!personalizedHeroEnabled) {
    return <HomeHero />
  }

  // If feature flag is on (treatment group), show personalized hero for logged-in users
  return hasSession ? <PersonalizedHero /> : <HomeHero />
}
