import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Backdrop, Button, Card, ErrorText, Muted, styles as ui } from '@/components/ui'
import { money, type OrderSummary } from '@/lib/api'
import { colors } from '@/lib/config'
import { useSession } from '@/lib/session'
import { cancelCardOrder, cardPaymentsAvailable, chargeOrder } from '@/lib/square'

export default function Orders() {
  const { call } = useSession()
  const [orders, setOrders] = useState<OrderSummary[] | null>(null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setOrders((await call<{ orders: OrderSummary[] }>('/orders')).orders)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [call])

  // Finish a card sale the app was closed in the middle of. Square is checked first, so a card
  // that was already charged is recorded rather than charged again.
  async function finishCard(order: OrderSummary) {
    setBusyId(order.id)
    const result = await chargeOrder(call, order, { retry: true })
    setBusyId(null)
    if (result.status === 'paid') Alert.alert('Card payment recorded', result.orderNumber)
    else Alert.alert('Card not charged', result.message)
    await load()
  }

  async function cancelCard(order: OrderSummary) {
    setBusyId(order.id)
    try {
      const result = await cancelCardOrder(call, order.id)
      Alert.alert(result.status === 'COMPLETED' ? 'The card was already charged' : 'Order canceled', result.orderNumber)
    } catch (e) {
      Alert.alert('Could not cancel', e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(null)
      await load()
    }
  }

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load])
  )

  if (!orders) {
    return (
      <View style={[ui.fill, ui.screen]}>
        <Backdrop />
        {error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator color={colors.accent} size="large" />}
      </View>
    )
  }

  return (
    <View style={ui.fill}>
      <Backdrop />
      <FlatList
        style={ui.fill}
        contentContainerStyle={ui.screen}
        contentInsetAdjustmentBehavior="automatic"
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
          <Card style={styles.order}>
            <View style={ui.row}>
              <Text style={[styles.customer, ui.fill]}>{item.customerName ?? 'Walk-up sale'}</Text>
              <Text style={styles.total}>{money(item.total)}</Text>
            </View>
            <Text style={styles.items}>{item.items.map((i) => `${i.quantity} × ${i.productName}`).join('\n')}</Text>
            <View style={ui.row}>
              <Text style={[styles.meta, ui.fill]}>
                {item.orderNumber} · {new Date(item.createdAt).toLocaleDateString()}
              </Text>
              <Text style={[styles.badge, item.paid ? styles.paid : styles.unpaid]}>
                {item.status === 'CANCELLED'
                  ? 'Cancelled'
                  : item.paid
                    ? 'Paid'
                    : item.awaitingCard
                      ? 'Card not finished'
                      : 'To collect'}
              </Text>
            </View>
            {item.awaitingCard ? (
              <View style={styles.cardActions}>
                {cardPaymentsAvailable ? (
                  <Button
                    label={`Finish card payment (${money(item.total)})`}
                    busy={busyId === item.id}
                    disabled={busyId !== null}
                    onPress={() => finishCard(item)}
                  />
                ) : null}
                <Button
                  label="Cancel this order"
                  variant="secondary"
                  disabled={busyId !== null}
                  onPress={() => cancelCard(item)}
                />
              </View>
            ) : null}
          </Card>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  customer: { fontSize: 17, fontWeight: '600', color: colors.text },
  total: { fontSize: 17, fontWeight: '700', color: colors.text },
  items: { color: colors.text },
  meta: { color: colors.muted, fontSize: 13 },
  badge: {
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  paid: { backgroundColor: 'rgba(30, 158, 90, 0.14)', color: colors.green },
  unpaid: { backgroundColor: 'rgba(255, 159, 10, 0.16)', color: '#A05A00' },
  cardActions: { gap: 8, marginTop: 4 },
  order: { gap: 8 },
})
