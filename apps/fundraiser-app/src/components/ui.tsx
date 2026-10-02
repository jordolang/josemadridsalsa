import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '@/lib/config'

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const body = scroll ? (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screen, styles.fill]}>{children}</View>
  )
  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {body}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

export function Title({ children, subtitle }: { children: ReactNode; subtitle?: ReactNode }) {
  return (
    <View style={styles.titleBlock}>
      <Text style={styles.title}>{children}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  )
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  busy = false,
  disabled = false,
}: {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  busy?: boolean
  disabled?: boolean
}) {
  const off = disabled || busy
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        (pressed || off) && styles.buttonDim,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.brand : '#fff'} />
      ) : (
        <Text style={[styles.buttonText, variant === 'secondary' && styles.buttonTextSecondary]}>{label}</Text>
      )}
    </Pressable>
  )
}

export function Field({ label, hint, ...input }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} style={styles.input} {...input} />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  )
}

/** A 4–6 digit PIN, hidden as it is typed. */
export function PinField(props: Omit<TextInputProps, 'onChangeText'> & { label: string; onChangeText: (pin: string) => void; hint?: string }) {
  const { onChangeText, ...rest } = props
  return (
    <Field
      keyboardType="number-pad"
      secureTextEntry
      maxLength={6}
      autoComplete="off"
      textContentType="oneTimeCode"
      onChangeText={(text) => onChangeText(text.replace(/\D/g, ''))}
      style={[styles.input, styles.pin]}
      {...rest}
    />
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <Text accessibilityRole="alert" style={styles.error}>
      {children}
    </Text>
  )
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>
}

export const isPin = (value: string) => /^\d{4,6}$/.test(value)

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  screen: { padding: 20, gap: 16 },
  titleBlock: { gap: 4, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 16, color: colors.muted },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSecondary: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.brand },
  buttonDanger: { backgroundColor: colors.danger },
  buttonDim: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  buttonTextSecondary: { color: colors.brand },
  field: { gap: 6 },
  label: { fontSize: 15, fontWeight: '600', color: colors.text },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    color: colors.text,
  },
  pin: { fontSize: 24, letterSpacing: 8, textAlign: 'center' },
  hint: { fontSize: 13, color: colors.muted },
  error: { color: colors.danger, fontSize: 15 },
  muted: { color: colors.muted, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
})
