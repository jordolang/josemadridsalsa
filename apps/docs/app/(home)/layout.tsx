import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Jose Madrid Salsa Documentation',
  description:
    'Technical documentation for Jose Madrid Salsa — features, API reference, deployment guides, and developer resources.',
};

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
