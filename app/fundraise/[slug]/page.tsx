import { notFound } from "next/navigation";
import { prisma as db } from "@/lib/prisma";
import BattleArena from "@/components/fundraiser/BattleArena";
import type { Metadata } from "next";

interface Props { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const team = await db.fundraiserTeam.findUnique({ where: { slug: params.slug } });
  if (!team) return { title: "Fundraiser Not Found" };
  return {
    title: `${team.name} — JMS Fundraiser Battle`,
    description: `Support ${team.name} from ${team.school} in the Jose Madrid Salsa Fundraiser Battle Arena!`,
    openGraph: {
      title: `${team.name} is battling in the JMS Fundraiser Arena!`,
      description: `Every sale powers their warrior. Share to activate a 15-minute shield!`,
      url: `https://josemadrid.net/fundraise/${params.slug}`,
    },
  };
}

export default async function FundraiserProfilePage({ params }: Props) {
  const team = await db.fundraiserTeam.findUnique({
    where: { slug: params.slug, status: "ACTIVE" },
    include: { characters: true },
  });
  if (!team) notFound();

  const opponents = await db.fundraiserTeam.findMany({
    where: { status: "ACTIVE", id: { not: team.id }, activePeriod: { equals: team.activePeriod } },
    include: { characters: true },
    orderBy: { salesCount: "desc" },
    take: 8,
  });

  const mapTeam = (t: typeof team) => ({
    id: t.id, name: t.name, school: t.school,
    color: t.teamColor, dark: t.teamColorDark,
    goal: t.goalAmount,
    roster: t.characters.map(c => ({
      id: c.id, name: c.characterName, cls: c.characterClass,
      gender: c.gender as "m"|"f", skin: c.skinColor, hair: c.hairColor,
      quips: Array.isArray(c.quips) ? c.quips as string[] : JSON.parse(c.quips as string),
    })),
  });

  const shieldRecord = await db.fundraiserShield.findFirst({
    where: { teamId: team.id, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: "desc" },
  });

  return (
    <main className="min-h-screen bg-black flex flex-col items-center py-8 px-4">
      <section className="w-full max-w-2xl mb-6 text-center">
        <h1 className="text-3xl font-bold" style={{ color: team.teamColor, fontFamily:"'Courier New',monospace", letterSpacing:4 }}>
          {team.name.toUpperCase()}
        </h1>
        <p className="text-sm mt-1" style={{ color:"#8A6030", fontFamily:"'Courier New',monospace", letterSpacing:2 }}>
          {team.school} — FUNDRAISER {team.activePeriod}
        </p>
        <div className="flex justify-center gap-6 mt-4 text-sm" style={{ fontFamily:"'Courier New',monospace" }}>
          <div style={{color:"#F5C842"}}><span style={{color:"#6B4A18"}}>SALES: </span>{team.salesCount}</div>
          <div style={{color:"#F5C842"}}><span style={{color:"#6B4A18"}}>GOAL: </span>${team.goalAmount.toLocaleString()}</div>
          <div style={{color:"#F5C842"}}><span style={{color:"#6B4A18"}}>RAISED: </span>${(team.salesCount * team.pricePerUnit).toLocaleString()}</div>
        </div>
      </section>
      <section className="w-full max-w-2xl">
        <BattleArena
          myTeam={mapTeam(team)}
          opponents={opponents.map(mapTeam)}
          shareUrl={`https://josemadrid.net/fundraise/${params.slug}`}
          shieldExpiresAt={shieldRecord?.expiresAt?.toISOString() ?? null}
        />
      </section>
      <section className="w-full max-w-2xl mt-8 text-center">
        <a href={`/shop?ref=${team.slug}&team=${team.id}`}
          className="inline-block px-8 py-3 text-sm font-bold tracking-widest uppercase"
          style={{ background:"#C8860A", color:"#0a0603", fontFamily:"'Courier New',monospace" }}>
          BUY SALSA — POWER THIS TEAM
        </a>
        <p className="text-xs mt-3" style={{ color:"#6B4A18", fontFamily:"'Courier New',monospace" }}>
          Every purchase triggers an attack in the Battle Arena
        </p>
      </section>
    </main>
  );
}
