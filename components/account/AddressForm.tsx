"use client";

import { useState, useTransition } from "react";
import { saveAddress, deleteAddress } from "@/app/account/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Address = {
  id: string;
  firstName: string;
  lastName: string;
  company: string | null;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone: string | null;
  type: string;
  isDefault: boolean;
};

type Props =
  | { mode: "create"; address?: never }
  | { mode: "edit"; address: Address };

export function AddressForm(props: Props) {
  const { mode } = props;
  const addr = props.mode === "edit" ? props.address : undefined;
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const onSubmit = (formData: FormData) => {
    setMessage(null);
    setErrors({});
    start(async () => {
      const res = await saveAddress(null, formData);
      if (!res.ok) {
        setErrors((res as any).errors ?? {});
        setMessage((res as any).message ?? "Failed to save address");
      } else {
        setMessage("Address saved");
      }
    });
  };

  const onDelete = () => {
    if (!addr?.id) return;
    const formData = new FormData();
    formData.set("id", addr.id);
    start(async () => {
      const res = await deleteAddress(null, formData);
      setMessage(res.message ?? null);
    });
  };

  return (
    <form action={onSubmit} className="grid gap-3 border rounded p-3">
      <input type="hidden" name="id" defaultValue={addr?.id ?? ""} />
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`firstName-${addr?.id ?? "new"}`}>First Name</Label>
          <Input id={`firstName-${addr?.id ?? "new"}`} name="firstName" defaultValue={addr?.firstName ?? ""} disabled={pending} />
          {errors.firstName?.length ? <p className="text-xs text-red-600">{errors.firstName[0]}</p> : null}
        </div>
        <div>
          <Label htmlFor={`lastName-${addr?.id ?? "new"}`}>Last Name</Label>
          <Input id={`lastName-${addr?.id ?? "new"}`} name="lastName" defaultValue={addr?.lastName ?? ""} disabled={pending} />
          {errors.lastName?.length ? <p className="text-xs text-red-600">{errors.lastName[0]}</p> : null}
        </div>
      </div>
      <div>
        <Label htmlFor={`company-${addr?.id ?? "new"}`}>Company (optional)</Label>
        <Input id={`company-${addr?.id ?? "new"}`} name="company" defaultValue={addr?.company ?? ""} disabled={pending} />
      </div>
      <div>
        <Label htmlFor={`street-${addr?.id ?? "new"}`}>Street Address</Label>
        <Input id={`street-${addr?.id ?? "new"}`} name="street" defaultValue={addr?.street ?? ""} disabled={pending} />
        {errors.street?.length ? <p className="text-xs text-red-600">{errors.street[0]}</p> : null}
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <Label htmlFor={`city-${addr?.id ?? "new"}`}>City</Label>
          <Input id={`city-${addr?.id ?? "new"}`} name="city" defaultValue={addr?.city ?? ""} disabled={pending} />
          {errors.city?.length ? <p className="text-xs text-red-600">{errors.city[0]}</p> : null}
        </div>
        <div>
          <Label htmlFor={`state-${addr?.id ?? "new"}`}>State</Label>
          <Input id={`state-${addr?.id ?? "new"}`} name="state" defaultValue={addr?.state ?? ""} disabled={pending} />
          {errors.state?.length ? <p className="text-xs text-red-600">{errors.state[0]}</p> : null}
        </div>
        <div>
          <Label htmlFor={`zipCode-${addr?.id ?? "new"}`}>Zip Code</Label>
          <Input id={`zipCode-${addr?.id ?? "new"}`} name="zipCode" defaultValue={addr?.zipCode ?? ""} disabled={pending} />
          {errors.zipCode?.length ? <p className="text-xs text-red-600">{errors.zipCode[0]}</p> : null}
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`country-${addr?.id ?? "new"}`}>Country</Label>
          <Input id={`country-${addr?.id ?? "new"}`} name="country" defaultValue={addr?.country ?? "US"} disabled={pending} />
          {errors.country?.length ? <p className="text-xs text-red-600">{errors.country[0]}</p> : null}
        </div>
        <div>
          <Label htmlFor={`phone-${addr?.id ?? "new"}`}>Phone</Label>
          <Input id={`phone-${addr?.id ?? "new"}`} name="phone" defaultValue={addr?.phone ?? ""} disabled={pending} />
          {errors.phone?.length ? <p className="text-xs text-red-600">{errors.phone[0]}</p> : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input id={`isDefault-${addr?.id ?? "new"}`} name="isDefault" type="checkbox" defaultChecked={Boolean(addr?.isDefault)} disabled={pending} />
        <Label htmlFor={`isDefault-${addr?.id ?? "new"}`}>Set as default</Label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{mode === "edit" ? "Save" : "Add Address"}</Button>
        {mode === "edit" ? (
          <Button type="button" variant="destructive" onClick={onDelete} disabled={pending}>Delete</Button>
        ) : null}
      </div>
      {message ? <div className="text-sm">{message}</div> : null}
    </form>
  );
}
