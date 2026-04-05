/**
 * Reusable login screen component used by protected areas of the app
 * (e.g. admin, account) to gate access behind authentication.
 *
 * Renders email/password inputs and delegates credential exchange to
 * {@link mobileLogin}. On success, the parent's `onLoginSuccess`
 * callback is invoked so it can swap in the authenticated view.
 *
 * @module mobile/components/LoginScreen
 */

import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { api } from '@/lib/api';

/** Props accepted by {@link LoginScreen}. */
export interface LoginScreenProps {
  /** Callback fired after the user authenticates successfully. */
  onLoginSuccess: () => void;
  /** Heading text displayed above the sign-in form. */
  title: string;
}

/**
 * Full-screen login form with email and password fields.
 *
 * Shows an {@link ActivityIndicator} while the request is in flight and
 * displays a native {@link Alert} on failure.
 *
 * @param props - {@link LoginScreenProps}
 * @returns A centered login form view
 *
 * @example
 * ```tsx
 * <LoginScreen
 *   title="Admin Login"
 *   onLoginSuccess={() => setIsLoggedIn(true)}
 * />
 * ```
 */
export function LoginScreen({ onLoginSuccess, title }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setLoading(true);
      await api.auth.login({ email, password });
      onLoginSuccess();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Invalid credentials';
      Alert.alert('Login Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>Please sign in to access this area.</Text>

      <TextInput
        style={styles.input}
        placeholder="Email address"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#f5f5f5' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 30, textAlign: 'center' },
  input: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#ddd' },
  button: { backgroundColor: '#d32f2f', padding: 15, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
