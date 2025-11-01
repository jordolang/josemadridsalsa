"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AccountBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const label = seg[0]?.toUpperCase() + seg.slice(1);
    return { href, label };
  });

  return (
    <nav className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-2">
        <li>
          <Link href="/" className="hover:underline">Home</Link>
        </li>
        {crumbs.map((c, idx) => (
          <li key={c.href} className="flex items-center gap-2">
            <span>/</span>
            {idx === crumbs.length - 1 ? (
              <span className="text-foreground">{c.label}</span>
            ) : (
              <Link href={c.href} className="hover:underline">{c.label}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
