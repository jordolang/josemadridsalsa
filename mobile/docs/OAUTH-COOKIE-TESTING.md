# OAuth Cookie Propagation Testing Guide

Testing guide for verifying that Google OAuth authentication works correctly on physical iOS devices. The native iOS app uses `ASWebAuthenticationSession` to open the NextAuth Google sign-in flow in a system browser sheet, then propagates session cookies back to the app.

---

## Background: How the Flow Works

```
App                          System Browser Sheet           Backend (NextAuth)
 |                                  |                              |
 |-- 1. Fetch CSRF token ----------|----------------------------->|
 |<----- csrfToken ---------------|------- Set-Cookie ----------->|
 |                                  |                              |
 |-- 2. ASWebAuthenticationSession -|                              |
 |   url: /api/auth/signin/google   |                              |
 |   scheme: josemadridsalsa://     |                              |
 |                                  |-- 3. User signs in -------->|
 |                                  |<--- 302 to Google ----------|
 |                                  |--- Google OAuth consent ---->|
 |                                  |<--- 302 callback ------------|
 |                                  |                              |
 |<-- 4. Callback URL -------------|                              |
 |   josemadridsalsa://callback     |                              |
 |                                  |                              |
 |-- 5. Fetch /api/auth/session ---|----------------------------->|
 |<----- SessionUser --------------|------- Set-Cookie ----------->|
 |                                  |                              |
 |-- 6. Persist to Keychain -------|                              |
```

### Key Components

| Component | File | Role |
|-----------|------|------|
| `AuthViewModel` | `ios-native/.../AuthViewModel.swift` | Orchestrates sign-in, manages `ASWebAuthenticationSession` |
| `AuthService` | `ios-native/.../AuthService.swift` | Builds Google OAuth URL with CSRF token |
| `KeychainManager` | `ios-native/.../KeychainManager.swift` | Persists session cookie and CSRF token to Keychain |
| `APIClient` | `ios-native/.../APIClient.swift` | Sends authenticated requests with stored cookies |

### Critical Configuration

```swift
// AuthViewModel.swift:131
session.prefersEphemeralWebBrowserSession = false
```

Setting `prefersEphemeralWebBrowserSession = false` is essential. It tells iOS to share cookies between the `ASWebAuthenticationSession` browser sheet and the app's `HTTPCookieStorage`. When `true`, the session runs in a private browsing context with no cookie sharing.

---

## Test Plan

### Prerequisites

- Physical iOS device running iOS 17+ (simulator has known cookie propagation issues)
- Backend running with Google OAuth configured (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
- Google OAuth redirect URI includes `josemadridsalsa://` custom scheme
- App built with development signing profile (not Expo Go -- native build required)

### Test 1: Basic Google OAuth Sign-In

**Steps:**
1. Launch the app on a physical device
2. Navigate to the login screen
3. Tap "Sign in with Google"
4. Verify the system browser sheet appears (not an in-app webview)
5. Complete Google sign-in with valid credentials
6. Verify the browser sheet dismisses automatically
7. Verify the app shows the authenticated state with correct user info

**Expected:**
- `ASWebAuthenticationSession` presents a Safari-like sheet
- After Google consent, the callback redirects to `josemadridsalsa://`
- The app receives the callback URL and fetches the session
- User profile (name, email, role) displays correctly

**Failure indicators:**
- Browser sheet stays open after Google consent completes
- App shows "Sign in failed" after successful Google consent
- User is `nil` after `fetchSession()` call

### Test 2: Cookie Propagation from Browser Sheet

**Steps:**
1. Sign in with Google (Test 1)
2. Immediately after sign-in, make an authenticated API call (e.g., view orders, access cart)
3. Check that the API call succeeds without a 401

**Expected:**
- The NextAuth `Set-Cookie` header from the Google OAuth callback sets the session cookie in `HTTPCookieStorage`
- Because `prefersEphemeralWebBrowserSession = false`, these cookies are shared with the app
- Subsequent `URLSession` requests include the session cookie automatically

**Failure indicators:**
- API calls return 401 immediately after OAuth sign-in
- `HTTPCookieStorage.shared.cookies` is empty after OAuth flow
- Session cookie exists in browser sheet but not in app's cookie jar

**Debug command (Xcode console):**
```swift
po HTTPCookieStorage.shared.cookies?.filter { $0.name.contains("next-auth") }
```

### Test 3: Session Persistence Across App Restarts (Keychain)

**Steps:**
1. Sign in with Google (Test 1)
2. Verify authenticated state
3. Force-quit the app (swipe up from app switcher)
4. Re-launch the app
5. Verify the app restores the session without re-authentication

**Expected:**
- On sign-in, the session cookie is stored in Keychain via `KeychainManager.save(key: .sessionCookie, data:)`
- On app launch, `AuthViewModel.checkSession()` reads from Keychain and calls `fetchSession()`
- The user sees their authenticated state immediately (after a brief loading indicator)

**Failure indicators:**
- App shows login screen after restart
- `KeychainManager.load(key: .sessionCookie)` returns `nil`
- Session cookie was only in `HTTPCookieStorage` (volatile) but not persisted to Keychain

**Keychain verification (Xcode console):**
```swift
po KeychainManager.load(key: .sessionCookie) != nil  // should be true
```

### Test 4: `prefersEphemeralWebBrowserSession = false` Behavior

**Steps:**
1. Sign out completely
2. Sign in with Google -- note that Google may show an account picker if previously signed in
3. Sign out of the app
4. Sign in with Google again
5. Verify that Google remembers the previous account (shows account picker, not full sign-in)

**Expected:**
- Because ephemeral mode is `false`, Safari cookies persist between OAuth sessions
- Google's own session cookie (`accounts.google.com`) survives across `ASWebAuthenticationSession` invocations
- The user sees "Choose an account" instead of the full Google sign-in form

**Contrast with ephemeral = true:**
- If you temporarily set `prefersEphemeralWebBrowserSession = true` and repeat, Google should require full sign-in every time (no account picker)

### Test 5: Custom URL Scheme Callback

**Steps:**
1. Verify `Info.plist` contains the `josemadridsalsa` URL scheme
2. Open Safari on the device and navigate to `josemadridsalsa://test`
3. Verify iOS prompts to open the app
4. Sign in with Google and verify the callback arrives at the app

**Expected:**
- The URL scheme `josemadridsalsa://` is registered in the app bundle
- iOS routes the callback from the NextAuth Google provider back to the app
- `ASWebAuthenticationSession` receives the callback URL in its completion handler

**Failure indicators:**
- Safari shows "Cannot Open Page" for `josemadridsalsa://test`
- OAuth flow completes in browser but app never receives callback
- Error: "No app is registered for the URL scheme josemadridsalsa"

### Test 6: OAuth Cancellation

**Steps:**
1. Tap "Sign in with Google"
2. When the browser sheet appears, tap "Cancel" (or swipe down to dismiss)
3. Verify the app returns to the login screen without an error alert

**Expected:**
- `ASWebAuthenticationSession` fires completion with `ASWebAuthenticationSessionError.canceledLogin`
- `AuthViewModel` catches this as `AuthError.oauthCancelled` and suppresses the error message
- No error alert is shown; the loading indicator stops

### Test 7: Network Failure During OAuth

**Steps:**
1. Start the Google OAuth flow
2. Enable airplane mode while the Google sign-in page is loading
3. Verify the app handles the failure gracefully

**Expected:**
- The browser sheet shows a network error
- When dismissed, the app shows the login screen (no crash)
- Error message may display depending on where the failure occurred

---

## Known Limitations and Workarounds

### 1. iOS Simulator Cookie Propagation

**Limitation:** `ASWebAuthenticationSession` on the iOS Simulator may not propagate cookies to `HTTPCookieStorage` reliably. This is a known Apple behavior -- the simulator does not fully replicate the cookie-sharing behavior of physical devices.

**Workaround:** Always test OAuth cookie propagation on a physical device. For simulator-based development, use the email/password sign-in flow instead.

### 2. First-Launch Consent Prompt

**Limitation:** On iOS 17+, the first time `ASWebAuthenticationSession` is used with `prefersEphemeralWebBrowserSession = false`, iOS shows a system prompt: "[App] wants to use [domain] to sign you in." The user must tap "Continue" to proceed.

**Workaround:** This is expected iOS behavior and cannot be suppressed. Ensure the app name and domain look trustworthy. This prompt only appears once per domain.

### 3. Cookie Expiry Mismatch

**Limitation:** NextAuth session cookies have a server-defined expiry (default: 30 days). If the Keychain-stored cookie outlives the server session, the app will have a stale token.

**Workaround:** The `checkSession()` method calls `fetchSession()` on every app launch, which validates the cookie against the server. If the server returns no session, the app clears the Keychain and shows the login screen. This is already implemented in `AuthViewModel.checkSession()`.

### 4. Multiple Google Accounts

**Limitation:** When `prefersEphemeralWebBrowserSession = false`, Google may auto-select the previously used account without showing the account picker if only one account is signed into Google on the device.

**Workaround:** Users who need to switch accounts should sign out of Google in Safari first, or the app can append `prompt=select_account` to the Google OAuth URL to force the account picker.

### 5. App Transport Security (ATS)

**Limitation:** During local development, the backend may run on `http://localhost:3000`. ATS blocks cleartext HTTP by default.

**Workaround:** Add an ATS exception for `localhost` in `Info.plist` for debug builds only. Never disable ATS globally for production builds.

### 6. Background Session Expiry

**Limitation:** If the app is backgrounded for an extended period, iOS may purge `HTTPCookieStorage` cookies (though Keychain data persists).

**Workaround:** The Keychain-based persistence (`KeychainManager`) is the source of truth for session continuity. On foreground, `checkSession()` re-validates and re-establishes `HTTPCookieStorage` cookies from the Keychain-stored token.

---

## Debugging Tips

### Inspecting Cookies

In Xcode's debug console while the app is running:

```swift
// List all cookies for the backend domain
po HTTPCookieStorage.shared.cookies(for: URL(string: "https://josemadridsalsa.com")!)

// Check for NextAuth session cookie specifically
po HTTPCookieStorage.shared.cookies?.filter { $0.name == "next-auth.session-token" }
```

### Inspecting Keychain

```swift
// Verify session is persisted
po KeychainManager.load(key: .sessionCookie)

// Verify CSRF token is stored
po KeychainManager.load(key: .csrfToken)
```

### Network Traffic

Use Charles Proxy or Proxyman to inspect the full HTTP exchange:
1. Install the proxy's root certificate on the physical device
2. Configure the device's Wi-Fi proxy settings
3. Filter traffic to the backend domain
4. Look for `Set-Cookie` headers in the OAuth callback response

### Common Failure Patterns

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| "Sign in failed" after Google consent | Cookie not propagated | Verify `prefersEphemeralWebBrowserSession = false` |
| 401 on first API call after OAuth | Missing session cookie | Check `HTTPCookieStorage` for `next-auth.session-token` |
| Session lost after app restart | Keychain save failed | Check `SecItemAdd` return status in `KeychainManager.save` |
| Browser sheet never dismisses | Callback URL scheme mismatch | Verify `josemadridsalsa://` in `Info.plist` and OAuth config |
| Google shows full sign-in every time | Ephemeral mode is `true` | Set `prefersEphemeralWebBrowserSession = false` |
| "No app registered for URL scheme" | Missing `CFBundleURLTypes` | Add `josemadridsalsa` to URL schemes in `Info.plist` |
