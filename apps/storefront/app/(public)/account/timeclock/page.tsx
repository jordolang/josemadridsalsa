import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getCurrentUser, isStaff } from "@/lib/rbac";
import { Card } from "@/components/ui/card";
import { TimeClockPanel } from "@/components/account/timeclock/TimeClockPanel";
import { buildTimeClockView } from "@/lib/timeclock-server";
import { createMetadata } from "@/lib/metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Timeclock - Jose Madrid Salsa",
  description: "Clock in and out and review your recorded work hours.",
  pathname: "/account/timeclock",
});

export default async function TimeClockPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/signin?callbackUrl=/account/timeclock");
  }

  if (!isStaff(user)) {
    return (
      <Card className="p-6">
        <h1 className="text-xl font-semibold">Timeclock</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The timeclock is available to staff accounts only.
        </p>
      </Card>
    );
  }

  const view = await buildTimeClockView(user.id, null, null);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-xl font-semibold">Timeclock</h1>
        <p className="text-sm text-muted-foreground">
          {user.name ?? user.email}
          {user.role === UserRole.STAFF ? "" : ` · ${user.role}`}
        </p>
      </div>
      <TimeClockPanel initialView={view} />
    </div>
  );
}
