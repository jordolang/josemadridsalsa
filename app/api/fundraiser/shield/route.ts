import { NextRequest, NextResponse } from "next/server";
import { prisma as db } from "@/lib/prisma";
import { verifyFundraiserApiKey } from "@/lib/fundraiser-auth";
import { rateLimit } from "@/lib/rateLimit";
import { z } from "zod";

const SHIELD_MS = 30 * 60 * 1000;

const CUID_RE = /^[a-z0-9]{20,30}$/;

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

  return NextResponse.json({ activated: true, expiresAt: shield.expiresAt.toISOString(), durationMinutes: 30 });
}

export async function GET(req: NextRequest) {
  const teamId = req.nextUrl.searchParams.get("teamId");
  if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 });
  if (!CUID_RE.test(teamId)) return NextResponse.json({ error: "Invalid teamId" }, { status: 400 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = rateLimit(`shield-get:${ip}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
  }

  const shield = await db.fundraiserShield.findFirst({
    where: { teamId, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: "desc" },
  });

  return NextResponse.json({ active: !!shield, expiresAt: shield?.expiresAt?.toISOString() ?? null });
}
