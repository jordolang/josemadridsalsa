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
  type ColorValue,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import { LinearGradient } from 'expo-linear-gradient'
import { colors } from '@/lib/config'

/** Native Liquid Glass (iOS 26+) when the build and device support it. */
const liquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable()

/** The soft ambient gradient every screen sits on; it is what the glass refracts. */
export function Backdrop() {
  return (
    <LinearGradient
      colors={colors.backdrop}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  )
}

/**
 * A glass surface: Apple's Liquid Glass on iOS 26, the system material blur on older iOS, and a
 * frosted translucent panel on Android.
 */
export function Glass({
  children,
  style,
  tint,
  interactive = false,
}: {
  children?: ReactNode
  style?: StyleProp<ViewStyle>
  tint?: ColorValue
  interactive?: boolean
}) {
  if (liquidGlass) {
    return (
      <GlassView style={[styles.glassShape, style]} tintColor={tint} isInteractive={interactive}>
        {children}
      </GlassView>
    )
  }
  if (Platform.OS === 'ios') {
    return (
      <View style={[styles.glassShape, styles.glassEdge, style]}>
        <BlurView tint="systemThinMaterialLight" intensity={80} style={StyleSheet.absoluteFill} />
        {tint ? <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} /> : null}
        {children}
      </View>
    )
  }
  return (
    <View style={[styles.glassShape, styles.glassEdge, styles.frosted, tint ? { backgroundColor: tint } : null, style]}>
      {children}
    </View>
  )
}

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screen, styles.fill]}>{children}</View>
  )
  return (
    <View style={styles.fill}>
      <Backdrop />
      <SafeAreaView style={styles.fill} edges={['bottom', 'left', 'right']}>
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {body}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
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

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <Glass style={[styles.card, style]}>{children}</Glass>
}

/**
 * Glass buttons. Primary is tinted with the system accent; secondary is clear glass; `go` is the
 * green used for taking money. Pressed and disabled states never touch opacity (it breaks the
 * glass effect); disabled buttons dim their label instead.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  busy = false,
  disabled = false,
}: {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'go'
  busy?: boolean
  disabled?: boolean
}) {
  const off = disabled || busy
  const tint =
    variant === 'primary' ? colors.accent : variant === 'go' ? colors.green : variant === 'danger' ? colors.danger : undefined
  const onTint = !!tint
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
      onPress={off ? undefined : onPress}
    >
      {({ pressed }) => (
        <Glass
          style={[styles.button, !liquidGlass && pressed && !off && styles.buttonPressed]}
          tint={off ? undefined : tint}
          interactive={!off}
        >
          {busy ? (
            <ActivityIndicator color={onTint ? '#fff' : colors.accent} />
          ) : (
            <Text
              style={[
                styles.buttonText,
                onTint && !off ? styles.buttonTextOnTint : styles.buttonTextPlain,
                off && styles.buttonTextOff,
              ]}
            >
              {label}
            </Text>
          )}
        </Glass>
      )}
    </Pressable>
  )
}

export function Field({ label, hint, ...input }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
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
  safe: { flex: 1 },
  fill: { flex: 1 },
  screen: { padding: 20, gap: 16 },
  glassShape: { borderRadius: 22, overflow: 'hidden' },
  glassEdge: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255, 255, 255, 0.7)' },
  frosted: { backgroundColor: 'rgba(255, 255, 255, 0.72)' },
  titleBlock: { gap: 4, marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: 0.2 },
  subtitle: { fontSize: 16, color: colors.muted },
  card: { padding: 18, gap: 12 },
  button: {
    borderRadius: 26,
    minHeight: 52,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: { transform: [{ scale: 0.98 }] },
  buttonText: { fontSize: 17, fontWeight: '600' },
  buttonTextOnTint: { color: '#fff' },
  buttonTextPlain: { color: colors.accent },
  buttonTextOff: { color: colors.muted },
  field: { gap: 6 },
  label: { fontSize: 15, fontWeight: '600', color: colors.text },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 14,
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
