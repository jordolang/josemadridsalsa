import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { ProfileForm } from "@/components/account/ProfileForm";
import { AddressForm } from "@/components/account/AddressForm";

export const metadata: Metadata = {
  title: "Account Settings",
  description: "Update your profile and manage addresses",
};

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/account/settings");
  }
  const userId = (session.user as any).id;

  const [user, addresses] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true },
    }),
    prisma.address.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        company: true,
        street: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        phone: true,
        type: true,
        isDefault: true,
      },
    }),
  ]);

  if (!user) {
    redirect("/auth/signin?callbackUrl=/account/settings");
  }

  return (
    <div className="grid gap-6">
      <Card className="p-4">
        <h1 className="text-xl font-semibold mb-4">Profile</h1>
        <ProfileForm defaultValues={{ name: user.name ?? "", email: user.email ?? "", phone: user.phone ?? "" }} />
      </Card>

      <Card className="p-4">
        <h2 className="text-lg font-medium mb-4">Addresses</h2>
        <div className="grid gap-4">
          <AddressForm mode="create" />
          <div className="grid gap-3">
            {addresses.map(addr => (
              <AddressForm
                key={addr.id}
                mode="edit"
                address={addr}
              />
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
