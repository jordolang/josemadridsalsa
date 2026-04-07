import { NextRequest, NextResponse } from "next/server";
import { prisma as db } from "@/lib/prisma";
import { verifyFundraiserApiKey } from "@/lib/fundraiser-auth";
import { rateLimit } from "@/lib/rateLimit";
import { z } from "zod";

const SaleSchema = z.object({
  apiKey:  z.string().min(32),
  amount:  z.number().positive().optional(),
  orderId: z.string().optional(),
  opponentTeamId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = rateLimit(`sale-post:${ip}`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
  }

  const parsed = SaleSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 422 });

  const { apiKey, amount, orderId, opponentTeamId } = parsed.data;
  const team = await verifyFundraiserApiKey(apiKey);
  if (!team) return NextResponse.json({ error: "Invalid or inactive API key" }, { status: 401 });

  if (orderId) {
    const existing = await db.fundraiserSaleEvent.findUnique({ where: { orderId } });
    if (existing) return NextResponse.json({ error: "Order already processed" }, { status: 409 });
  }

  const [saleEvent, updatedTeam] = await db.$transaction([
    db.fundraiserSaleEvent.create({
      data: { teamId: team.id, orderId: orderId ?? null, amount: amount ?? 0 },
    }),
    db.fundraiserTeam.update({
      where: { id: team.id },
      data: { salesCount: { increment: 1 } },
      select: { id: true, name: true, salesCount: true, goalAmount: true, slug: true },
    }),
  ]);

  // Decrement opponent's active shield HP when this team makes a sale
  const saleDollars = amount ?? 0;
  let shieldAbsorbed = 0;
  if (opponentTeamId && saleDollars > 0) {
    const activeShield = await db.fundraiserShield.findFirst({
      where: { teamId: opponentTeamId, expiresAt: { gt: new Date() }, remainingHP: { gt: 0 } },
    });
    if (activeShield) {
      shieldAbsorbed = Math.min(activeShield.remainingHP, saleDollars);
      await db.fundraiserShield.update({
        where: { id: activeShield.id },
        data: { remainingHP: { decrement: shieldAbsorbed } },
      });
    }
  }

  return NextResponse.json({
    success: true, teamId: team.id, teamName: team.name,
    salesCount: updatedTeam.salesCount, saleEventId: saleEvent.id, triggerAttack: true,
    shieldAbsorbed,
  });
}
