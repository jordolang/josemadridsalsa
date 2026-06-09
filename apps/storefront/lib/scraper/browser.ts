import { chromium, type Browser } from 'playwright'

const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN

const LAUNCH_ARGS = JSON.stringify({
  args: [
    '--disable-blink-features=AutomationControlled',
    '--no-sandbox',
  ],
  headless: 'new',
})

export async function connectBrowser(): Promise<Browser> {
  if (BROWSERLESS_TOKEN) {
    const wsEndpoint = `wss://production-sfo.browserless.io/chromium?token=${BROWSERLESS_TOKEN}&launch=${encodeURIComponent(LAUNCH_ARGS)}&blockAds=true`
    return chromium.connectOverCDP(wsEndpoint)
  }

  return chromium.launch({ headless: true })
}

export async function createPage(browser: Browser) {
  const contexts = browser.contexts()
  if (contexts.length > 0) {
    const existing = contexts[0]
    const pages = existing.pages()
    if (pages.length > 0) return pages[0]
    return existing.newPage()
  }
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
    viewport: { width: 1920, height: 1080 },
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  return context.newPage()
}
