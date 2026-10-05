import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Backdrop, Button, ErrorText, Glass, PinField, isPin } from '@/components/ui'
import { colors } from '@/lib/config'
import { useSession } from '@/lib/session'

/** Asked every time the app opens. */
export default function Lock() {
  const { unlock, signOut } = useSession()
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(value = pin) {
    setBusy(true)
    setError('')
    try {
      await unlock(value)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setPin('')
      setBusy(false)
    }
  }

  return (
    <View style={styles.fill}>
      <Backdrop />
      <SafeAreaView style={styles.safe}>
        <Glass style={styles.body}>
          <Text style={styles.title}>Enter your PIN</Text>
          <PinField
            label=""
            accessibilityLabel="Your PIN"
            value={pin}
            onChangeText={setPin}
            autoFocus
            onSubmitEditing={() => isPin(pin) && submit()}
          />
          <ErrorText>{error}</ErrorText>
          <Button label="Unlock" busy={busy} disabled={!isPin(pin)} onPress={() => submit()} />
        </Glass>
        <View style={styles.footer}>
          <Text style={styles.muted}>Forgot your PIN? Ask your organizer to reset it, then sign in again.</Text>
          <Button label="Sign out of this phone" variant="secondary" onPress={signOut} />
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  safe: { flex: 1, padding: 24, justifyContent: 'space-between' },
  body: { gap: 16, marginTop: 80, padding: 22, borderRadius: 30 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', color: colors.text },
  footer: { gap: 12 },
  muted: { textAlign: 'center', color: colors.muted },
})
