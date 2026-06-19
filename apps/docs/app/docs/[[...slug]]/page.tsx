import { source } from '@/lib/source';
import {
  DocsPage,
  DocsBody,
  DocsTitle,
  DocsDescription,
} from 'fumadocs-ui/page';
import {
  MarkdownCopyButton,
  ViewOptionsPopover,
} from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';
import { getMdxComponents } from '@/lib/mdx-components';
import { getLastModified } from '@/lib/last-modified';
import { Rate } from '@/components/rate';
import { TocProvider } from '@/components/toc-context';

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

export default async function Page(props: PageProps) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;

  const slugPath = (params.slug ?? []).join('/');
  const githubPath = `content/docs/${slugPath}.mdx`;
  const githubUrl = `https://github.com/jordolang/salsadocs/blob/main/${githubPath}`;
  const markdownUrl = `/llms.mdx/${slugPath}`;

  const lastModified = getLastModified(page.data.info.fullPath);

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
      lastUpdate={lastModified ?? undefined}
      tableOfContent={{
        style: 'clerk',
      }}
      tableOfContentPopover={{
        style: 'clerk',
      }}
      editOnGithub={{
        repo: 'salsadocs',
        owner: 'jordolang',
        sha: 'main',
        path: githubPath,
      }}
      footer={{
        enabled: true,
      }}
      breadcrumb={{
        enabled: true,
        includeSeparator: true,
      }}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <div className="flex flex-row items-center gap-2 border-b border-fd-border pb-4">
        <MarkdownCopyButton markdownUrl={markdownUrl} />
        <ViewOptionsPopover markdownUrl={markdownUrl} githubUrl={githubUrl} />
      </div>
      <DocsBody>
        <TocProvider items={page.data.toc}>
          <MDX components={getMdxComponents()} />
        </TocProvider>
        <Rate />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
