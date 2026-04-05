/**
 * Tab navigator layout for the main app sections.
 *
 * Defines three tabs:
 * 1. **Storefront** (`index`) -- Product catalog and shopping
 * 2. **Fundraising** -- Campaign management dashboard
 * 3. **Admin POS** -- Stripe Terminal point-of-sale interface
 *
 * Active tab tint uses the brand red (`#FF0000`).
 *
 * @module mobile/app/(tabs)/_layout
 */

import { Tabs } from 'expo-router';

/**
 * Tab bar layout component.
 *
 * @returns The Expo Router Tabs navigator with three screens.
 */
export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#FF0000' }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Storefront',
        }}
      />
      <Tabs.Screen
        name="fundraising"
        options={{
          title: 'Fundraising',
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin POS',
        }}
      />
    </Tabs>
  );
}
