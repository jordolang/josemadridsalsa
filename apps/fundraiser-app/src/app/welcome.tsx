import { router } from 'expo-router'
import { Image, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@/components/ui'
import { colors } from '@/lib/config'

export default function Welcome() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.hero}>
        <Image source={require('../../assets/icon.png')} style={styles.logo} accessibilityIgnoresInvertColors />
        <Text style={styles.title}>Jose Madrid Fundraiser</Text>
        <Text style={styles.subtitle}>Take salsa orders for your group, right from your phone.</Text>
      </View>
      <View style={styles.actions}>
        <Button label="Join my group" onPress={() => router.push('/join')} />
        <Button label="I already joined" variant="secondary" onPress={() => router.push('/reclaim')} />
        <Text style={styles.note}>You need the group ID and group PIN from your organizer.</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, justifyContent: 'space-between', padding: 24 },
  hero: { alignItems: 'center', gap: 12, marginTop: 48 },
  logo: { width: 120, height: 120, borderRadius: 24 },
  title: { fontSize: 30, fontWeight: '800', color: colors.brandDark, textAlign: 'center' },
  subtitle: { fontSize: 17, color: colors.muted, textAlign: 'center' },
  actions: { gap: 12 },
  note: { textAlign: 'center', color: colors.muted, fontSize: 14 },
})
