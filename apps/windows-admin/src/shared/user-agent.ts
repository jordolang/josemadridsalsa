/**
 * Remove the tokens that mark a user agent as an Electron app.
 *
 * Google and GitHub refuse to serve their sign-in pages to anything they detect
 * as an embedded webview, and Electron's default string announces both its own
 * version and the product name. Stripping them leaves the Chrome build
 * underneath, which is what those pages are checking for.
 *
 * The product token appears with or without its spaces depending on how the app
 * was packaged, so both forms are removed.
 */
export function stripAppTokens(userAgent: string, appName: string): string {
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const names = new Set([appName, appName.replace(/\s+/g, '')].filter(Boolean))

  let result = userAgent.replace(/\s?Electron\/[\d.]+/, '')
  for (const name of names) {
    result = result.replace(new RegExp(`\\s?${escape(name)}\\/[\\d.]+`), '')
  }

  return result.replace(/\s{2,}/g, ' ').trim()
}
