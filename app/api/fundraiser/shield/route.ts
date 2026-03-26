import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyFundraiserApiKey } from "@/lib/fundraiser-auth";
import { z } from "zod";

const SHIELD_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const parsed = z.object({ apiKey: z.string().min(32) }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 422 });

  const team = await verifyFundraiserApiKey(parsed.data.apiKey);
  if (!team) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });

  const active = await db.fundraiserShield.findFirst({
    where: { teamId: team.id, expiresAt: { gt: new Date() } },
  });
  if (active) {
    return NextResponse.json({ alreadyActive: true, expiresAt: active.expiresAt.toISOString() });
  }

  const expiresAt = new Date(Date.now() + SHIELD_MS);
  const shield = await db.fundraiserShield.create({
    data: { teamId: team.id, expiresAt, activatedAt: new Date() },
  });

  return NextResponse.json({ activated: true, expiresAt: shield.expiresAt.toISOString(), durationMinutes: 15 });
}

export async function GET(req: NextRequest) {
  const teamId = req.nextUrl.searchParams.get("teamId");
  if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 });

  const shield = await db.fundraiserShield.findFirst({
    where: { teamId, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: "desc" },
  });

  return NextResponse.json({ active: !!shield, expiresAt: shield?.expiresAt?.toISOString() ?? null });
}
