import type { Experiment, Result } from '@growthbook/growthbook-react'

import { trackEvent } from '@/lib/analytics/amplitude'

/**
 * Forwards GrowthBook experiment exposures to Amplitude using the conventional
 * `Experiment Viewed` event name so experiment dashboards line up with
 * downstream conversion events. Skips users that didn't actually land in the
 * experiment so exposure counts reflect real assignments.
 */
export function amplitudeTrackingCallback<T>(
  experiment: Experiment<T>,
  result: Result<T>,
): void {
  if (!result.inExperiment) return
  trackEvent('Experiment Viewed', {
    experiment_id: experiment.key,
    variation_id: result.variationId,
    variation_key: result.key,
    hash_attribute: result.hashAttribute,
    hash_value: result.hashValue,
  })
}
