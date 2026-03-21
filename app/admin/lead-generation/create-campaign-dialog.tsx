'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createLeadCampaign } from '@/lib/actions/lead-generation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function CreateCampaignDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const name = fd.get('name') as string;
    const city = fd.get('city') as string;
    const state = fd.get('state') as string;
    const district = fd.get('district') as string;
    const schoolType = fd.get('schoolType') as string;
    const limit = parseInt(fd.get('limit') as string) || 50;

    try {
      const id = await createLeadCampaign({ name, city, state, district, schoolType, limit });
      setOpen(false);
      router.push(`/admin/lead-generation/${id}`);
    } catch (err) {
      console.error(err);
      alert("Failed to create campaign");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New Campaign</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Create Sports Team Campaign</DialogTitle>
            <DialogDescription>
              Configure the search parameters to find school athletics contacts.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Campaign Name</Label>
              <Input id="name" name="name" placeholder="E.g., Columbus OH High Schools" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" placeholder="E.g., Columbus" required />
            </div>
             <div className="grid gap-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" name="state" placeholder="E.g., Ohio or OH" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="district">School District (Optional)</Label>
              <Input id="district" name="district" placeholder="E.g., Columbus City Schools" />
            </div>
             <div className="grid gap-2">
              <Label htmlFor="schoolType">School Type</Label>
              <Input id="schoolType" name="schoolType" defaultValue="high school" placeholder="E.g., high school, middle school" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="limit">Max Results Limit</Label>
              <Input id="limit" name="limit" type="number" defaultValue={50} required />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Campaign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
