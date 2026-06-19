import { source } from '@/lib/source';
import type { Graph } from '../components/graph-view';

interface ExtractedReference {
  href: string;
}

export function buildGraph(): Graph {
  const pages = source.getPages();
  const graph: Graph = { links: [], nodes: [] };

  for (const page of pages) {
    graph.nodes.push({
      id: page.url,
      url: page.url,
      text: page.data.title,
      description: page.data.description,
    });

    const data = page.data as typeof page.data & {
      extractedReferences?: ExtractedReference[];
    };
    const refs = data.extractedReferences ?? [];
    for (const ref of refs) {
      const refPage = source.getPageByHref(ref.href);
      if (!refPage) continue;

      graph.links.push({
        source: page.url,
        target: refPage.page.url,
      });
    }
  }

  return graph;
}
