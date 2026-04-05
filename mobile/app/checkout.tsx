/**
 * Checkout screen that orchestrates the payment flow.
 *
 * Flow:
 * 1. Collect shipping info (or use saved address)
 * 2. Show order summary with calculated shipping/tax
 * 3. Present Stripe PaymentSheet (includes Apple Pay when available)
 * 4. Show confirmation on success
 */

import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCheckout } from '@/hooks/useCheckout';
import { useCartStore } from '@/store/cartStore';
import type { CheckoutRequest } from '@/lib/api/types';

/**
 * Checkout screen component that collects shipping details, displays an
 * order summary, and presents Stripe or Apple Pay payment options.
 *
 * After successful payment the cart is cleared and a confirmation view
 * with the order ID is shown.
 *
 * @returns The checkout form, loading indicator, or order confirmation view
 */
export default function CheckoutScreen() {
  const router = useRouter();
  const {
    loading,
    error,
    completedOrderId,
    startCheckout,
    startApplePayCheckout,
    isApplePayAvailable,
    reset,
  } = useCheckout();

  const cartItems = useCartStore((s) => s.items);
  const totalPrice = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const clearCart = useCartStore((s) => s.clearCart);

  // Form state
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address1, setAddress1] = useState('');
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // Build checkout request from form + cart
  const buildCheckoutRequest = (): CheckoutRequest | null => {
    if (!email || !firstName || !lastName || !address1 || !city || !stateCode || !postalCode) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return null;
    }

    if (cartItems.length === 0) {
      Alert.alert('Empty Cart', 'Your cart is empty.');
      return null;
    }

    return {
      items: cartItems.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
      })),
      customer: {
        email,
        firstName,
        lastName,
        phone: phone || undefined,
      },
      shipping: {
        address1,
        city,
        state: stateCode,
        postalCode,
      },
    };
  };

  const handlePayWithCard = async () => {
    const request = buildCheckoutRequest();
    if (!request) return;

    const success = await startCheckout(request);
    if (success) {
      clearCart();
    }
  };

  const handlePayWithApplePay = async () => {
    const request = buildCheckoutRequest();
    if (!request) return;

    const success = await startApplePayCheckout(request);
    if (success) {
      clearCart();
    }
  };

  // ─── Order Confirmation ──────────────────────────────────────────────────

  if (completedOrderId) {
    return (
      <View style={styles.confirmationContainer}>
        <Text style={styles.confirmationIcon}>&#10003;</Text>
        <Text style={styles.confirmationTitle}>Order Confirmed!</Text>
        <Text style={styles.confirmationText}>
          Your order has been placed successfully.
        </Text>
        <Text style={styles.orderId}>Order ID: {completedOrderId}</Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            reset();
            router.replace('/');
          }}
        >
          <Text style={styles.primaryButtonText}>Continue Shopping</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Checkout Form ───────────────────────────────────────────────────────

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Contact Information</Text>

      <TextInput
        style={styles.input}
        placeholder="Email *"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.halfInput]}
          placeholder="First Name *"
          value={firstName}
          onChangeText={setFirstName}
        />
        <TextInput
          style={[styles.input, styles.halfInput]}
          placeholder="Last Name *"
          value={lastName}
          onChangeText={setLastName}
        />
      </View>
      <TextInput
        style={styles.input}
        placeholder="Phone (optional)"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />

      <Text style={styles.sectionTitle}>Shipping Address</Text>

      <TextInput
        style={styles.input}
        placeholder="Address *"
        value={address1}
        onChangeText={setAddress1}
      />
      <TextInput
        style={styles.input}
        placeholder="City *"
        value={city}
        onChangeText={setCity}
      />
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.halfInput]}
          placeholder="State *"
          value={stateCode}
          onChangeText={setStateCode}
          autoCapitalize="characters"
          maxLength={2}
        />
        <TextInput
          style={[styles.input, styles.halfInput]}
          placeholder="ZIP Code *"
          value={postalCode}
          onChangeText={setPostalCode}
          keyboardType="number-pad"
        />
      </View>

      <Text style={styles.sectionTitle}>Order Summary</Text>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>
          {cartItems.length} item{cartItems.length !== 1 ? 's' : ''}
        </Text>
        <Text style={styles.summaryValue}>${totalPrice.toFixed(2)}</Text>
      </View>
      <Text style={styles.summaryNote}>
        Shipping and tax calculated at payment
      </Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator size="large" color="#d32f2f" style={styles.loader} />
      ) : (
        <View style={styles.buttonGroup}>
          {isApplePayAvailable ? (
            <TouchableOpacity
              style={styles.applePayButton}
              onPress={handlePayWithApplePay}
            >
              <Text style={styles.applePayButtonText}> Pay</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handlePayWithCard}
          >
            <Text style={styles.primaryButtonText}>Pay with Card</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
    color: '#333',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  halfInput: {
    flex: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  summaryLabel: {
    fontSize: 16,
    color: '#555',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  summaryNote: {
    fontSize: 13,
    color: '#888',
    marginTop: 6,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: '#fdecea',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 14,
  },
  loader: {
    marginTop: 24,
  },
  buttonGroup: {
    marginTop: 24,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#d32f2f',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  applePayButton: {
    backgroundColor: '#000',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  applePayButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  // Confirmation
  confirmationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f5f5f5',
  },
  confirmationIcon: {
    fontSize: 64,
    color: '#4caf50',
    marginBottom: 16,
  },
  confirmationTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  confirmationText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  orderId: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'monospace',
    marginBottom: 32,
  },
});
