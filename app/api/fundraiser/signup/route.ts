import { NextRequest, NextResponse } from "next/server";
import { prisma as db } from "@/lib/prisma";
import { z } from "zod";

const SignupSchema = z.object({
  schoolName:   z.string().min(2).max(120),
  teamName:     z.string().min(2).max(80),
  contactName:  z.string().min(2).max(100),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
  goalAmount:   z.number().min(100).max(50000).default(1000),
  message:      z.string().max(1000).optional(),
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
      status:       "PENDING",
    },
  });

  return NextResponse.json({ success: true, requestId: request.id }, { status: 201 });
}
