import { NextRequest, NextResponse } from "next/server";
import { prisma as db } from "@/lib/prisma";
import { generateFundraiserApiKey } from "@/lib/fundraiser-auth";
import { requireAdminSession } from "@/lib/admin-auth";
import { z } from "zod";

const DEFAULT_CHARACTERS = [
  { characterName:"Warrior",   characterClass:"warrior",   gender:"m", skinColor:"#8B5E3C", hairColor:"#1A0A00", position:0, quips:JSON.stringify(["HOLD THE LINE!","My shield has more dents than your dignity.","Bleed slower, I'm busy.","I've fought mountains scarier than you."]) },
  { characterName:"Mage",      characterClass:"mage",      gender:"f", skinColor:"#C4906A", hairColor:"#2A0A3A", position:1, quips:JSON.stringify(["Pathetic spellwork.","Did you feel that? Exactly.","I've turned smarter things into frogs.","My familiar hits harder."]) },
  { characterName:"Rogue",     characterClass:"rogue",     gender:"f", skinColor:"#B07850", hairColor:"#0A0A0A", position:2, quips:JSON.stringify(["You didn't even see me.","Left, right, gone.","Locks? Cute.","I steal hearts AND HP."]) },
];

const Schema = z.object({
  signupId:      z.string(),
  teamColor:     z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#9B7FFF"),
  teamColorDark: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  activePeriod:  z.string().regex(/^\d{4}-\d{2}$/),
  reviewNotes:   z.string().optional(),
});

function darken(hex: string): string {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  const d = (v: number) => Math.max(0, Math.round(v*0.45)).toString(16).padStart(2,"0");
  return `#${d(r)}${d(g)}${d(b)}`;
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminSession();
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 422 });

  const { signupId, teamColor, teamColorDark, activePeriod, reviewNotes } = parsed.data;
  const signup = await db.fundraiserSignupRequest.findUnique({ where: { id: signupId } });
  if (!signup) return NextResponse.json({ error: "Signup not found" }, { status: 404 });
  if (signup.status !== "PENDING") return NextResponse.json({ error: "Already reviewed" }, { status: 409 });

  const slug = `${signup.schoolName}-${signup.teamName}-${activePeriod}`
    .toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");

  const { raw: apiKey, hash: apiKeyHash } = generateFundraiserApiKey();
  const dark = teamColorDark ?? darken(teamColor);

  const now = new Date();
  const [team] = await db.$transaction([
    db.fundraiserTeam.create({
      data: {
        slug, name: signup.teamName, school: signup.schoolName,
        activePeriod, status: "ACTIVE",
        teamColor, teamColorDark: dark, goalAmount: signup.goalAmount,
        // Seed HP to goal so the team starts at full health. Without this
        // the default `hpCurrent=0` means opponents can never take damage
        // (applyDamage floors at zero), so the arena is effectively dead.
        hpCurrent: signup.goalAmount,
        hpResetAt: now,
        contactName: signup.contactName, contactEmail: signup.contactEmail,
        contactPhone: signup.contactPhone ?? null,
        apiKeyHash, apiKeyIssuedAt: now,
        approvedBy: admin.id, approvedAt: now,
        characters: { create: DEFAULT_CHARACTERS },
      },
    }),
    db.fundraiserSignupRequest.update({
      where: { id: signupId },
      data: { status: "APPROVED", reviewedBy: admin.id, reviewedAt: now, reviewNotes: reviewNotes ?? null, apiKeyShownAt: now },
    }),
  ]);

  const origin =
    process.env.APP_URL ??
    req.headers.get("origin") ??
    new URL(req.url).origin;

  return NextResponse.json({
    success: true, teamId: team.id, slug: team.slug,
    profileUrl: `${origin}/fundraise/${team.slug}`,
    apiKey,
  });
}
