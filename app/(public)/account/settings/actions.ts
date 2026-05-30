"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email(),
  phone: z.string().min(7).max(20).optional().or(z.literal("")),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(6, "Current password required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

const addressSchema = z.object({
  id: z.string().optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  company: z.string().optional().or(z.literal("")),
  street: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().min(3, "Zip code is required"),
  country: z.string().min(2, "Country is required"),
  phone: z.string().optional().or(z.literal("")),
  type: z.enum(["SHIPPING", "BILLING", "BOTH"]).optional(),
  isDefault: z.boolean().optional(),
});

export async function updateProfile(_: unknown, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { ok: false, message: "Unauthorized" };
  }
  const parse = profileSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
  });
  if (!parse.success) {
    return { ok: false, errors: parse.error.flatten().fieldErrors };
  }

  const { name, email, phone } = parse.data;

  await prisma.user.update({
    where: { id: (session.user as any).id },
    data: { name, email, phone: phone || null },
  });

  revalidatePath("/account");
  revalidatePath("/account/settings");
  return { ok: true, message: "Profile updated" };
}

export async function changePassword(_: unknown, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { ok: false, message: "Unauthorized" };
  }

  const parse = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parse.success) {
    return { ok: false, errors: parse.error.flatten().fieldErrors };
  }

  const user = await prisma.user.findUnique({
    where: { id: (session.user as any).id },
    select: { password: true },
  });

  if (!user?.password) {
    return { ok: false, message: "Password updates are not available for this account." };
  }

  const match = await bcrypt.compare(parse.data.currentPassword, user.password);
  if (!match) {
    return { ok: false, message: "Current password is incorrect" };
  }

  const hash = await bcrypt.hash(parse.data.newPassword, 10);
  await prisma.user.update({
    where: { id: (session.user as any).id },
    data: { password: hash },
  });

  return { ok: true, message: "Password updated" };
}

export async function saveAddress(_: unknown, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { ok: false, message: "Unauthorized" };
  }

  const parse = addressSchema.safeParse({
    id: formData.get("id") || undefined,
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    company: formData.get("company"),
    street: formData.get("street"),
    city: formData.get("city"),
    state: formData.get("state"),
    zipCode: formData.get("zipCode"),
    country: formData.get("country"),
    phone: formData.get("phone"),
    type: formData.get("type") || "SHIPPING",
    isDefault: formData.get("isDefault") === "on" ? true : false,
  });
  if (!parse.success) {
    return { ok: false, errors: parse.error.flatten().fieldErrors };
  }

  const data = {
    firstName: parse.data.firstName,
    lastName: parse.data.lastName,
    company: parse.data.company || null,
    street: parse.data.street,
    city: parse.data.city,
    state: parse.data.state,
    zipCode: parse.data.zipCode,
    country: parse.data.country,
    phone: parse.data.phone || null,
    type: (parse.data.type ?? "SHIPPING") as any,
    isDefault: parse.data.isDefault ?? false,
    userId: (session.user as any).id,
  };

  if (parse.data.id) {
    await prisma.address.update({ where: { id: parse.data.id }, data });
  } else {
    await prisma.address.create({ data });
  }

  // If setting default, unset others
  if (data.isDefault) {
    await prisma.address.updateMany({
      where: { userId: (session.user as any).id, NOT: { id: parse.data.id ?? undefined } },
      data: { isDefault: false },
    });
  }

  revalidatePath("/account/settings");
  return { ok: true, message: "Address saved" };
}

export async function deleteAddress(_: unknown, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { ok: false, message: "Unauthorized" };
  }
  const id = String(formData.get("id") || "");
  if (!id) return { ok: false, message: "Missing address id" };

  await prisma.address.delete({ where: { id } });
  revalidatePath("/account/settings");
  return { ok: true, message: "Address deleted" };
}
