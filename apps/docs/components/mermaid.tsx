'use client';

import { useEffect, useId, useState } from 'react';
import { useTheme } from 'next-themes';

interface MermaidProps {
  chart: string;
}

// Mermaid renders SVG from trusted MDX source files (not user input).
// `securityLevel: 'strict'` tells Mermaid to sanitize the input diagram text.
export function Mermaid({ chart }: MermaidProps) {
  const id = useId();
  const [svg, setSvg] = useState<string>('');
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const mermaid = (await import('mermaid')).default;

      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        fontFamily: 'inherit',
        theme: resolvedTheme === 'dark' ? 'dark' : 'default',
      });

      try {
        const renderId = `mermaid-${id.replace(/:/g, '')}`;
        const { svg: rendered } = await mermaid.render(renderId, chart);
        if (!cancelled) setSvg(rendered);
      } catch (error: unknown) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : 'Failed to render diagram';
          setSvg(
            `<pre class="text-sm text-fd-muted-foreground">${escapeHtml(message)}</pre>`,
          );
        }
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [chart, id, resolvedTheme]);

  return (
    <div
      className="my-6 flex justify-center overflow-x-auto rounded-lg border border-fd-border bg-fd-card p-4"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
