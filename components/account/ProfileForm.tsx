"use client";

import { useState, useTransition } from "react";
import { updateProfile, changePassword } from "@/app/account/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  defaultValues: { name: string; email: string; phone?: string | null };
};

export function ProfileForm({ defaultValues }: Props) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const onSubmitProfile = (formData: FormData) => {
    setMessage(null);
    setErrors({});
    start(async () => {
      const res = await updateProfile(null, formData);
      if (!res.ok) {
        setErrors((res as any).errors ?? {});
        setMessage((res as any).message ?? "Failed to update profile");
      } else {
        setMessage("Profile updated");
      }
    });
  };

  const onSubmitPassword = (formData: FormData) => {
    setMessage(null);
    setErrors({});
    start(async () => {
      const res = await changePassword(null, formData);
      if (!res.ok) {
        setErrors((res as any).errors ?? {});
        setMessage((res as any).message ?? "Failed to update password");
      } else {
        setMessage("Password updated");
      }
    });
  };

  return (
    <div className="grid gap-6">
      <form action={onSubmitProfile} className="grid gap-3">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={defaultValues.name} disabled={pending} />
          {errors.name?.length ? <p className="text-xs text-red-600">{errors.name[0]}</p> : null}
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={defaultValues.email} disabled={pending} />
          {errors.email?.length ? <p className="text-xs text-red-600">{errors.email[0]}</p> : null}
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={defaultValues.phone ?? ""} disabled={pending} />
          {errors.phone?.length ? <p className="text-xs text-red-600">{errors.phone[0]}</p> : null}
        </div>
        <div>
          <Button type="submit" disabled={pending}>Save Profile</Button>
        </div>
      </form>

      <div className="border-t pt-4">
        <h3 className="font-medium mb-2">Change Password</h3>
        <form action={onSubmitPassword} className="grid gap-3">
          <div>
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input id="currentPassword" name="currentPassword" type="password" disabled={pending} />
          </div>
          <div>
            <Label htmlFor="newPassword">New Password</Label>
            <Input id="newPassword" name="newPassword" type="password" disabled={pending} />
          </div>
          <div>
            <Button type="submit" disabled={pending}>Update Password</Button>
          </div>
        </form>
      </div>

      {message ? <div className="text-sm">{message}</div> : null}
    </div>
  );
}
