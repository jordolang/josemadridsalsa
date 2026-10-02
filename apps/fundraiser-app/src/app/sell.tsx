import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { randomUUID } from 'expo-crypto'
import { Button, ErrorText, Muted } from '@/components/ui'
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
      <SafeAreaView style={[styles.fill, styles.paid]} edges={['bottom', 'left', 'right']}>
        <View style={styles.paidBody}>
          <Text style={styles.check}>✓</Text>
          <Text style={styles.paidAmount}>{money(stage.total)}</Text>
          <Text style={styles.paidHow}>{stage.how}</Text>
          <Text style={styles.paidNumber}>{stage.orderNumber}</Text>
        </View>
        <View style={styles.footer}>
          <Button label="New sale" onPress={newSale} />
          <Button label="Done" variant="secondary" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    )
  }

  if (stage.kind === 'working') {
    return (
      <View style={[styles.fill, styles.center]}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={styles.working}>{stage.label}</Text>
      </View>
    )
  }

  if (stage.kind === 'card-failed') {
    return (
      <SafeAreaView style={[styles.fill, styles.center, styles.pad]} edges={['bottom', 'left', 'right']}>
        <Text style={styles.failTitle}>Card not charged</Text>
        <Text style={styles.failMessage}>{stage.message}</Text>
        <View style={styles.footer}>
          <Button label={`Try again (${money(stage.sale.total)})`} onPress={() => chargeCard(stage.sale)} />
          <Button label="Cancel this sale" variant="secondary" onPress={() => cancelCardSale(stage.sale)} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.fill} edges={['bottom', 'left', 'right']}>
      {!products ? (
        <View style={[styles.fill, styles.center, styles.pad]}>
          {error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator size="large" color={colors.brand} />}
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          ListEmptyComponent={<Muted>Your fundraiser has no salsas on sale yet.</Muted>}
          renderItem={({ item }) => {
            const qty = cart[item.id] ?? 0
            const photo = imageUrl(item.imageUrl)
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Add ${item.name}, ${money(item.price)}${qty ? `, ${qty} in the sale` : ''}`}
                onPress={() => add(item.id, 1)}
                style={({ pressed }) => [styles.tile, qty > 0 && styles.tileOn, pressed && styles.pressed]}
              >
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.photo} resizeMode="contain" />
                ) : (
                  <View style={[styles.photo, styles.noPhoto]} />
                )}
                <Text style={styles.name} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.price}>{money(item.price)}</Text>
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
                      style={styles.minus}
                    >
                      <Text style={styles.minusText}>−</Text>
                    </Pressable>
                  </>
                ) : null}
              </Pressable>
            )
          }}
        />
      )}

      <View style={styles.bar}>
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
            style={({ pressed }) => [styles.charge, (jars === 0 || pressed) && styles.chargeDim]}
          >
            <Text style={styles.chargeText}>Charge {money(total)}</Text>
            <Text style={styles.chargeHint}>Tap card, phone or watch</Text>
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
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  pad: { padding: 24 },
  grid: { padding: 12, gap: 12 },
  row: { gap: 12 },
  tile: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },
  tileOn: { borderColor: colors.brand },
  pressed: { opacity: 0.7 },
  photo: { width: '100%', height: 110, marginBottom: 8 },
  noPhoto: { backgroundColor: colors.border, borderRadius: 8 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text, textAlign: 'center' },
  price: { fontSize: 15, color: colors.muted, marginTop: 2 },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    paddingHorizontal: 6,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  minus: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: colors.brand,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  minusText: { color: colors.brand, fontSize: 20, fontWeight: '800', lineHeight: 22 },
  bar: {
    padding: 16,
    gap: 10,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryText: { fontSize: 16, color: colors.text, fontWeight: '600' },
  clear: { fontSize: 16, color: colors.brand, fontWeight: '600' },
  charge: {
    backgroundColor: colors.green,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  chargeDim: { opacity: 0.5 },
  chargeText: { color: '#fff', fontSize: 26, fontWeight: '800' },
  chargeHint: { color: '#DCFCE7', fontSize: 14, marginTop: 2 },
  otherWays: { flexDirection: 'row', gap: 10 },
  working: { marginTop: 16, fontSize: 17, color: colors.text },
  paid: { backgroundColor: colors.green },
  paidBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  check: { fontSize: 96, color: '#fff', fontWeight: '800' },
  paidAmount: { fontSize: 44, color: '#fff', fontWeight: '800' },
  paidHow: { fontSize: 20, color: '#fff' },
  paidNumber: { fontSize: 14, color: '#DCFCE7', marginTop: 8 },
  failTitle: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 8 },
  failMessage: { fontSize: 16, color: colors.muted, textAlign: 'center', marginBottom: 24 },
  footer: { gap: 12, padding: 24, alignSelf: 'stretch' },
})
