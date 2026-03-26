import { NextRequest, NextResponse } from "next/server";
import { prisma as db } from "@/lib/prisma";
import { verifyFundraiserApiKey } from "@/lib/fundraiser-auth";
import { z } from "zod";

const SaleSchema = z.object({
  apiKey:  z.string().min(32),
  amount:  z.number().positive().optional(),
  orderId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = SaleSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 422 });

  const { apiKey, amount, orderId } = parsed.data;
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

  return NextResponse.json({
    success: true, teamId: team.id, teamName: team.name,
    salesCount: updatedTeam.salesCount, saleEventId: saleEvent.id, triggerAttack: true,
  });
}
