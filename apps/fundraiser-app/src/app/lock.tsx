import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button, ErrorText, PinField, isPin } from '@/components/ui'
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
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Text style={styles.title}>Enter your PIN</Text>
        <PinField label="" accessibilityLabel="Your PIN" value={pin} onChangeText={setPin} autoFocus onSubmitEditing={() => isPin(pin) && submit()} />
        <ErrorText>{error}</ErrorText>
        <Button label="Unlock" busy={busy} disabled={!isPin(pin)} onPress={() => submit()} />
      </View>
      <View style={styles.footer}>
        <Text style={styles.muted}>Forgot your PIN? Ask your organizer to reset it, then sign in again.</Text>
        <Button label="Sign out of this phone" variant="secondary" onPress={signOut} />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: 'space-between' },
  body: { gap: 16, marginTop: 80 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', color: colors.text },
  footer: { gap: 12 },
  muted: { textAlign: 'center', color: colors.muted },
})
