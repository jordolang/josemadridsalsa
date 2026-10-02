import { useCallback, useState } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { ErrorText, Muted, styles as ui } from '@/components/ui'
import { money, type OrderSummary } from '@/lib/api'
import { colors } from '@/lib/config'
import { useSession } from '@/lib/session'

export default function Orders() {
  const { call } = useSession()
  const [orders, setOrders] = useState<OrderSummary[] | null>(null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      setOrders((await call<{ orders: OrderSummary[] }>('/orders')).orders)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [call])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load])
  )

  if (!orders) {
    return (
      <View style={[ui.safe, ui.screen]}>
        {error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator color={colors.brand} size="large" />}
      </View>
    )
  }

  return (
    <FlatList
      style={ui.safe}
      contentContainerStyle={ui.screen}
      data={orders}
      keyExtractor={(order) => order.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true)
            await load()
            setRefreshing(false)
          }}
        />
      }
      ListEmptyComponent={<Muted>No orders yet. Your first one will show up here.</Muted>}
      ListHeaderComponent={error ? <ErrorText>{error}</ErrorText> : null}
      renderItem={({ item }) => (
        <View style={ui.card}>
          <View style={ui.row}>
            <Text style={[styles.customer, ui.fill]}>{item.customerName ?? 'Customer'}</Text>
            <Text style={styles.total}>{money(item.total)}</Text>
          </View>
          <Text style={styles.items}>{item.items.map((i) => `${i.quantity} × ${i.productName}`).join('\n')}</Text>
          <View style={ui.row}>
            <Text style={[styles.meta, ui.fill]}>
              {item.orderNumber} · {new Date(item.createdAt).toLocaleDateString()}
            </Text>
            <Text style={[styles.badge, item.paid ? styles.paid : styles.unpaid]}>
              {item.status === 'CANCELLED' ? 'Cancelled' : item.paid ? 'Paid' : 'To collect'}
            </Text>
          </View>
        </View>
      )}
    />
  )
}

const styles = StyleSheet.create({
  customer: { fontSize: 17, fontWeight: '600', color: colors.text },
  total: { fontSize: 17, fontWeight: '700', color: colors.text },
  items: { color: colors.text },
  meta: { color: colors.muted, fontSize: 13 },
  badge: { fontSize: 13, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  paid: { backgroundColor: '#DCFCE7', color: colors.green },
  unpaid: { backgroundColor: '#FEF3C7', color: '#92400E' },
})
