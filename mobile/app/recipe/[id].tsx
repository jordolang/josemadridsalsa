import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api, API_BASE_URL } from '@/lib/api';
import type { Recipe } from '@/lib/api/types';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRecipe() {
      try {
        const recipes = await api.recipes.getRecipes();
        const found = recipes.find(r => r.id === id);
        if (found) {
          if (found.featuredImage?.startsWith('/')) {
            found.featuredImage = `${API_BASE_URL}${found.featuredImage}`;
          }
          setRecipe(found);
        }
      } catch (e) {
        // Handle error implicitly
      } finally {
        setLoading(false);
      }
    }
    loadRecipe();
  }, [id]);

  if (loading) return <ActivityIndicator style={{ marginTop: 50 }} size="large" color="#d32f2f" />;
  if (!recipe) return <Text style={{ textAlign: 'center', marginTop: 50, fontSize: 16 }}>Recipe not found</Text>;

  return (
    <ScrollView style={styles.container}>
      <Image source={{ uri: recipe.featuredImage }} style={styles.image} />
      <View style={styles.content}>
        <Text style={styles.title}>{recipe.title}</Text>
        <Text style={styles.description}>{recipe.description}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>⏱ {recipe.prepTime} prep • {recipe.cookTime} cook</Text>
          <Text style={styles.metaText}>🍴 {recipe.servings} servings</Text>
        </View>
        
        <Text style={styles.sectionTitle}>Ingredients</Text>
        {recipe.ingredients.map((ing, i) => (
          <Text key={i} style={styles.listItem}>• {ing}</Text>
        ))}

        <Text style={styles.sectionTitle}>Instructions</Text>
        {recipe.instructions.map((inst, i) => (
          <Text key={i} style={styles.listItem}>{i + 1}. {inst}</Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  image: { width: '100%', height: 250 },
  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  description: { fontSize: 16, color: '#666', marginBottom: 20, lineHeight: 24 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 15 },
  metaText: { fontSize: 14, fontWeight: '600', color: '#d32f2f' },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 10, marginBottom: 10, color: '#333' },
  listItem: { fontSize: 16, color: '#444', marginBottom: 8, lineHeight: 22 },
});
