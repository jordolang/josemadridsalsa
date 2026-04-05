/**
 * Fundraising Dashboard screen for campaign management.
 *
 * Displays the current active campaign with progress tracking (goal vs raised),
 * and provides quick-action buttons for sharing referral links, requesting
 * payouts, managing sub-sellers, and editing campaign settings.
 *
 * Currently renders placeholder/demo data. Will be connected to the
 * `api.fundraisers` endpoints in a future iteration.
 *
 * @module mobile/app/(tabs)/fundraising
 */

import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { LoginScreen } from '@/components/LoginScreen';
import { api } from '@/lib/api';

/**
 * Fundraising dashboard screen component.
 *
 * @returns A scrollable dashboard with campaign stats and action grid.
 */
export default function FundraisingScreen() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const session = await api.auth.getSession();
      if (session?.user) {
        setIsAuthenticated(true);
      }
    } catch {
      // Not authenticated
    } finally {
      setChecking(false);
    }
  }, []);

  if (checking) return <ActivityIndicator style={{ flex: 1 }} size="large" />;
  if (!isAuthenticated) return <LoginScreen title="Fundraiser Hub Sign In" onLoginSuccess={() => setIsAuthenticated(true)} />;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Fundraising Dashboard</Text>
      <Text style={styles.description}>
        Manage your active fundraising campaigns directly from your mobile device.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Current Campaign: Spring 2026 Band Trip</Text>
        <Text style={styles.cardStat}>Total Raised: $1,450.00</Text>
        <Text style={styles.cardStat}>Goal: $5,000.00</Text>
        
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: '29%' }]} />
        </View>
        <Text style={styles.progressText}>29% of goal reached</Text>
      </View>

      <View style={styles.actionGrid}>
        <TouchableOpacity style={styles.actionButton} onPress={() => Alert.alert('Share Link', 'Copied your custom storefront link!')}>
          <Text style={styles.actionText}>Share Link</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => Alert.alert('Request Payout', 'Payout requested to your linked bank account.')}>
          <Text style={styles.actionText}>Request Payout</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => Alert.alert('Manage Sellers', 'Opening sub-seller management...')}>
          <Text style={styles.actionText}>Manage Sellers</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => Alert.alert('Settings', 'Edit campaign settings.')}>
          <Text style={styles.actionText}>Settings</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  cardStat: {
    fontSize: 16,
    marginBottom: 5,
  },
  progressBarBg: {
    height: 10,
    backgroundColor: '#eee',
    borderRadius: 5,
    marginTop: 15,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4caf50',
  },
  progressText: {
    marginTop: 5,
    fontSize: 14,
    color: '#666',
    textAlign: 'right',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
    marginBottom: 15,
  },
  actionText: {
    fontWeight: 'bold',
    color: '#333',
  },
});
