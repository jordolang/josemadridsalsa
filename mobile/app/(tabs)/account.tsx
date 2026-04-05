/**
 * Account screen with profile info, loyalty points, address management,
 * and sign-out action.
 *
 * @module mobile/app/(tabs)/account
 */

import { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { RequireAuth } from '@/components/RequireAuth';
import { useAuth } from '@/hooks/useAuth';
import { api, ApiError } from '@/lib/api';
import type { Address, LoyaltyAccount, LoyaltyTier } from '@/lib/api/types';

const TIER_COLORS: Record<LoyaltyTier, string> = {
  BRONZE: '#cd7f32',
  SILVER: '#c0c0c0',
  GOLD: '#ffd700',
  PLATINUM: '#e5e4e2',
};

function AccountContent() {
  const router = useRouter();
  const { session, logout } = useAuth();
  const [loyalty, setLoyalty] = useState<LoyaltyAccount | null>(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState(true);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [loyaltyResult, addressResult] = await Promise.allSettled([
        api.loyalty.getLoyaltyAccount(),
        api.account.getAddresses(),
      ]);

      if (loyaltyResult.status === 'fulfilled') {
        setLoyalty(loyaltyResult.value.data);
      } else {
        setLoyalty(null);
      }

      if (addressResult.status === 'fulfilled') {
        setAddresses(addressResult.value);
      }
    } finally {
      setLoyaltyLoading(false);
      setAddressesLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/');
        },
      },
    ]);
  }, [logout, router]);

  const user = session?.user;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d32f2f" />
      }
    >
      {/* Profile Section */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?'}
          </Text>
        </View>
        <Text style={styles.userName}>{user?.name ?? 'Customer'}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{user?.role}</Text>
        </View>
      </View>

      {/* Loyalty Section */}
      <Text style={styles.sectionTitle}>Loyalty Program</Text>
      {loyaltyLoading ? (
        <ActivityIndicator size="small" color="#d32f2f" style={{ marginVertical: 16 }} />
      ) : loyalty ? (
        <View style={styles.loyaltyCard}>
          <View style={styles.loyaltyHeader}>
            <View
              style={[
                styles.tierBadge,
                { backgroundColor: TIER_COLORS[loyalty.tier] },
              ]}
            >
              <Text style={styles.tierText}>{loyalty.tier}</Text>
            </View>
          </View>
          <View style={styles.pointsRow}>
            <View style={styles.pointsBlock}>
              <Text style={styles.pointsValue}>{loyalty.pointsBalance.toLocaleString()}</Text>
              <Text style={styles.pointsLabel}>Available Points</Text>
            </View>
            <View style={styles.pointsDivider} />
            <View style={styles.pointsBlock}>
              <Text style={styles.pointsValue}>{loyalty.lifetimePoints.toLocaleString()}</Text>
              <Text style={styles.pointsLabel}>Lifetime Points</Text>
            </View>
          </View>
          {loyalty.transactions.length > 0 ? (
            <View style={styles.recentActivity}>
              <Text style={styles.recentTitle}>Recent Activity</Text>
              {loyalty.transactions.slice(0, 3).map((tx) => (
                <View key={tx.id} style={styles.txRow}>
                  <Text style={styles.txDescription} numberOfLines={1}>
                    {tx.description}
                  </Text>
                  <Text
                    style={[
                      styles.txPoints,
                      { color: tx.points >= 0 ? '#4caf50' : '#f44336' },
                    ]}
                  >
                    {tx.points >= 0 ? '+' : ''}{tx.points}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyCardText}>
            Start earning loyalty points with your first purchase!
          </Text>
        </View>
      )}

      {/* Addresses Section */}
      <Text style={styles.sectionTitle}>Saved Addresses</Text>
      {addressesLoading ? (
        <ActivityIndicator size="small" color="#d32f2f" style={{ marginVertical: 16 }} />
      ) : addresses.length > 0 ? (
        <View style={styles.addressList}>
          {addresses.map((addr) => (
            <View key={addr.id} style={styles.addressCard}>
              <View style={styles.addressHeader}>
                <Text style={styles.addressName}>
                  {addr.firstName} {addr.lastName}
                </Text>
                {addr.isDefault && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>Default</Text>
                  </View>
                )}
              </View>
              {addr.company ? <Text style={styles.addressLine}>{addr.company}</Text> : null}
              <Text style={styles.addressLine}>{addr.street}</Text>
              <Text style={styles.addressLine}>
                {addr.city}, {addr.state} {addr.zipCode}
              </Text>
              <Text style={styles.addressType}>{addr.type}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyCardText}>
            No saved addresses yet.
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionsSection}>
        {(user?.role === 'ADMIN' || user?.role === 'WHOLESALE') && (
          <TouchableOpacity style={[styles.actionButton, styles.adminButton]} onPress={() => router.push('/admin')}>
            <Text style={styles.adminButtonText}>Launch Admin POS</Text>
          </TouchableOpacity>
        )}

        {(user?.role === 'ADMIN' || user?.role === 'FUNDRAISER') && (
          <TouchableOpacity style={[styles.actionButton, styles.adminButton]} onPress={() => router.push('/fundraising')}>
            <Text style={styles.adminButtonText}>Launch Fundraising Hub</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.actionButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

export default function AccountScreen() {
  return (
    <RequireAuth>
      <AccountContent />
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  // Profile
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 20,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#d32f2f',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  userEmail: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  roleBadge: {
    marginTop: 8,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
  },
  // Sections
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
    marginBottom: 10,
  },
  // Loyalty
  loyaltyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 20,
  },
  loyaltyHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  tierBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 14,
  },
  tierText: {
    color: '#333',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pointsBlock: {
    flex: 1,
    alignItems: 'center',
  },
  pointsValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  pointsLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  pointsDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e0e0e0',
  },
  recentActivity: {
    marginTop: 14,
    borderTopWidth: 1,
    borderColor: '#e0e0e0',
    paddingTop: 12,
  },
  recentTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  txDescription: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginRight: 8,
  },
  txPoints: {
    fontSize: 14,
    fontWeight: '700',
  },
  // Empty
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 20,
  },
  emptyCardText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  // Addresses
  addressList: {
    marginBottom: 20,
    gap: 10,
  },
  addressCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  addressName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  defaultBadge: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  defaultBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2e7d32',
  },
  addressLine: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  addressType: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  // Actions
  actionsSection: {
    marginTop: 8,
  },
  actionButton: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 10,
  },
  adminButton: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeeba',
  },
  adminButtonText: {
    color: '#856404',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutText: {
    color: '#f44336',
    fontSize: 16,
    fontWeight: '600',
  },
});
