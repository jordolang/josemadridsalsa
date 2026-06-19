import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-stone-50 to-red-50/30 dark:from-stone-950 dark:to-red-950/20 px-6">
      <div className="text-center">
        <p className="text-8xl mb-4">🌶️</p>
        <h1
          className="text-4xl font-bold text-stone-900 dark:text-white mb-3"
          style={{ fontFamily: 'var(--font-volkhov), Volkhov, Georgia, serif' }}
        >
          Page Not Found
        </h1>
        <p className="text-stone-600 dark:text-stone-400 mb-8 max-w-md">
          This page doesn&apos;t exist. Maybe you were looking for one of our documentation sections?
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/docs"
            className="inline-flex items-center px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-red-600 to-red-500 rounded-lg hover:from-red-700 hover:to-red-600 transition-all shadow-md"
          >
            Browse Docs
          </Link>
          <Link
            href="/"
            className="inline-flex items-center px-5 py-2.5 text-sm font-semibold text-stone-700 dark:text-stone-200 bg-white dark:bg-stone-800 rounded-lg border border-stone-200 dark:border-stone-700 hover:border-red-300 transition-all"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
