import * as amplitude from '@amplitude/analytics-browser';
import { sessionReplayPlugin } from '@amplitude/plugin-session-replay-browser';

let isInitialized = false;

type AmplitudeProperty =
  | number
  | string
  | boolean
  | Array<string | number>
  | { [key: string]: AmplitudeProperty }
  | Array<{ [key: string]: AmplitudeProperty }>;

/**
 * Initialize Amplitude analytics
 * Call this once when the app starts
 */
export const initAmplitude = () => {
  if (isInitialized) {
    return;
  }

  const apiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;

  if (!apiKey) {
    return false;
  }

  amplitude.init(apiKey, {
    defaultTracking: {
      sessions: true,
      pageViews: true,
      formInteractions: true,
      fileDownloads: true,
    },
  });

  // Add session replay plugin
  amplitude.add(sessionReplayPlugin());

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
