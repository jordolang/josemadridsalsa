import { db } from "@/lib/db";
import { randomBytes, createHmac } from "crypto";

export function generateFundraiserApiKey(): { raw: string; hash: string } {
  const raw = `jms_live_${randomBytes(32).toString("hex")}`;
  const hash = hashApiKey(raw);
  return { raw, hash };
}

function hashApiKey(raw: string): string {
  return createHmac("sha256", process.env.FUNDRAISER_API_SECRET!)
    .update(raw)
    .digest("hex");
}

export async function verifyFundraiserApiKey(rawKey: string) {
  if (!rawKey.startsWith("jms_live_") || rawKey.length < 73) return null;
  const hash = hashApiKey(rawKey);
  const team = await db.fundraiserTeam.findFirst({
    where: { apiKeyHash: hash, status: "ACTIVE" },
    select: {
      id: true, name: true, slug: true, school: true,
      teamColor: true, teamColorDark: true, goalAmount: true, salesCount: true,
    },
  });
  return team ?? null;
}

export async function rotateFundraiserApiKey(teamId: string) {
  const { raw, hash } = generateFundraiserApiKey();
  await db.fundraiserTeam.update({
    where: { id: teamId },
    data: { apiKeyHash: hash, apiKeyRotatedAt: new Date() },
  });
  return raw;
}
