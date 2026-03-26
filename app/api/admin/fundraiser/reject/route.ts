import { NextRequest, NextResponse } from "next/server";
import { prisma as db } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin-auth";
import { z } from "zod";

export async function POST(req: NextRequest) {
  const admin = await requireAdminSession();
  const parsed = z.object({ signupId: z.string(), reviewNotes: z.string().optional() })
    .safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 422 });

  const { signupId, reviewNotes } = parsed.data;
  const signup = await db.fundraiserSignupRequest.findUnique({ where: { id: signupId } });
  if (!signup) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (signup.status !== "PENDING") return NextResponse.json({ error: "Already reviewed" }, { status: 409 });

  await db.fundraiserSignupRequest.update({
    where: { id: signupId },
    data: { status: "REJECTED", reviewedBy: admin.id, reviewedAt: new Date(), reviewNotes: reviewNotes ?? null },
  });

  return NextResponse.json({ success: true });
}
