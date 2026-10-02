import { useState } from 'react'
import { Platform, Pressable, Text } from 'react-native'
import Constants from 'expo-constants'
import { Button, Card, ErrorText, Field, Muted, PinField, Screen, Title, isPin, styles } from '@/components/ui'
import { api, type RosterEntry, type SignIn } from '@/lib/api'
import { colors } from '@/lib/config'
import { useSession } from '@/lib/session'

/** Back into the app on a new phone or after a reinstall: group ID and PIN, pick your name, your own PIN. */
export default function Reclaim() {
  const { signIn } = useSession()
  const [groupCode, setGroupCode] = useState('')
  const [groupPin, setGroupPin] = useState('')
  const [roster, setRoster] = useState<RosterEntry[] | null>(null)
  const [chosen, setChosen] = useState<RosterEntry | null>(null)
  const [pin, setPin] = useState('')
  const [pinAgain, setPinAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function loadRoster() {
    setBusy(true)
    setError('')
    try {
      const result = await api<{ sellers: RosterEntry[] }>('/roster', { method: 'POST', body: { groupCode, groupPin } })
      setRoster(result.sellers)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function reclaim() {
    if (!chosen) return
    if (!chosen.hasPin && pin !== pinAgain) return setError('The two PINs do not match.')
    setBusy(true)
    setError('')
    try {
      const result = await api<SignIn>('/reclaim', {
        method: 'POST',
        body: {
          groupCode,
          groupPin,
          participantId: chosen.id,
          pin,
          platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web',
          deviceName: Constants.deviceName ?? undefined,
        },
      })
      await signIn(result.token)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  if (!roster) {
    return (
      <Screen>
        <Title subtitle="Enter your group ID and group PIN, then pick your name.">Get back in</Title>
        <Field
          label="Group ID"
          value={groupCode}
          onChangeText={(text) => setGroupCode(text.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <PinField label="Group PIN" value={groupPin} onChangeText={setGroupPin} />
        <ErrorText>{error}</ErrorText>
        <Button label="Next" busy={busy} disabled={groupCode.length < 4 || !isPin(groupPin)} onPress={loadRoster} />
      </Screen>
    )
  }

  if (!chosen) {
    return (
      <Screen>
        <Title subtitle="Tap your name.">Who are you?</Title>
        {roster.length === 0 ? <Muted>No one has joined this group yet.</Muted> : null}
        {roster.map((seller) => (
          <Pressable
            key={seller.id}
            accessibilityRole="button"
            onPress={() => {
              setChosen(seller)
              setPin('')
              setPinAgain('')
              setError('')
            }}
            style={({ pressed }) => [styles.card, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text }}>{seller.name}</Text>
          </Pressable>
        ))}
      </Screen>
    )
  }

  return (
    <Screen>
      <Title subtitle={chosen.hasPin ? 'Enter your PIN.' : 'Your organizer reset your PIN. Choose a new one.'}>
        {chosen.name}
      </Title>
      <Card>
        <PinField label={chosen.hasPin ? 'Your PIN' : 'New PIN (4–6 digits)'} value={pin} onChangeText={setPin} autoFocus />
        {chosen.hasPin ? null : <PinField label="Type it again" value={pinAgain} onChangeText={setPinAgain} />}
      </Card>
      <ErrorText>{error}</ErrorText>
      <Button label="Sign in" busy={busy} disabled={!isPin(pin)} onPress={reclaim} />
      <Button label="Not me" variant="secondary" onPress={() => setChosen(null)} />
      {chosen.hasPin ? <Muted>Forgot your PIN? Ask your organizer to reset it.</Muted> : null}
    </Screen>
  )
}
