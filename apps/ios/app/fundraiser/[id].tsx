import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, API_BASE_URL } from '@/lib/api';
import type { Fundraiser } from '@/lib/api/types';

export default function FundraiserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [fundraiser, setFundraiser] = useState<Fundraiser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadFundraiser() {
      try {
        const data = await api.fundraisers.getFundraiser(id);
        if (data.logoUrl?.startsWith('/')) data.logoUrl = `${API_BASE_URL}${data.logoUrl}`;
        if (data.coverPhotoUrl?.startsWith('/')) data.coverPhotoUrl = `${API_BASE_URL}${data.coverPhotoUrl}`;
        setFundraiser(data);
      } catch (e) {
        // Handle error implicitly
      } finally {
        setLoading(false);
      }
    }
    loadFundraiser();
  }, [id]);

  if (loading) return <ActivityIndicator style={{ marginTop: 50 }} size="large" color="#d32f2f" />;
  if (!fundraiser) return <Text style={{ textAlign: 'center', marginTop: 50, fontSize: 16 }}>Fundraiser not found</Text>;

  const progress = fundraiser.goal ? Math.min((fundraiser.totalRevenue / 100) / fundraiser.goal, 1) * 100 : 0;

  const handleSupport = () => {
    Alert.alert(
      "Support Team Active",
      `${fundraiser.organizationName} will now receive credit for any purchases you place during this session.`,
      [{ text: "Start Shopping", onPress: () => router.push('/') }]
    );
  };

  return (
    <ScrollView style={styles.container}>
      {fundraiser.coverPhotoUrl && <Image source={{ uri: fundraiser.coverPhotoUrl }} style={styles.image} />}
      <View style={styles.content}>
        <Text style={styles.title}>{fundraiser.name}</Text>
        <Text style={styles.organization}>{fundraiser.organizationName}</Text>
        
        {fundraiser.goal && (
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressText}>${(fundraiser.totalRevenue / 100).toFixed(2)} raised</Text>
              <Text style={styles.goalText}>Goal: ${fundraiser.goal}</Text>
            </View>
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
            </View>
          </View>
        )}

        <Text style={styles.description}>{fundraiser.description}</Text>

        <TouchableOpacity style={styles.supportButton} onPress={handleSupport}>
          <Text style={styles.supportButtonText}>Support this Fundraiser</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  image: { width: '100%', height: 200, backgroundColor: '#e0e0e0' },
  content: { padding: 20 },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 5, color: '#333' },
  organization: { fontSize: 16, color: '#666', marginBottom: 20 },
  description: { fontSize: 16, color: '#555', marginBottom: 30, lineHeight: 24, marginTop: 10 },
  progressContainer: { marginBottom: 20, backgroundColor: '#f9f9f9', padding: 15, borderRadius: 8 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressText: { fontSize: 16, color: '#333', fontWeight: 'bold' },
  goalText: { fontSize: 14, color: '#666', fontWeight: '500' },
  progressBarBackground: { height: 10, backgroundColor: '#e0e0e0', borderRadius: 5, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#4CAF50' },
  supportButton: { backgroundColor: '#d32f2f', padding: 15, borderRadius: 8, alignItems: 'center' },
  supportButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});
