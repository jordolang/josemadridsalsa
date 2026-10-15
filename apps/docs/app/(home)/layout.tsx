import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Jose Madrid Salsa Help Center & Docs',
  description:
    'Customer help for ordering, shipping, fundraisers, and accounts, plus developer documentation for the Jose Madrid Salsa platform.',
};

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
