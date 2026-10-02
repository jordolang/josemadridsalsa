import * as amplitude from '@amplitude/unified';

let isInitialized = false;

type AmplitudeProperty =
  | number
  | string
  | boolean
  | Array<string | number>
  | { [key: string]: AmplitudeProperty }
  | Array<{ [key: string]: AmplitudeProperty }>;

/**
 * Initialize Amplitude analytics and session replay (browser only).
 * Call this once when the app starts; later calls are no-ops.
 */
export const initAmplitude = () => {
  if (isInitialized) {
    return true;
  }

  const apiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;

  // Inlined at build time, so a key missing from the deploy silently disables analytics.
  if (!apiKey) {
    console.warn('Amplitude API key missing — analytics disabled');
    return false;
  }

  amplitude.initAll(apiKey, { analytics: { autocapture: true }, sessionReplay: { sampleRate: 1 } });

  isInitialized = true;
  return true;
};

/**
 * Track a custom event
 * @param eventName - Name of the event
 * @param eventProperties - Optional properties for the event
 */
export const trackEvent = (eventName: string, eventProperties?: Record<string, unknown>) => {
  if (!isInitialized) return;
  amplitude.track(eventName, eventProperties);
};

/**
 * Identify a user
 * @param userId - User ID
 * @param userProperties - Optional user properties
 */
export const identifyUser = (userId: string, userProperties?: Record<string, AmplitudeProperty>) => {
  if (!isInitialized) return;
  amplitude.setUserId(userId);
  if (userProperties) {
    const identifyEvent = new amplitude.Identify();
    Object.entries(userProperties).forEach(([key, value]) => {
      identifyEvent.set(key, value);
    });
    amplitude.identify(identifyEvent);
  }
};

/**
 * Reset user (on logout)
 */
export const resetUser = () => {
  if (!isInitialized) return;
  amplitude.reset();
};

export { amplitude };
