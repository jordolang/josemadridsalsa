import { Award } from "lucide-react";

// Confirmed by the owner (2026-10-12). Do not add an award, year, or outlet
// that is not on this list; PRODUCT.md forbids inventing them.
export const AWARDS = [
  {
    title: "Best Green Salsa in the US",
    detail:
      "Spanish Verde also took Best Tomatillo Salsa at the National Salsa Shoot Out, Fort Worth, Texas, 2004.",
  },
  {
    title: "Honored in two countries",
    detail: "Raspberry Mild earned national awards in the United States and Canada.",
  },
  {
    title: "National recognition",
    detail:
      "For our fruit salsa line, and as a top gourmet salsa fundraiser in the United States.",
  },
] as const;

export function AwardsStrip() {
  return (
    <section aria-labelledby="awards-heading" className="border-y border-border bg-muted/40 py-10 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2
          id="awards-heading"
          className="mb-6 text-center text-xs font-semibold uppercase tracking-widest text-salsa-600"
        >
          Recognized nationally
        </h2>
        <ul className="grid gap-6 sm:grid-cols-3 sm:gap-8">
          {AWARDS.map((award) => (
            <li key={award.title} className="flex gap-3">
              <Award aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-salsa-600" />
              <div>
                <p className="font-serif text-lg font-bold leading-snug text-foreground">{award.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{award.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
