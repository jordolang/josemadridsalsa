import { helpSource } from '@/lib/source';
import { DocsPage, DocsBody, DocsTitle, DocsDescription } from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';
import { getMdxComponents } from '@/lib/mdx-components';
import { Rate } from '@/components/rate';

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

export default async function Page(props: PageProps) {
  const params = await props.params;
  const page = helpSource.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
      tableOfContent={{ style: 'clerk' }}
      tableOfContentPopover={{ style: 'clerk' }}
      footer={{ enabled: true }}
      breadcrumb={{ enabled: true, includeSeparator: true }}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={getMdxComponents()} />
        <Rate />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return helpSource.generateParams();
}

export async function generateMetadata(props: PageProps) {
  const params = await props.params;
  const page = helpSource.getPage(params.slug);
  if (!page) notFound();

  return {
    title: `${page.data.title} | Jose Madrid Salsa Help`,
    description: page.data.description,
  };
}
