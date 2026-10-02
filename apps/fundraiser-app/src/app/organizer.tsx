import { useCallback, useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Button, Card, ErrorText, Muted, PinField, Screen, Title, isPin, styles as ui } from '@/components/ui'
import { money, type GroupSeller } from '@/lib/api'
import { colors } from '@/lib/config'
import { useSession } from '@/lib/session'

/** The organizer seat: reset a seller's PIN, change the group PIN, see how everyone is doing. */
export default function Organizer() {
  const { call } = useSession()
  const [sellers, setSellers] = useState<GroupSeller[] | null>(null)
  const [groupPin, setGroupPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setSellers((await call<{ sellers: GroupSeller[] }>('/organizer/sellers')).sellers)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [call])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load])
  )

  function confirmReset(seller: GroupSeller) {
    Alert.alert(
      `Reset ${seller.name}'s PIN?`,
      'Their phone will be signed out. They get back in with "I already joined", pick their name and choose a new PIN.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset PIN',
          style: 'destructive',
          onPress: async () => {
            try {
              await call(`/organizer/sellers/${seller.id}/reset-pin`, { method: 'POST' })
              await load()
            } catch (e) {
              Alert.alert('Could not reset', e instanceof Error ? e.message : String(e))
            }
          },
        },
      ]
    )
  }

  async function saveGroupPin() {
    setBusy(true)
    setError('')
    try {
      await call('/organizer/group-pin', { method: 'POST', body: { pin: groupPin } })
      setGroupPin('')
      Alert.alert('Group PIN changed', 'Give the new PIN to anyone who still needs to join. Phones already signed in stay signed in.')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const totals = (sellers ?? []).reduce((sum, s) => ({ orders: sum.orders + s.orders, sales: sum.sales + s.sales }), { orders: 0, sales: 0 })

  return (
    <Screen>
      <Title subtitle={`${totals.orders} order${totals.orders === 1 ? '' : 's'} · ${money(totals.sales)} for the group`}>Sellers</Title>
      <ErrorText>{error}</ErrorText>
      {(sellers ?? []).map((seller) => (
        <Card key={seller.id}>
          <View style={ui.row}>
            <View style={ui.fill}>
              <Text style={styles.name}>
                {seller.name}
                {seller.isOrganizer ? ' (you)' : ''}
              </Text>
              <Text style={styles.meta}>
                {seller.orders} order{seller.orders === 1 ? '' : 's'} · {money(seller.sales)}
                {'\n'}
                {!seller.hasPin ? 'No PIN yet' : seller.lockedOut ? 'Locked out after wrong PINs' : seller.devices > 0 ? 'Signed in' : 'Signed out'}
              </Text>
            </View>
            {!seller.isOrganizer && (seller.hasPin || seller.lockedOut) ? (
              <View style={styles.resetButton}>
                <Button label="Reset PIN" variant="secondary" onPress={() => confirmReset(seller)} />
              </View>
            ) : null}
          </View>
        </Card>
      ))}

      <Title>Group PIN</Title>
      <Card>
        <PinField label="New group PIN" value={groupPin} onChangeText={setGroupPin} hint="Sellers need this (and the group ID) to join." />
        <Button label="Change group PIN" busy={busy} disabled={!isPin(groupPin)} onPress={saveGroupPin} />
      </Card>
      <Muted>Need your own PIN reset? Contact Jose Madrid Salsa.</Muted>
    </Screen>
  )
}

const styles = StyleSheet.create({
  name: { fontSize: 17, fontWeight: '600', color: colors.text },
  meta: { color: colors.muted, marginTop: 2 },
  resetButton: { width: 120 },
})
