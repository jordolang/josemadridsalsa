/**
 * Tab navigator layout for the main app sections.
 *
 * Defines six tabs:
 * 1. **Storefront** (`index`) -- Product catalog and shopping
 * 2. **Orders** -- Order history (auth required)
 * 3. **Wishlist** -- Saved products (auth required)
 * 4. **Account** -- Profile, loyalty, settings (auth required)
 * 5. **Fundraising** -- Campaign management dashboard
 * 6. **Admin POS** -- Stripe Terminal point-of-sale interface
 *
 * Active tab tint uses the brand red (`#FF0000`).
 *
 * @module mobile/app/(tabs)/_layout
 */

import { Tabs } from 'expo-router';

/**
 * Tab bar layout component.
 *
 * @returns The Expo Router Tabs navigator.
 */
export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#FF0000' }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Shop',
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
        }}
      />
      <Tabs.Screen
        name="wishlist"
        options={{
          title: 'Wishlist',
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
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
