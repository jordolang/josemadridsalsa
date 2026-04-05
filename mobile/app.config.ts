import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'mobile',
  slug: 'mobile',
  version: '1.0.0',
  scheme: 'josemadridsalsa',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.anonymous.mobile',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      '@stripe/stripe-react-native',
      {
        merchantIdentifier: 'merchant.com.josemadridsalsa',
        enableGooglePay: false,
      },
    ],
    [
      '@stripe/stripe-terminal-react-native',
      {
        bluetoothBackgroundMode:
          'Required to connect to Stripe Terminal bluetooth readers.',
        locationAlwaysAndWhenInUsePermission:
          'Location required to process transactions.',
        locationWhenInUsePermission:
          'Location required to connect to Stripe Terminal.',
      },
    ],
  ],
  extra: {
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? '',
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? '',
    },
  },
});
