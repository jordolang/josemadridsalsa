import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { colors } from '@/lib/config'
import { SessionProvider, useSession } from '@/lib/session'

function RootStack() {
  const { status } = useSession()

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    )
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.brand },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
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
        <Stack.Screen name="index" options={{ title: 'Jose Madrid Fundraiser' }} />
        <Stack.Screen name="new-order" options={{ title: 'New order' }} />
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
        <StatusBar style="light" />
        <RootStack />
      </SessionProvider>
    </SafeAreaProvider>
  )
}
