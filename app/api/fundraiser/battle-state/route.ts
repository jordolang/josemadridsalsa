import { NextRequest, NextResponse } from "next/server";
import { prisma as db } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";

const CUID_RE = /^[a-z0-9]{20,30}$/;

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = rateLimit(`battle-state:${ip}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
  }

  const myTeamId  = req.nextUrl.searchParams.get("myTeam");
  const oppTeamId = req.nextUrl.searchParams.get("oppTeam");
  if (!myTeamId) {
    return NextResponse.json({ error: "myTeam required" }, { status: 400 });
  }
  if (!CUID_RE.test(myTeamId)) {
    return NextResponse.json({ error: "Invalid myTeam" }, { status: 400 });
  }
  if (oppTeamId && !CUID_RE.test(oppTeamId)) {
    return NextResponse.json({ error: "Invalid oppTeam" }, { status: 400 });
  }

  const thirtySecondsAgo = new Date(Date.now() - 30_000);

  const [mySale, oppSale, shield] = await Promise.all([
    db.fundraiserSaleEvent.findFirst({
      where: { teamId: myTeamId, createdAt: { gt: thirtySecondsAgo } },
      orderBy: { createdAt: "desc" },
    }),
    oppTeamId
      ? db.fundraiserSaleEvent.findFirst({
          where: { teamId: oppTeamId, createdAt: { gt: thirtySecondsAgo } },
          orderBy: { createdAt: "desc" },
        })
      : null,
    db.fundraiserShield.findFirst({
      where: { teamId: myTeamId, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    latestMySaleDollars:  mySale?.amount  ?? 0,
    latestOppSaleDollars: oppSale?.amount ?? 0,
    shieldExpiresAt:      shield?.expiresAt?.toISOString() ?? null,
    shieldHPRemaining:    shield?.remainingHP ?? 0,
  });
}
