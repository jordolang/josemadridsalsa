import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { colors } from '@/lib/config'
import { SessionProvider, useSession } from '@/lib/session'

function RootStack() {
  const { status } = useSession()

  if (status === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )
  }

  return (
    <Stack
      screenOptions={{
        // iOS: a transparent native header, which iOS 26 renders as Liquid Glass over the content.
        headerTransparent: Platform.OS === 'ios',
        headerStyle: Platform.OS === 'ios' ? undefined : { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.accent,
        headerTitleStyle: { color: colors.text, fontWeight: '600' },
      }}
    >
      <Stack.Protected guard={status === 'signed-out'}>
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="join" options={{ title: 'Join your group' }} />
        <Stack.Screen name="reclaim" options={{ title: 'Get back in' }} />
      </Stack.Protected>

      <Stack.Protected guard={status === 'locked'}>
        <Stack.Screen name="lock" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={status === 'ready'}>
        <Stack.Screen name="index" options={{ title: 'Fundraiser', headerLargeTitleEnabled: true }} />
        <Stack.Screen name="sell" options={{ title: 'Sell' }} />
        <Stack.Screen name="new-order" options={{ title: 'Phone order' }} />
        <Stack.Screen name="orders" options={{ title: 'My orders' }} />
        <Stack.Screen name="organizer" options={{ title: 'Organizer' }} />
      </Stack.Protected>
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <RootStack />
      </SessionProvider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
})
