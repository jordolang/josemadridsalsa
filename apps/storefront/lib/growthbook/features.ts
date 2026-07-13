/**
 * Typed registry of feature flags defined in GrowthBook.
 *
 * Add a key here whenever you add a new flag in the GrowthBook dashboard so
 * `useFeatureIsOn`, `useFeatureValue`, and `IfFeatureEnabled` can type-check
 * the flag key and inferred value.
 */
export interface AppFeatures {
  'homepage-announcement-banner': boolean
  'personalized-homepage-hero': boolean
  'personalized-email-recommendations': boolean
}

export type AppFeatureKey = keyof AppFeatures
