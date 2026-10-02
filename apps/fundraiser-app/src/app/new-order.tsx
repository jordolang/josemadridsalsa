import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native'
import { router } from 'expo-router'
import { randomUUID } from 'expo-crypto'
import { Button, Card, ErrorText, Field, Muted, Screen, Title, styles as ui } from '@/components/ui'
import { money, type Product } from '@/lib/api'
import { colors } from '@/lib/config'
import { useSession } from '@/lib/session'
import { cancelCardOrder, cardPaymentsAvailable, chargeOrder } from '@/lib/square'

type Payment = 'CASH' | 'CHECK' | 'PAY_LATER' | 'CARD'

const PAYMENTS: { value: Payment; label: string }[] = [
  { value: 'CARD', label: 'Card' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CHECK', label: 'Check' },
  { value: 'PAY_LATER', label: 'Pay later' },
]

interface SavedOrder {
  id: string
  orderNumber: string
  total: number
  amountCents: number
  paid: boolean
  awaitingCard: boolean
}

/**
 * Take an order over the phone. The app sends what was ordered and who it is for; the server
 * prices it from the group's store and records it on the fundraising platform.
 */
export default function NewOrder() {
  const { call, me } = useSession()
  const takesCards = !!me?.group.cardPayments && cardPaymentsAvailable
  const payments = PAYMENTS.filter((option) => option.value !== 'CARD' || takesCards)
  // An order recorded and waiting on its card (declined, canceled, or interrupted).
  const [cardOrder, setCardOrder] = useState<SavedOrder | null>(null)
  const [products, setProducts] = useState<Product[] | null>(null)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [delivering, setDelivering] = useState(false)
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('OH')
  const [zipCode, setZipCode] = useState('')
  const [payment, setPayment] = useState<Payment | null>(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // One id per order, reused if the seller has to tap Save again after a dropped connection.
  const clientOrderId = useRef(randomUUID())

  useEffect(() => {
    call<{ products: Product[] }>('/catalog')
      .then((result) => setProducts(result.products))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [call])

  const lines = (products ?? []).filter((p) => (quantities[p.id] ?? 0) > 0)
  const jars = lines.reduce((sum, p) => sum + quantities[p.id], 0)
  const total = lines.reduce((sum, p) => sum + p.price * quantities[p.id], 0)
  const addressOk = !delivering || (street.trim() && city.trim() && state.trim().length >= 2 && zipCode.trim().length >= 3)
  const ready = jars > 0 && firstName.trim() && lastName.trim() && phone.trim().length >= 7 && payment && addressOk

  const change = (id: string, delta: number) =>
    setQuantities((q) => ({ ...q, [id]: Math.max(0, Math.min(500, (q[id] ?? 0) + delta)) }))

  function finished(order: { orderNumber: string; total: number; paid: boolean }, how: string) {
    Alert.alert('Order saved', `${order.orderNumber}\n${money(order.total)} · ${how}`, [
      { text: 'Done', onPress: () => router.back() },
    ])
  }

  async function charge(order: SavedOrder, retry = false) {
    setBusy(true)
    setError('')
    const result = await chargeOrder(call, order, { retry })
    setBusy(false)
    if (result.status === 'paid') {
      setCardOrder(null)
      finished({ ...order, paid: true }, 'paid by card')
    } else {
      setCardOrder(order)
      setError(result.message)
    }
  }

  async function giveUpOnCard() {
    if (!cardOrder) return
    setBusy(true)
    try {
      const result = await cancelCardOrder(call, cardOrder.id)
      if (result.status === 'COMPLETED') {
        setCardOrder(null)
        return finished({ ...cardOrder, paid: true }, 'paid by card')
      }
      // The cart stays filled: pick another way to pay and save again as a new order.
      setCardOrder(null)
      setPayment(null)
      clientOrderId.current = randomUUID()
      setError('Card order canceled. Choose another way to pay and save again.')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    setBusy(true)
    setError('')
    try {
      const { order } = await call<{ order: SavedOrder }>('/orders', {
        method: 'POST',
        body: {
          clientOrderId: clientOrderId.current,
          customer: { firstName, lastName, phone, email: email.trim() || undefined },
          address: delivering ? { street, city, state, zipCode } : undefined,
          items: lines.map((p) => ({ productId: p.id, quantity: quantities[p.id] })),
          payment,
          notes: notes.trim() || undefined,
        },
      })
      if (order.awaitingCard) {
        await charge(order)
        return
      }
      finished(order, order.paid ? 'paid' : 'to collect on delivery')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (!products) {
    return (
      <Screen>
        {error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator color={colors.brand} size="large" />}
      </Screen>
    )
  }

  return (
    <Screen>
      <Title subtitle="Tap + for each jar.">Salsas</Title>
      <Card>
        {products.length === 0 ? <Muted>Your fundraiser has no salsas on sale yet.</Muted> : null}
        {products.map((product) => (
          <View key={product.id} style={styles.product}>
            <View style={ui.fill}>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productPrice}>{money(product.price)}</Text>
            </View>
            <Stepper value={quantities[product.id] ?? 0} onChange={(delta) => change(product.id, delta)} name={product.name} />
          </View>
        ))}
      </Card>

      <Title>Customer</Title>
      <Card>
        <Field label="First name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
        <Field label="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
        <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" textContentType="telephoneNumber" />
        <Field
          label="Email (optional)"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={ui.row}>
          <Text style={[ui.label, ui.fill]}>I will deliver to an address</Text>
          <Switch value={delivering} onValueChange={setDelivering} />
        </View>
        {delivering ? (
          <>
            <Field label="Street" value={street} onChangeText={setStreet} textContentType="streetAddressLine1" />
            <Field label="City" value={city} onChangeText={setCity} textContentType="addressCity" />
            <View style={ui.row}>
              <View style={ui.fill}>
                <Field label="State" value={state} onChangeText={setState} autoCapitalize="characters" maxLength={20} />
              </View>
              <View style={ui.fill}>
                <Field label="ZIP" value={zipCode} onChangeText={setZipCode} keyboardType="number-pad" maxLength={10} />
              </View>
            </View>
          </>
        ) : null}
      </Card>

      <Title>Payment</Title>
      <View style={ui.row}>
        {payments.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: payment === option.value }}
            onPress={() => !cardOrder && setPayment(option.value)}
            style={[styles.choice, payment === option.value && styles.choiceOn]}
          >
            <Text style={[styles.choiceText, payment === option.value && styles.choiceTextOn]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
      <Muted>
        {payment === 'CARD'
          ? 'Tap the card or phone on your phone, or type the card number in for a phone order. It goes to Jose Madrid Salsa through Square.'
          : payment === 'PAY_LATER'
            ? 'Collect the money when you deliver. Your group is credited once Jose Madrid marks it paid.'
            : 'Pick Cash or Check only if you have the money in hand.'}
      </Muted>
      <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />

      <Card>
        <View style={ui.row}>
          <Text style={[styles.totalLabel, ui.fill]}>
            {jars} jar{jars === 1 ? '' : 's'}
          </Text>
          <Text style={styles.total}>{money(total)}</Text>
        </View>
      </Card>
      <ErrorText>{error}</ErrorText>
      {cardOrder ? (
        <>
          <Button label={`Try card again (${money(cardOrder.total)})`} busy={busy} onPress={() => charge(cardOrder, true)} />
          <Button label="Cancel card order" variant="secondary" disabled={busy} onPress={giveUpOnCard} />
        </>
      ) : (
        <Button label={payment === 'CARD' ? 'Save and take card' : 'Save order'} busy={busy} disabled={!ready} onPress={save} />
      )}
    </Screen>
  )
}

function Stepper({ value, onChange, name }: { value: number; onChange: (delta: number) => void; name: string }) {
  return (
    <View style={ui.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={`One less ${name}`} onPress={() => onChange(-1)} style={styles.step} hitSlop={8}>
        <Text style={styles.stepText}>−</Text>
      </Pressable>
      <Text style={styles.qty}>{value}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`One more ${name}`} onPress={() => onChange(1)} style={[styles.step, styles.stepPlus]} hitSlop={8}>
        <Text style={[styles.stepText, { color: '#fff' }]}>+</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  product: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  productName: { fontSize: 17, fontWeight: '600', color: colors.text },
  productPrice: { color: colors.muted },
  step: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPlus: { backgroundColor: colors.brand },
  stepText: { fontSize: 22, fontWeight: '700', color: colors.brand, lineHeight: 26 },
  qty: { minWidth: 28, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.text },
  choice: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  choiceOn: { borderColor: colors.brand, backgroundColor: '#FEF2F2' },
  choiceText: { fontSize: 16, fontWeight: '600', color: colors.text },
  choiceTextOn: { color: colors.brand },
  totalLabel: { fontSize: 17, color: colors.text },
  total: { fontSize: 24, fontWeight: '800', color: colors.text },
})
