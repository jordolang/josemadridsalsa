import type { Metadata } from 'next'
import './desktop.css'

/**
 * The desktop admin shell.
 *
 * This route sits outside `/admin` on purpose: the web panel's layout supplies
 * a sidebar and top bar that the desktop window draws itself, and a nested
 * layout cannot opt out of its parent. Everything below is the same data behind
 * the same session — only the frame is different.
 *
 * It is reachable in a browser, but it is a staff tool, not a page: it is kept
 * out of the sitemap and disallowed in `app/robots.ts`, and carries `noindex`
 * here so a crawler that reaches it anyway does not list it.
 */

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export const metadata: Metadata = {
  title: 'Jose Madrid Salsa Admin',
  robots: { index: false, follow: false },
}

export default function DesktopAdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="jmsd-root">{children}</div>
}
