import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, Image, TouchableOpacity } from 'react-native';
import { api, API_BASE_URL } from '@/lib/api';
import type { Fundraiser } from '@/lib/api/types';
import { useRouter } from 'expo-router';

export default function FundraisersScreen() {
  const [fundraisers, setFundraisers] = useState<Fundraiser[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  useEffect(() => {
    loadFundraisers();
  }, []);

  const loadFundraisers = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await api.fundraisers.getFundraisers();
      const formattedData = data.map((item: Fundraiser) => {
        if (item.logoUrl?.startsWith('/')) item.logoUrl = `${API_BASE_URL}${item.logoUrl}`;
        if (item.coverPhotoUrl?.startsWith('/')) item.coverPhotoUrl = `${API_BASE_URL}${item.coverPhotoUrl}`;
        return item;
      });
      setFundraisers(formattedData);
    } catch (err: any) {
      setFundraisers([]);
      setErrorMsg(err?.message || 'Failed to load fundraisers.');
    } finally {
      setLoading(false);
    }
  };

  const renderFundraiser = ({ item }: { item: Fundraiser }) => {
    const progress = item.goal ? Math.min((item.totalRevenue / 100) / item.goal, 1) * 100 : 0;
    
    return (
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => router.push(`/fundraiser/${item.id}`)}
      >
        {item.coverPhotoUrl && <Image source={{ uri: item.coverPhotoUrl }} style={styles.coverImage} />}
        <View style={styles.cardContent}>
          <Text style={styles.title}>{item.name}</Text>
          <Text style={styles.organization}>{item.organizationName}</Text>
          
          {item.goal ? (
            <View style={styles.progressContainer}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressText}>${(item.totalRevenue / 100).toFixed(2)} raised</Text>
                <Text style={styles.progressText}>Goal: ${item.goal}</Text>
              </View>
              <View style={styles.progressBarBackground}>
                <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
              </View>
            </View>
          ) : (
            <View style={{ marginTop: 10 }}>
              <Text style={{ color: '#d32f2f', fontWeight: 'bold' }}>Active Campaign!</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#d32f2f" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={fundraisers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 15 }}
          renderItem={renderFundraiser}
          ListEmptyComponent={
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ textAlign: 'center', color: '#666', fontSize: 16 }}>
                {errorMsg ? `Network Error: ${errorMsg}` : 'No active fundraisers found.'}
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
  coverImage: { width: '100%', height: 160, backgroundColor: '#e0e0e0' },
  cardContent: { padding: 15 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 5, color: '#333' },
  organization: { fontSize: 14, color: '#666', marginBottom: 15 },
  progressContainer: { marginTop: 5 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  progressText: { fontSize: 12, color: '#444', fontWeight: '600' },
  progressBarBackground: { height: 8, backgroundColor: '#e0e0e0', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#4CAF50' },
});
