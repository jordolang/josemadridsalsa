/**
 * Storefront screen -- the default tab and primary shopping experience.
 *
 * Fetches the salsa product catalog from the backend on mount, converts
 * relative image URLs to absolute, and renders a 2-column product grid.
 * A cart badge in the header links to the modal cart screen.
 *
 * @module mobile/app/(tabs)/index
 */

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator } from 'react-native';
import { api, API_BASE_URL } from '@/lib/api';
import { ProductCard } from '@/components/ProductCard';
import { useCartStore } from '@/store/cartStore';
import { Link } from 'expo-router';
import type { Product } from '@/lib/api/types';

/**
 * Main storefront screen component.
 *
 * @returns A scrollable 2-column product grid with a cart badge header.
 */
export default function StorefrontScreen() {
  const [salsas, setSalsas] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSalsas();
  }, []);

  const loadSalsas = async () => {
    setLoading(true);
    try {
      const data = await api.products.getSalsas();
      // Convert relative image URLs to absolute (immutable — new array of new objects)
      const formattedData = data.map((item: Product) => {
        if (item.images?.[0]?.startsWith('/')) {
          return { ...item, images: [`${API_BASE_URL}${item.images[0]}`, ...item.images.slice(1)] };
        }
        return item;
      });
      setSalsas(formattedData);
    } catch {
      setSalsas([]);
    } finally {
      setLoading(false);
    }
  };

  const cartCount = useCartStore((state) => state.totalQuantity());

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Our Premium Salsas</Text>
        <Link href="/cart" style={styles.cartLink}>
          <Text style={styles.cartText}>Cart ({cartCount})</Text>
        </Link>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#FF0000" />
      ) : (
        <FlatList
          data={salsas}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => <ProductCard item={item} onPress={() => {}} />}
          ListEmptyComponent={<Text>No salsas found.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cartLink: {
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cartText: {
    color: '#d32f2f',
    fontWeight: 'bold',
  },
});
