import type { Metadata } from 'next';
import { Montserrat, Volkhov, Roboto_Mono } from 'next/font/google';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
});

const volkhov = Volkhov({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-volkhov',
  display: 'swap',
});

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  variable: '--font-roboto-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    template: '%s | Jose Madrid Salsa Docs',
    default: 'Jose Madrid Salsa Documentation',
  },
  description:
    'Technical documentation for Jose Madrid Salsa — features, API reference, deployment guides, and developer resources.',
  openGraph: {
    title: 'Jose Madrid Salsa Documentation',
    description: 'Technical documentation, API reference, and developer guides.',
    type: 'website',
    siteName: 'Jose Madrid Salsa Docs',
    images: [
      {
        url: 'https://www.josemadrid.net/images/Opengraph/josemadrid-hero.png',
        width: 1200,
        height: 630,
        alt: 'Jose Madrid Salsa',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${volkhov.variable} ${robotoMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-screen"
        style={{ fontFamily: 'var(--font-montserrat), Montserrat, system-ui, sans-serif' }}
      >
        {children}
      </body>
    </html>
  );
}
