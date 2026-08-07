import { NextRequest, NextResponse } from "next/server";
import { prisma as db } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin-auth";
import { rotateFundraiserApiKey } from "@/lib/fundraiser-auth";
import { logAuditWithRequest } from "@/lib/audit";
import { z } from "zod";

export async function POST(req: NextRequest) {
  const admin = await requireAdminSession();
  const parsed = z.object({ teamId: z.string() }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 422 });

  const team = await db.fundraiserTeam.findUnique({
    where: { id: parsed.data.teamId },
    select: { id: true, name: true, status: true },
  });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
  if (team.status !== "ACTIVE") return NextResponse.json({ error: "Team is not active" }, { status: 400 });

  const newRawKey = await rotateFundraiserApiKey(team.id);

  // Credential rotation invalidates the team's existing key, so who did it and when has to
  // be recoverable. The key itself is never logged.
  await logAuditWithRequest(
    {
      userId: admin.id,
      action: "rotate_api_key",
      entityType: "fundraiser_team",
      entityId: team.id,
      changes: { teamName: team.name },
    },
    req
  );

  return NextResponse.json({ success: true, teamId: team.id, teamName: team.name, apiKey: newRawKey });
}
