import { source } from '@/lib/source';
import { notFound } from 'next/navigation';

export const revalidate = false;

interface RouteContext {
  params: Promise<{ slug?: string[] }>;
}

export async function GET(_req: Request, ctx: RouteContext) {
  const { slug } = await ctx.params;
  const page = source.getPage(slug);
  if (!page) notFound();

  const raw = await page.data.getText('raw');

  return new Response(raw, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}

export function generateStaticParams() {
  return source.generateParams();
}
