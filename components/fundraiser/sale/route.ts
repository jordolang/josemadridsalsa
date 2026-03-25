import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/fundraiser/sale
 *
 * Battle Arena sale webhook.
 *
 * NOTE: FundraiserTeam and FundraiserSaleEvent models are not yet in the
 * Prisma schema. This endpoint returns 503 until the DB migration is run.
 */
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: "Battle Arena feature not yet available" },
    { status: 503 }
  );
}
