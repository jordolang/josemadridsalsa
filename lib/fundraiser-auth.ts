import { randomBytes, createHmac } from "crypto";

/**
 * Fundraiser Battle Arena API key utilities.
 *
 * NOTE: FundraiserTeam model is not yet in the Prisma schema.
 * These functions are stubs until the DB migration is run.
 */

export function generateFundraiserApiKey(): { raw: string; hash: string } {
  const raw = `jms_live_${randomBytes(32).toString("hex")}`;
  const hash = hashApiKey(raw);
  return { raw, hash };
}

function hashApiKey(raw: string): string {
  return createHmac("sha256", process.env.FUNDRAISER_API_SECRET ?? "placeholder")
    .update(raw)
    .digest("hex");
}

/**
 * Stub: always returns null until FundraiserTeam model exists in schema.
 */
export async function verifyFundraiserApiKey(_rawKey: string) {
  return null;
}

/**
 * Stub: always throws until FundraiserTeam model exists in schema.
 */
export async function rotateFundraiserApiKey(_teamId: string): Promise<string> {
  throw new Error("FundraiserTeam model not yet available in schema");
}
