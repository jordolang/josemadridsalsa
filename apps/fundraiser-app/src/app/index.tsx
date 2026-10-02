import { useCallback, useState } from 'react'
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Button, Card, styles as ui } from '@/components/ui'
import { money } from '@/lib/api'
import { colors } from '@/lib/config'
import { useSession } from '@/lib/session'
import { cardPaymentsAvailable, openCardReaderSettings } from '@/lib/square'

export default function Home() {
  const { me, refresh, signOut, call } = useSession()
  const [refreshing, setRefreshing] = useState(false)

  const reload = useCallback(() => {
    refresh().catch(() => undefined)
  }, [refresh])
  useFocusEffect(reload)

  if (!me) return null

  return (
    <ScrollView
      contentContainerStyle={ui.screen}
      style={ui.safe}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true)
            await refresh().catch(() => undefined)
            setRefreshing(false)
          }}
        />
      }
    >
      <View>
        <Text style={styles.hello}>Hi, {me.seller.firstName ?? me.seller.name}!</Text>
        <Text style={styles.group}>
          {me.group.name} · {me.group.organizationName}
        </Text>
      </View>

      <Card>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{me.stats.orders}</Text>
            <Text style={styles.statLabel}>{me.stats.orders === 1 ? 'order' : 'orders'}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{money(me.stats.sales)}</Text>
            <Text style={styles.statLabel}>in sales</Text>
          </View>
        </View>
      </Card>

      <Button label="Sell" onPress={() => router.push('/sell')} />
      <Button label="Phone order (deliver later)" variant="secondary" onPress={() => router.push('/new-order')} />
      <Button label="My orders" variant="secondary" onPress={() => router.push('/orders')} />
      {me.group.cardPayments && cardPaymentsAvailable ? (
        <Button
          label="Card reader & Tap to Pay"
          variant="secondary"
          onPress={() =>
            openCardReaderSettings(call).catch((e) =>
              Alert.alert('Card payments', e instanceof Error ? e.message : String(e))
            )
          }
        />
      ) : null}
      {me.seller.isOrganizer ? (
        <Button label="Organizer tools" variant="secondary" onPress={() => router.push('/organizer')} />
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.muted}>Signed in as {me.seller.name}. You stay signed in on this phone.</Text>
        <Button label="Sign out of this phone" variant="secondary" onPress={signOut} />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  hello: { fontSize: 28, fontWeight: '700', color: colors.text },
  group: { fontSize: 16, color: colors.muted, marginTop: 2 },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: '800', color: colors.brand },
  statLabel: { color: colors.muted },
  footer: { marginTop: 24, gap: 10 },
  muted: { color: colors.muted, textAlign: 'center' },
})
