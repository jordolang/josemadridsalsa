/**
 * Where the seller is in the app:
 *
 *   signed-out  no device token: set up with the group ID, group PIN and name, or reclaim
 *   locked      signed in, waiting for the personal PIN (every time the app opens)
 *   ready       unlocked; taking orders
 *
 * The device token lives in the iOS Keychain / Android Keystore and keeps the phone signed in for
 * the whole campaign. The PIN is never stored on the phone; the server checks it.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'
import { ApiError, api, tokenStore, type Me } from './api'
import { RELOCK_AFTER_MS } from './config'

type Status = 'loading' | 'signed-out' | 'locked' | 'ready'

interface Session {
  status: Status
  me: Me | null
  token: string | null
  /** After register or reclaim: keep the token and open the app (the PIN was just entered). */
  signIn: (token: string) => Promise<void>
  unlock: (pin: string) => Promise<void>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
  /** Call with any API failure: a signed-out or locked answer moves the app to the right screen. */
  handleError: (error: unknown) => void
  call: <T>(path: string, options?: { method?: 'GET' | 'POST'; body?: unknown }) => Promise<T>
}

const SessionContext = createContext<Session | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [token, setToken] = useState<string | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const backgroundedAt = useRef<number | null>(null)

  // Cold start: a saved token means signed in, but the PIN is always asked for.
  useEffect(() => {
    tokenStore
      .get()
      .then((saved) => {
        setToken(saved)
        setStatus(saved ? 'locked' : 'signed-out')
      })
      .catch(() => setStatus('signed-out'))
  }, [])

  // Coming back to the app after a while asks for the PIN again.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgroundedAt.current = Date.now()
      if (state === 'active' && backgroundedAt.current !== null) {
        const away = Date.now() - backgroundedAt.current
        backgroundedAt.current = null
        if (away > RELOCK_AFTER_MS) setStatus((current) => (current === 'ready' ? 'locked' : current))
      }
    })
    return () => subscription.remove()
  }, [])

  const forget = useCallback(async () => {
    await tokenStore.clear().catch(() => undefined)
    setToken(null)
    setMe(null)
    setStatus('signed-out')
  }, [])

  const handleError = useCallback(
    (error: unknown) => {
      if (!(error instanceof ApiError)) return
      if (error.code === 'signed_out') void forget()
      if (error.code === 'locked') setStatus('locked')
    },
    [forget]
  )

  const call = useCallback(
    async <T,>(path: string, options: { method?: 'GET' | 'POST'; body?: unknown } = {}) => {
      try {
        return await api<T>(path, { ...options, token })
      } catch (error) {
        handleError(error)
        throw error
      }
    },
    [token, handleError]
  )

  const signIn = useCallback(async (newToken: string) => {
    await tokenStore.set(newToken)
    setToken(newToken)
    setMe(await api<Me>('/me', { token: newToken }))
    setStatus('ready')
  }, [])

  const unlock = useCallback(
    async (pin: string) => {
      try {
        setMe(await api<Me>('/unlock', { method: 'POST', body: { pin }, token }))
        setStatus('ready')
      } catch (error) {
        if (error instanceof ApiError && error.code === 'signed_out') await forget()
        throw error
      }
    },
    [token, forget]
  )

  const signOut = useCallback(async () => {
    await api('/sign-out', { method: 'POST', token }).catch(() => undefined)
    await forget()
  }, [token, forget])

  const refresh = useCallback(async () => {
    setMe(await call<Me>('/me'))
  }, [call])

  const value = useMemo(
    () => ({ status, me, token, signIn, unlock, signOut, refresh, handleError, call }),
    [status, me, token, signIn, unlock, signOut, refresh, handleError, call]
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): Session {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession must be used inside SessionProvider')
  return session
}
