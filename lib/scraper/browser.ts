import { chromium, type Browser } from 'playwright'

const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN

export async function connectBrowser(): Promise<Browser> {
  if (BROWSERLESS_TOKEN) {
    const wsEndpoint = `wss://production-sfo.browserless.io/chromium?token=${BROWSERLESS_TOKEN}`
    return chromium.connectOverCDP(wsEndpoint)
  }

  return chromium.launch({ headless: true })
}

export async function createPage(browser: Browser) {
  const contexts = browser.contexts()
  if (contexts.length > 0) {
    const pages = contexts[0].pages()
    if (pages.length > 0) return pages[0]
    return contexts[0].newPage()
  }
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  return context.newPage()
}
