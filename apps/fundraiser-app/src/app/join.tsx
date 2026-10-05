import { useState } from 'react'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { Button, Card, ErrorText, Field, Muted, PinField, Screen, Title, isPin } from '@/components/ui'
import { api, type Group, type SignIn } from '@/lib/api'
import { useSession } from '@/lib/session'

/**
 * First-time setup, in two steps: the group ID and group PIN from the organizer, then the seller's
 * name and the PIN they will open the app with from now on.
 */
export default function Join() {
  const { signIn } = useSession()
  const [groupCode, setGroupCode] = useState('')
  const [groupPin, setGroupPin] = useState('')
  const [group, setGroup] = useState<Group | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [pin, setPin] = useState('')
  const [pinAgain, setPinAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function checkGroup() {
    setBusy(true)
    setError('')
    try {
      const result = await api<{ group: Group }>('/group', { method: 'POST', body: { groupCode, groupPin } })
      setGroup(result.group)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function register() {
    if (pin !== pinAgain) return setError('The two PINs do not match.')
    setBusy(true)
    setError('')
    try {
      const result = await api<SignIn>('/register', {
        method: 'POST',
        body: {
          groupCode,
          groupPin,
          firstName,
          lastName,
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

  if (!group) {
    return (
      <Screen>
        <Title subtitle="Your organizer gives every seller these two.">Your group</Title>
        <Field
          label="Group ID"
          value={groupCode}
          onChangeText={(text) => setGroupCode(text.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="e.g. K7Q4MZ"
        />
        <PinField label="Group PIN" value={groupPin} onChangeText={setGroupPin} />
        <ErrorText>{error}</ErrorText>
        <Button label="Next" busy={busy} disabled={groupCode.length < 4 || !isPin(groupPin)} onPress={checkGroup} />
      </Screen>
    )
  }

  return (
    <Screen>
      <Title subtitle={group.organizationName}>{group.name}</Title>
      <Card>
        <Field label="First name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" textContentType="givenName" />
        <Field label="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" textContentType="familyName" />
      </Card>
      <Card>
        <PinField label="Choose your PIN (4–6 digits)" value={pin} onChangeText={setPin} hint="You will enter it every time you open the app. Only your organizer can reset it." />
        <PinField label="Type it again" value={pinAgain} onChangeText={setPinAgain} />
      </Card>
      <ErrorText>{error}</ErrorText>
      <Button
        label="Join"
        busy={busy}
        disabled={!firstName.trim() || !lastName.trim() || !isPin(pin) || !isPin(pinAgain)}
        onPress={register}
      />
      <Muted>Already joined on another phone? Go back and tap &quot;I already joined&quot;.</Muted>
    </Screen>
  )
}
