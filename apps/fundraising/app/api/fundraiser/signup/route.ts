import { NextRequest, NextResponse } from "next/server";
import { prisma as db } from "@/lib/prisma";
import { z } from "zod";
import { KIT_IDS } from "@/lib/fundraising/flavor-kits";
import { hexColor, uploadedImageUrl } from "@/lib/fundraising/signup-fields";

const SignupSchema = z.object({
  schoolName:   z.string().min(2).max(120),
  teamName:     z.string().min(2).max(80),
  contactName:  z.string().min(2).max(100),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
  goalAmount:   z.number().min(100).max(50000).default(1000),
  message:      z.string().max(1000).optional(),
  requestedFulfillment: z.enum(["ORDER_FORMS_AND_BULK", "ONLINE_ONLY"]),
  resaleNumber:         z.string().max(60).optional(),
  // Which kit the new store sells. Approval stocks the store with exactly these flavors.
  flavorPackage:        z.enum(KIT_IDS),
  // The group's three colors: main (teamColor), secondary and accent.
  teamColor:            hexColor,
  secondaryColor:       hexColor,
  accentColor:          hexColor,
  logoUrl:              uploadedImageUrl.optional(),
  coverPhotoUrl:        uploadedImageUrl.optional(),
  missionStatement:     z.string().trim().max(500).optional(),
  bio:                  z.string().trim().max(5000).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = SignupSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid form data", details: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;

  const existing = await db.fundraiserSignupRequest.findFirst({
    where: { contactEmail: data.contactEmail, teamName: data.teamName, status: { in: ["PENDING", "APPROVED"] } },
  });
  if (existing) {
    return NextResponse.json({ error: "An application for this team and email already exists." }, { status: 409 });
  }

  const request = await db.fundraiserSignupRequest.create({
    data: {
      schoolName:   data.schoolName,
      teamName:     data.teamName,
      contactName:  data.contactName,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone ?? null,
      goalAmount:   data.goalAmount,
      message:      data.message ?? null,
      requestedFulfillment: data.requestedFulfillment,
      // Only means anything on a drive that collects order forms. The brochure is no longer
      // asked for here; the admin settles it at approval.
      resaleNumber: data.requestedFulfillment === "ORDER_FORMS_AND_BULK" ? (data.resaleNumber ?? null) : null,
      flavorPackage:    data.flavorPackage,
      teamColor:        data.teamColor,
      secondaryColor:   data.secondaryColor,
      accentColor:      data.accentColor,
      logoUrl:          data.logoUrl ?? null,
      coverPhotoUrl:    data.coverPhotoUrl ?? null,
      missionStatement: data.missionStatement || null,
      bio:              data.bio || null,
      status:       "PENDING",
    },
  });

  return NextResponse.json({ success: true, requestId: request.id }, { status: 201 });
}
