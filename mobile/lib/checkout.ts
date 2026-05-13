import { API_BASE_URL } from './api';
import type { CartItem } from '../store/cartStore';

export async function fetchPaymentSheetParams(items: CartItem[]) {
  // Mock customer info for rapid checkout (In a real app, this comes from state/inputs)
  const payload = {
    items: items.map(i => ({ productId: i.id, quantity: i.quantity })),
    customer: {
      email: 'mobile-test@example.com',
      firstName: 'Mobile',
      lastName: 'User',
    },
    shipping: {
      address1: '123 Mobile St',
      city: 'Appville',
      state: 'CA',
      postalCode: '90210'
    }
  };

  const response = await fetch(`${API_BASE_URL}/api/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Checkout failed');
  }
  
  return await response.json(); // { clientSecret, orderId, amount }
}
