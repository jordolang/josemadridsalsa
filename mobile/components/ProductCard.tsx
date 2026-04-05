/**
 * ProductCard component for the storefront product grid.
 *
 * Displays a product thumbnail, name, price, and an "Add to Cart" button
 * that writes to the local Zustand cart store.
 *
 * @module mobile/components/ProductCard
 */

import { View, Text, StyleSheet, Image, TouchableOpacity, Button } from 'react-native';
import { useCartStore } from '../store/cartStore';

/**
 * Props for the {@link ProductCard} component.
 */
interface ProductCardProps {
  /** Product data object. Must include `id`, `name`, `price` (dollars), and optionally `images`. */
  item: { id: string; name: string; price: number; images?: string[] };
  /** Callback fired when the card body is tapped (e.g., navigate to product detail). */
  onPress?: () => void;
}

/**
 * Renders a product card with image, name, price, and add-to-cart action.
 *
 * @param props - {@link ProductCardProps}
 * @returns A touchable card suitable for use inside a FlatList grid.
 *
 * @example
 * ```tsx
 * <ProductCard
 *   item={{ id: '1', name: 'Mild Salsa', price: 5.99, images: ['/img/mild.jpg'] }}
 *   onPress={() => router.push(`/product/${item.id}`)}
 * />
 * ```
 */
export function ProductCard({ item, onPress }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const imageUrl = item.images?.[0] || 'https://via.placeholder.com/150';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.price}>${item.price.toFixed(2)}</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => addItem(item)}>
          <Text style={styles.addButtonText}>Add to Cart</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 8,
    margin: 8,
    flex: 1,
    borderWidth: 1,
    borderColor: '#eee',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 120,
    backgroundColor: '#fafafa',
  },
  content: {
    padding: 10,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  price: {
    fontSize: 14,
    color: '#d32f2f', // Brand red
    marginTop: 4,
    fontWeight: 'bold',
  },
  addButton: {
    marginTop: 10,
    backgroundColor: '#d32f2f',
    paddingVertical: 6,
    borderRadius: 4,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
