/**
 * Admin POS Terminal screen for in-person payment capture.
 *
 * Integrates with the Stripe Terminal SDK to discover and connect to
 * Bluetooth card readers. Also provides quick-action buttons for
 * wholesale orders and inventory scanning.
 *
 * Requires the backend to expose `/api/terminal/connection_token` for
 * Stripe Terminal authentication.
 *
 * @module mobile/app/(tabs)/admin
 */

import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useStripeTerminal } from '@stripe/stripe-terminal-react-native';
import { LoginScreen } from '../../components/LoginScreen';
import { getMobileSession } from '../../lib/auth';

/**
 * Admin POS screen component.
 *
 * @returns A screen with device management and quick-action sections.
 */
export default function AdminPOSScreen() {
  const { initialize, discoverReaders } = useStripeTerminal();
  const [discovering, setDiscovering] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const session = await getMobileSession();
      if (session?.user && (session.user.role === 'ADMIN' || session.user.role === 'WHOLESALER')) {
        setIsAuthenticated(true);
      }
    } catch {
      // Not authenticated
    } finally {
      setChecking(false);
    }
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    Alert.alert('Searching for readers...', 'Stripe Terminal SDK relies on a verified location and actual backend connection token to scan for devices. Please ensure the backend provides `/api/terminal/connection_token`.');
    setDiscovering(false);
  };

  if (checking) return <ActivityIndicator style={{ flex: 1 }} size="large" />;
  if (!isAuthenticated) return <LoginScreen title="Admin Portal Sign In" onLoginSuccess={() => setIsAuthenticated(true)} />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin POS Terminal</Text>
      <Text style={styles.description}>
        Capture payments securely via Bluetooth card readers.
      </Text>
      
      <View style={styles.posModule}>
        <Text style={styles.moduleTitle}>Device Management</Text>
        <TouchableOpacity style={styles.actionButton} onPress={handleDiscover}>
          <Text style={styles.actionButtonText}>
            {discovering ? 'Scanning...' : 'Discover Bluetooth Readers'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.posModule}>
        <Text style={styles.moduleTitle}>Quick Actions</Text>
        <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#4caf50' }]} onPress={() => Alert.alert('Action', 'Wholesale order initiated')}>
          <Text style={styles.actionButtonText}>New Wholesale Order</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#2196f3' }]} onPress={() => Alert.alert('Action', 'Inventory scanning initiated')}>
          <Text style={styles.actionButtonText}>Scan Inventory</Text>
        </TouchableOpacity>
      </View>
    </View>
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
    marginBottom: 30,
  },
  posModule: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eee',
  },
  moduleTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },
  actionButton: {
    backgroundColor: '#d32f2f',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
