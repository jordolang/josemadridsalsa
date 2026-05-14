/**
 * Shopping cart screen presented as a modal from the root Stack navigator.
 *
 * Reads cart state from the local Zustand store and renders a list of items
 * with remove buttons, a running total, and checkout / clear-cart actions.
 *
 * The "Proceed to Checkout" button navigates to the dedicated checkout screen
 * which handles the full Stripe PaymentSheet flow.
 *
 * @module mobile/app/cart
 */

import { StyleSheet, Text, View, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useCartStore } from '@/store/cartStore';

/**
 * Cart screen component.
 *
 * @returns A list of cart items with a checkout footer.
 */
export default function CartScreen() {
  const items = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const totalPrice = useCartStore((state) =>
    state.items.reduce((total, item) => total + item.price * item.quantity, 0)
  );
  const router = useRouter();

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.cartItem}>
            <View>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>${item.price.toFixed(2)} x {item.quantity}</Text>
            </View>
            <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.removeBtn}>
              <Text style={styles.removeBtnText}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>Your cart is empty.</Text>}
      />
      <View style={styles.footer}>
        <Text style={styles.total}>Total: ${totalPrice.toFixed(2)}</Text>
        <TouchableOpacity
          style={[styles.checkoutBtn, items.length === 0 && { opacity: 0.5 }]}
          disabled={items.length === 0}
          onPress={() => router.push('/checkout')}
        >
          <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
        </TouchableOpacity>
        {items.length > 0 && (
          <TouchableOpacity onPress={clearCart} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>Clear Cart</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  cartItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderColor: '#eee' },
  itemName: { fontSize: 16, fontWeight: '600' },
  itemPrice: { fontSize: 14, color: '#666', marginTop: 4 },
  removeBtn: { justifyContent: 'center' },
  removeBtnText: { color: 'red' },
  emptyText: { textAlign: 'center', marginTop: 40, fontSize: 16, color: '#666' },
  footer: { padding: 20, borderTopWidth: 1, borderColor: '#eee' },
  total: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  checkoutBtn: { backgroundColor: '#d32f2f', padding: 15, borderRadius: 8, alignItems: 'center' },
  checkoutBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  clearBtn: { marginTop: 10, alignItems: 'center' },
  clearBtnText: { color: '#666' }
});
