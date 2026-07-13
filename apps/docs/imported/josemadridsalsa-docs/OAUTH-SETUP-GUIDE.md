# OAuth Provider Setup Guide

This guide walks you through creating OAuth applications for each social login provider used by Jose Madrid Salsa. Once configured, users can sign in with Google, GitHub, Facebook, or Apple in addition to email/password.

---

## Prerequisites

- Access to your Vercel project dashboard for setting environment variables
- Your production domain: `https://www.josemadrid.net`
- Your local dev URL: `http://localhost:3000`

### Callback URL Pattern

Every OAuth provider needs a **callback URL** (also called redirect URI). NextAuth uses this pattern:

```
https://www.josemadrid.net/api/auth/callback/{provider}
```

For local development, also add:

```
http://localhost:3000/api/auth/callback/{provider}
```

Where `{provider}` is one of: `google`, `github`, `facebook`, `apple`.

---

## 1. Google OAuth (Already Configured)

Your Google OAuth is already set up and working. These instructions are here for reference if you ever need to reconfigure it.

### Console

https://console.cloud.google.com/apis/credentials

### Callback URLs

```
https://www.josemadrid.net/api/auth/callback/google
http://localhost:3000/api/auth/callback/google
```

### Environment Variables

```
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>
```

---

## 2. GitHub OAuth

### Step 1: Go to GitHub Developer Settings

Open: https://github.com/settings/developers

Click **"OAuth Apps"** in the left sidebar, then **"New OAuth App"**.

### Step 2: Fill in the Application Form

| Field | Value |
|-------|-------|
| **Application name** | `Jose Madrid Salsa` |
| **Homepage URL** | `https://www.josemadrid.net` |
| **Application description** | *(optional)* `Sign in to Jose Madrid Salsa` |
| **Authorization callback URL** | `https://www.josemadrid.net/api/auth/callback/github` |

Click **"Register application"**.

### Step 3: Get Your Credentials

After registration you'll see your **Client ID** on the app page.

Click **"Generate a new client secret"** to create the secret. **Copy it immediately** -- GitHub will only show it once.

### Step 4: Add a Second Callback for Local Dev

Unfortunately, GitHub OAuth Apps only support **one** callback URL. To handle both production and local development, you have two options:

**Option A (Recommended):** Create a **second** OAuth App specifically for development:
- Same steps as above, but use `http://localhost:3000` as the Homepage URL
- Use `http://localhost:3000/api/auth/callback/github` as the callback URL
- Use these credentials in your `.env.local` only

**Option B:** Use a single app and change the callback URL when switching between local and production.

### Step 5: Set Environment Variables

Add to `.env.local` (for development):
```
GITHUB_CLIENT_ID="your-dev-client-id"
GITHUB_CLIENT_SECRET="your-dev-client-secret"
```

Add to Vercel (for production):
```bash
vercel env add GITHUB_CLIENT_ID production
vercel env add GITHUB_CLIENT_SECRET production
```

Or set them in the Vercel Dashboard:
https://vercel.com/jordan-langs-projects/josemadridsalsa/settings/environment-variables

---

## 3. Facebook OAuth

### Step 1: Go to Meta for Developers

Open: https://developers.facebook.com/apps/

Click **"Create App"**.

### Step 2: Select App Type

1. Select **"Consumer"** as the app type (or "None" if Consumer is not shown)
2. Click **Next**

### Step 3: Fill in App Details

| Field | Value |
|-------|-------|
| **App name** | `Jose Madrid Salsa` |
| **App contact email** | Your business email |

Click **"Create App"**.

### Step 4: Add Facebook Login Product

1. From your app dashboard, find **"Facebook Login"** in the product list
2. Click **"Set Up"**
3. Choose **"Web"**
4. Enter your site URL: `https://www.josemadrid.net`
5. Click **Save**, then skip through any remaining quick start steps

### Step 5: Configure OAuth Settings

1. In the left sidebar, go to **Facebook Login > Settings**
2. In **"Valid OAuth Redirect URIs"**, add both:
   ```
   https://www.josemadrid.net/api/auth/callback/facebook
   http://localhost:3000/api/auth/callback/facebook
   ```
3. Click **"Save Changes"**

### Step 6: Get Your Credentials

1. Go to **Settings > Basic** in the left sidebar
2. Your **App ID** = `FACEBOOK_CLIENT_ID`
3. Click **"Show"** next to App Secret, enter your password
4. Your **App Secret** = `FACEBOOK_CLIENT_SECRET`

### Step 7: Go Live (Required for Production)

By default, Facebook apps are in **Development Mode** and only work for app admins/testers.

To allow all users to sign in:

1. In the left sidebar at the top, find the **"App Mode"** toggle
2. Switch from **"Development"** to **"Live"**
3. Facebook will check that you have:
   - A Privacy Policy URL (set in **Settings > Basic**)
   - Valid app domains
   - At least one platform configured

Set your **Privacy Policy URL** in Settings > Basic:
```
https://www.josemadrid.net/privacy-policy
```

Set your **App Domains**:
```
www.josemadrid.net
localhost
```

### Step 8: Set Environment Variables

Add to `.env.local`:
```
FACEBOOK_CLIENT_ID="your-app-id"
FACEBOOK_CLIENT_SECRET="your-app-secret"
```

Add to Vercel:
```bash
vercel env add FACEBOOK_CLIENT_ID production
vercel env add FACEBOOK_CLIENT_SECRET production
```

### Important Notes

- Facebook requires HTTPS for production callback URLs
- The app must be in **Live** mode for non-admin users to sign in
- Facebook login provides email by default, which is what NextAuth needs to create/match users
- If users have their email set to private on Facebook, they may need to grant email permission manually

---

## 4. Apple Sign In

Apple Sign In is the most complex to set up. It requires an Apple Developer Account ($99/year).

### Prerequisites

- An **Apple Developer Account**: https://developer.apple.com/account/
- This costs $99/year and requires enrollment approval

### Step 1: Create an App ID

1. Go to: https://developer.apple.com/account/resources/identifiers/list
2. Click the **"+"** button
3. Select **"App IDs"**, click **Continue**
4. Select **"App"** as the type, click **Continue**
5. Fill in:
   | Field | Value |
   |-------|-------|
   | **Description** | `Jose Madrid Salsa` |
   | **Bundle ID** | `com.josemadridsalsa.web` (Explicit) |
6. Scroll down to **Capabilities**, check **"Sign In with Apple"**
7. Click **Continue**, then **Register**

### Step 2: Create a Services ID

This is what NextAuth uses as the `APPLE_CLIENT_ID`.

1. Go to: https://developer.apple.com/account/resources/identifiers/list/serviceId
2. Click the **"+"** button
3. Select **"Services IDs"**, click **Continue**
4. Fill in:
   | Field | Value |
   |-------|-------|
   | **Description** | `Jose Madrid Salsa Web Sign In` |
   | **Identifier** | `com.josemadridsalsa.web.signin` |
5. Click **Continue**, then **Register**
6. Click on the newly created Service ID
7. Check **"Sign In with Apple"**, then click **Configure**
8. In the configuration modal:
   | Field | Value |
   |-------|-------|
   | **Primary App ID** | Select `Jose Madrid Salsa` (the App ID from Step 1) |
   | **Domains** | `www.josemadrid.net` |
   | **Return URLs** | `https://www.josemadrid.net/api/auth/callback/apple` |
9. Click **Save**, then **Continue**, then **Save** again

Your `APPLE_CLIENT_ID` is the **Identifier** from this step: `com.josemadridsalsa.web.signin`

### Step 3: Create a Private Key

This is used to generate the `APPLE_CLIENT_SECRET`.

1. Go to: https://developer.apple.com/account/resources/authkeys/list
2. Click the **"+"** button
3. Enter a key name: `Jose Madrid Salsa Auth Key`
4. Check **"Sign In with Apple"**
5. Click **Configure** next to Sign In with Apple
6. Select your **Primary App ID** (`Jose Madrid Salsa`)
7. Click **Save**, then **Continue**, then **Register**
8. **Download the key file** (`.p8` file) -- you can only download it **once**
9. Note the **Key ID** shown on the page

### Step 4: Generate the Client Secret

Apple doesn't give you a static secret. Instead, you generate a **JWT** signed with your private key. NextAuth's Apple provider can handle this automatically if you provide the right values.

You need these values:

| Value | Where to Find It |
|-------|-----------------|
| **Team ID** | Top-right of https://developer.apple.com/account/ (10-character alphanumeric) |
| **Key ID** | From Step 3 (shown when you created the key) |
| **Private Key** | Contents of the `.p8` file from Step 3 |

The `APPLE_CLIENT_SECRET` for NextAuth is a JWT. You can generate it using this Node.js script:

```bash
# Save this as scripts/generate-apple-secret.js and run it
node scripts/generate-apple-secret.js
```

```javascript
// scripts/generate-apple-secret.js
const jwt = require('jsonwebtoken');
const fs = require('fs');

const privateKey = fs.readFileSync('./AuthKey_XXXXXXXXXX.p8', 'utf8'); // Your .p8 file
const teamId = 'YOUR_TEAM_ID';       // 10-char alphanumeric from Apple Developer account
const keyId = 'YOUR_KEY_ID';          // From the key you created
const clientId = 'com.josemadridsalsa.web.signin'; // Your Services ID

const token = jwt.sign({}, privateKey, {
  algorithm: 'ES256',
  expiresIn: '180d',  // Apple allows max 6 months
  audience: 'https://appleid.apple.com',
  issuer: teamId,
  subject: clientId,
  keyid: keyId,
});

console.log('APPLE_CLIENT_SECRET:');
console.log(token);
console.log('\nThis secret expires in 180 days. Set a reminder to regenerate it.');
```

**Note:** You'll need `jsonwebtoken` installed: `npm install jsonwebtoken` (as a dev dependency is fine).

**Important:** The Apple client secret expires (max 6 months). You'll need to regenerate it before expiration. Set a calendar reminder.

### Step 5: Set Environment Variables

Add to `.env.local`:
```
APPLE_CLIENT_ID="com.josemadridsalsa.web.signin"
APPLE_CLIENT_SECRET="eyJhbGciOiJFUzI1NiIs..."  # The JWT you generated
```

Add to Vercel:
```bash
vercel env add APPLE_CLIENT_ID production
vercel env add APPLE_CLIENT_SECRET production
```

### Important Notes

- Apple Sign In only sends the user's **name on the first sign-in**. If you miss it, you won't get it again unless the user revokes your app and re-authorizes
- Apple lets users **hide their email** behind a relay address (e.g., `abc123@privaterelay.appleid.com`). Your app should handle this gracefully -- the relay forwards emails to the user's real address
- The client secret JWT expires every 6 months max. Regenerate it before it expires
- Apple requires HTTPS -- it will not work on `http://localhost`. For local testing, use a tool like `ngrok` or skip Apple testing locally

---

## 5. Adding Variables to Vercel

After creating all OAuth apps, add every variable to Vercel for production:

### Via CLI

```bash
# GitHub
vercel env add GITHUB_CLIENT_ID production
vercel env add GITHUB_CLIENT_SECRET production

# Facebook
vercel env add FACEBOOK_CLIENT_ID production
vercel env add FACEBOOK_CLIENT_SECRET production

# Apple
vercel env add APPLE_CLIENT_ID production
vercel env add APPLE_CLIENT_SECRET production
```

### Via Dashboard

1. Go to: https://vercel.com/jordan-langs-projects/josemadridsalsa/settings/environment-variables
2. Add each key-value pair for the **Production** environment
3. Optionally add for **Preview** and **Development** environments too

After adding, **redeploy** for changes to take effect:
```bash
vercel --prod
```

---

## 6. Testing Checklist

After setting up each provider, test the full flow:

- [ ] **Google**: Click "Continue with Google" on `/auth/signin` -- should redirect, sign in, and return
- [ ] **GitHub**: Click "Continue with GitHub" -- should redirect to GitHub authorize page
- [ ] **Facebook**: Click "Continue with Facebook" -- should redirect to Facebook login dialog
- [ ] **Apple**: Click "Continue with Apple" -- should redirect to Apple ID sign-in page
- [ ] **New user creation**: Sign in with a new OAuth account and verify a user record is created in the database with role `CUSTOMER`
- [ ] **Returning user**: Sign in again with the same OAuth account and verify it finds the existing user (matched by email)
- [ ] **Session data**: After signing in, verify the navigation shows the user's name and email
- [ ] **Sign out**: Click sign out and verify the session is cleared

### Local Testing Tips

- **Google & GitHub**: Work fine on `http://localhost:3000`
- **Facebook**: Works on localhost if you added `http://localhost:3000/api/auth/callback/facebook` to your redirect URIs
- **Apple**: Requires HTTPS. Use `ngrok http 3000` to get an HTTPS URL for local testing, and temporarily add that URL to your Apple Service ID's return URLs

---

## 7. Troubleshooting

### "OAuthCallback" error after redirect
- Double-check your callback URL matches exactly: `https://www.josemadrid.net/api/auth/callback/{provider}`
- Ensure Client ID and Client Secret are correct and not swapped

### Facebook login only works for admins
- Your Facebook app is still in Development mode. Switch to Live mode (Section 3, Step 7)

### Apple sign-in returns an error
- Your client secret JWT may be expired. Regenerate it
- Verify the Services ID identifier matches your `APPLE_CLIENT_ID`
- Make sure the return URL in Apple's configuration matches your callback URL exactly

### User signed in but has no name
- Apple only sends the name on **first** authorization. If you missed it, the user needs to go to Settings > Apple ID > Sign-In & Security > "Sign In with Apple" on their Apple device, remove your app, and re-authorize
- GitHub users may not have a public name set on their profile

### Provider button does nothing / page reloads
- The environment variables for that provider may be missing. Check your `.env.local` or Vercel env
- Check the server logs for NextAuth errors: look for `[NextAuth Error]` in the console
