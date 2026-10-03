import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { randomUUID } from 'expo-crypto'
import { LinearGradient } from 'expo-linear-gradient'
import { Backdrop, Button, ErrorText, Glass, Muted } from '@/components/ui'
import { money, type Product } from '@/lib/api'
import { colors, imageUrl } from '@/lib/config'
import { useSession } from '@/lib/session'
import { cancelCardOrder, cardPaymentsAvailable, chargeOrder, warmUpCardReader } from '@/lib/square'

interface Sale {
  id: string
  orderNumber: string
  total: number
  amountCents: number
  paid: boolean
  awaitingCard: boolean
}

type Stage =
  | { kind: 'cart' }
  | { kind: 'working'; label: string }
  | { kind: 'paid'; orderNumber: string; total: number; how: string }
  | { kind: 'card-failed'; sale: Sale; message: string }

/**
 * The register: tap salsas, tap Charge, hold the phone out. Products and prices are the group's
 * own store, from the storefront. The buyer pays by tapping their card, phone or watch on the
 * seller's phone (Square Tap to Pay); cash and check are one tap away.
 */
export default function Sell() {
  const { call, me } = useSession()
  const takesCards = !!me?.group.cardPayments && cardPaymentsAvailable
  const [products, setProducts] = useState<Product[] | null>(null)
  const [cart, setCart] = useState<Record<string, number>>({})
  const [stage, setStage] = useState<Stage>({ kind: 'cart' })
  const [error, setError] = useState('')
  // One id per sale, reused if the seller has to try again after a dropped connection.
  const saleId = useRef(randomUUID())

  useEffect(() => {
    call<{ products: Product[] }>('/catalog')
      .then((result) => setProducts(result.products))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
    // Sign in to Square now, so Charge opens the tap screen straight away.
    if (takesCards) warmUpCardReader(call).catch(() => undefined)
  }, [call, takesCards])

  const lines = (products ?? []).filter((p) => (cart[p.id] ?? 0) > 0)
  const jars = lines.reduce((sum, p) => sum + cart[p.id], 0)
  const total = lines.reduce((sum, p) => sum + p.price * cart[p.id], 0)

  const add = (id: string, delta: number) =>
    setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(500, (c[id] ?? 0) + delta)) }))

  const newSale = useCallback(() => {
    saleId.current = randomUUID()
    setCart({})
    setError('')
    setStage({ kind: 'cart' })
  }, [])

  async function record(payment: 'CARD' | 'CASH' | 'CHECK') {
    return (
      await call<{ order: Sale }>('/orders', {
        method: 'POST',
        body: {
          clientOrderId: saleId.current,
          items: lines.map((p) => ({ productId: p.id, quantity: cart[p.id] })),
          payment,
        },
      })
    ).order
  }

  async function chargeCard(existing?: Sale) {
    setError('')
    setStage({ kind: 'working', label: existing ? 'Checking the card…' : 'Getting the card reader ready…' })
    try {
      const sale = existing ?? (await record('CARD'))
      if (sale.paid) return setStage({ kind: 'paid', orderNumber: sale.orderNumber, total: sale.total, how: 'Paid by card' })
      const result = await chargeOrder(call, sale, { retry: !!existing })
      if (result.status === 'paid') {
        setStage({ kind: 'paid', orderNumber: result.orderNumber, total: sale.total, how: 'Paid by card' })
      } else {
        setStage({ kind: 'card-failed', sale, message: result.message })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStage({ kind: 'cart' })
    }
  }

  function takeCashOrCheck(payment: 'CASH' | 'CHECK') {
    const what = payment === 'CASH' ? 'cash' : 'a check'
    Alert.alert(`Collected ${money(total)} in ${what}?`, 'Only record it once the money is in your hand.', [
      { text: 'Not yet', style: 'cancel' },
      {
        text: 'Yes, record it',
        onPress: async () => {
          setError('')
          setStage({ kind: 'working', label: 'Recording the sale…' })
          try {
            const sale = await record(payment)
            setStage({ kind: 'paid', orderNumber: sale.orderNumber, total: sale.total, how: payment === 'CASH' ? 'Paid in cash' : 'Paid by check' })
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
            setStage({ kind: 'cart' })
          }
        },
      },
    ])
  }

  async function cancelCardSale(sale: Sale) {
    setStage({ kind: 'working', label: 'Canceling…' })
    try {
      const result = await cancelCardOrder(call, sale.id)
      if (result.status === 'COMPLETED') {
        return setStage({ kind: 'paid', orderNumber: result.orderNumber, total: sale.total, how: 'Paid by card' })
      }
      // Keep the cart so the seller can take cash instead; a fresh sale id makes it a new order.
      saleId.current = randomUUID()
      setStage({ kind: 'cart' })
      setError('Card sale canceled. The cart is still here if they want to pay another way.')
    } catch (e) {
      setStage({ kind: 'card-failed', sale, message: e instanceof Error ? e.message : String(e) })
    }
  }

  if (stage.kind === 'paid') {
    return (
      <View style={styles.fill}>
        <LinearGradient colors={['#46D08A', colors.green]} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.fill} edges={['bottom', 'left', 'right']}>
          <View style={styles.paidBody}>
            <Glass style={styles.paidCard} tint="rgba(16, 110, 60, 0.45)">
              <Text style={styles.check}>✓</Text>
              <Text style={styles.paidAmount}>{money(stage.total)}</Text>
              <Text style={styles.paidHow}>{stage.how}</Text>
              <Text style={styles.paidNumber}>{stage.orderNumber}</Text>
            </Glass>
          </View>
          <View style={styles.footer}>
            <Button label="New sale" onPress={newSale} />
            <Button label="Done" variant="secondary" onPress={() => router.back()} />
          </View>
        </SafeAreaView>
      </View>
    )
  }

  if (stage.kind === 'working') {
    return (
      <View style={[styles.fill, styles.center]}>
        <Backdrop />
        <Glass style={styles.workingCard}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.working}>{stage.label}</Text>
        </Glass>
      </View>
    )
  }

  if (stage.kind === 'card-failed') {
    return (
      <View style={styles.fill}>
        <Backdrop />
        <SafeAreaView style={[styles.fill, styles.center, styles.pad]} edges={['bottom', 'left', 'right']}>
          <Glass style={styles.failCard}>
            <Text style={styles.failTitle}>Card not charged</Text>
            <Text style={styles.failMessage}>{stage.message}</Text>
          </Glass>
          <View style={styles.footer}>
            <Button label={`Try again (${money(stage.sale.total)})`} onPress={() => chargeCard(stage.sale)} />
            <Button label="Cancel this sale" variant="secondary" onPress={() => cancelCardSale(stage.sale)} />
          </View>
        </SafeAreaView>
      </View>
    )
  }

  return (
    <View style={styles.fill}>
      <Backdrop />
      <SafeAreaView style={styles.fill} edges={['bottom', 'left', 'right']}>
        {!products ? (
          <View style={[styles.fill, styles.center, styles.pad]}>
            {error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator size="large" color={colors.accent} />}
          </View>
        ) : (
          <FlatList
            data={products}
            keyExtractor={(p) => p.id}
            numColumns={2}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.grid}
            contentInsetAdjustmentBehavior="automatic"
            ListEmptyComponent={<Muted>Your fundraiser has no salsas on sale yet.</Muted>}
            renderItem={({ item }) => {
              const qty = cart[item.id] ?? 0
              const photo = imageUrl(item.imageUrl)
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${item.name}, ${money(item.price)}${qty ? `, ${qty} in the sale` : ''}`}
                  onPress={() => add(item.id, 1)}
                  style={styles.tileSlot}
                >
                  <Glass style={[styles.tile, qty > 0 && styles.tileOn]} interactive>
                    {photo ? (
                      <Image source={{ uri: photo }} style={styles.photo} resizeMode="contain" />
                    ) : (
                      <View style={[styles.photo, styles.noPhoto]} />
                    )}
                    <Text style={styles.name} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={styles.price}>{money(item.price)}</Text>
                  </Glass>
                  {qty > 0 ? (
                    <>
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{qty}</Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove one ${item.name}`}
                        onPress={() => add(item.id, -1)}
                        hitSlop={10}
                        style={styles.minusSlot}
                      >
                        <Glass style={styles.minus} interactive>
                          <Text style={styles.minusText}>−</Text>
                        </Glass>
                      </Pressable>
                    </>
                  ) : null}
                </Pressable>
              )
            }}
          />
        )}

        <Glass style={styles.bar}>
          <ErrorText>{error}</ErrorText>
          <View style={styles.summary}>
            <Text style={styles.summaryText}>
              {jars === 0 ? 'Tap a salsa to add it' : `${jars} jar${jars === 1 ? '' : 's'}`}
            </Text>
            {jars > 0 ? (
              <Pressable accessibilityRole="button" onPress={newSale} hitSlop={10}>
                <Text style={styles.clear}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
          {takesCards ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Charge ${money(total)} by card`}
              disabled={jars === 0}
              onPress={() => chargeCard()}
            >
              <Glass style={styles.charge} tint={jars === 0 ? undefined : colors.green} interactive={jars > 0}>
                <Text style={[styles.chargeText, jars === 0 && styles.chargeTextOff]}>Charge {money(total)}</Text>
                <Text style={[styles.chargeHint, jars === 0 && styles.chargeTextOff]}>Tap card, phone or watch</Text>
              </Glass>
            </Pressable>
          ) : (
            <Muted>
              {me?.group.cardPayments
                ? 'Card payments need the store version of the app.'
                : 'Card payments are off for your group. Take cash or a check.'}
            </Muted>
          )}
          <View style={styles.otherWays}>
            <View style={styles.fill}>
              <Button label="Cash" variant="secondary" disabled={jars === 0} onPress={() => takeCashOrCheck('CASH')} />
            </View>
            <View style={styles.fill}>
              <Button label="Check" variant="secondary" disabled={jars === 0} onPress={() => takeCashOrCheck('CHECK')} />
            </View>
          </View>
        </Glass>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  pad: { padding: 24 },
  grid: { padding: 14, gap: 14, paddingBottom: 24 },
  row: { gap: 14 },
  tileSlot: { flex: 1 },
  tile: { padding: 12, alignItems: 'center', borderRadius: 24 },
  tileOn: { borderWidth: 2, borderColor: colors.accent },
  photo: { width: '100%', height: 110, marginBottom: 8 },
  noPhoto: { backgroundColor: colors.border, borderRadius: 12 },
  name: { fontSize: 15, fontWeight: '600', color: colors.text, textAlign: 'center' },
  price: { fontSize: 15, color: colors.muted, marginTop: 2 },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    paddingHorizontal: 6,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  minusSlot: { position: 'absolute', top: 8, left: 8 },
  minus: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  minusText: { color: colors.text, fontSize: 20, fontWeight: '700', lineHeight: 22 },
  bar: { marginHorizontal: 12, marginBottom: 8, padding: 14, gap: 10, borderRadius: 30 },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  summaryText: { fontSize: 16, color: colors.text, fontWeight: '600' },
  clear: { fontSize: 16, color: colors.accent, fontWeight: '600' },
  charge: { borderRadius: 26, paddingVertical: 14, alignItems: 'center' },
  chargeText: { color: '#fff', fontSize: 26, fontWeight: '700' },
  chargeHint: { color: 'rgba(255, 255, 255, 0.85)', fontSize: 14, marginTop: 2 },
  chargeTextOff: { color: colors.muted },
  otherWays: { flexDirection: 'row', gap: 10 },
  workingCard: { padding: 28, alignItems: 'center', gap: 14, marginHorizontal: 32 },
  working: { fontSize: 17, color: colors.text },
  paidBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  paidCard: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 40, gap: 4, borderRadius: 32 },
  check: { fontSize: 84, color: '#fff', fontWeight: '700' },
  paidAmount: { fontSize: 44, color: '#fff', fontWeight: '700' },
  paidHow: { fontSize: 20, color: '#fff' },
  paidNumber: { fontSize: 14, color: 'rgba(255, 255, 255, 0.85)', marginTop: 8 },
  failCard: { padding: 24, alignItems: 'center', alignSelf: 'stretch' },
  failTitle: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 8 },
  failMessage: { fontSize: 16, color: colors.muted, textAlign: 'center' },
  footer: { gap: 12, padding: 24, alignSelf: 'stretch' },
})
