import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, Image, TouchableOpacity } from 'react-native';
import { api, API_BASE_URL } from '@/lib/api';
import type { Recipe } from '@/lib/api/types';
import { useRouter } from 'expo-router';

export default function RecipesScreen() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await api.recipes.getRecipes();
      const formattedData = data.map((item: Recipe) => {
        if (item.featuredImage?.startsWith('/')) {
          return { ...item, featuredImage: `${API_BASE_URL}${item.featuredImage}` };
        }
        return item;
      });
      setRecipes(formattedData);
    } catch (err: any) {
      setRecipes([]);
      setErrorMsg(err?.message || "Failed to load recipes.");
    } finally {
      setLoading(false);
    }
  };

  const renderRecipe = ({ item }: { item: Recipe }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => router.push(`/recipe/${item.id}`)}
    >
      <Image source={{ uri: item.featuredImage }} style={styles.image} />
      <View style={styles.cardContent}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
        <Text style={styles.meta}>⏳ {item.prepTime} + {item.cookTime} • 🍴 {item.servings} Servings</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#d32f2f" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 15 }}
          renderItem={renderRecipe}
          ListEmptyComponent={
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ textAlign: 'center', color: '#666', fontSize: 16 }}>
                {errorMsg ? `Network Error: ${errorMsg}` : 'No recipes found.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  image: { width: '100%', height: 180 },
  cardContent: { padding: 15 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 5, color: '#333' },
  description: { fontSize: 14, color: '#666', marginBottom: 10, lineHeight: 20 },
  meta: { fontSize: 12, color: '#d32f2f', fontWeight: '600' },
});
