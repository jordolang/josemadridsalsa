'use client'

import Script from 'next/script'

type GoogleAnalyticsProps = {
  measurementId?: string | null
}

export function GoogleAnalytics({ measurementId }: GoogleAnalyticsProps) {
  const resolvedId =
    measurementId || process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID || 'G-HG4QV5GFKH'

  if (!resolvedId) {
    return null
  }

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${resolvedId}`}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${resolvedId}');
          `,
        }}
      />
    </>
  )
}
