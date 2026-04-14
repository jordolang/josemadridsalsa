"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  signupId?: string;
  teamId?: string;
  teamName: string;
  hasKey?: boolean;
  slug?: string;
}

export default function AdminFundraiserActions({
  signupId,
  teamId,
  teamName,
  slug,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [notes, setNotes] = useState("");
  const [color, setColor] = useState("#9B7FFF");
  const [period, setPeriod] = useState(
    new Date().toISOString().slice(0, 7),
  );

  const getErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : "Unexpected error";

  const approve = async () => {
    if (!signupId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/fundraiser/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signupId,
          teamColor: color,
          activePeriod: period,
          reviewNotes: notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setApiKey(data.apiKey);
      setDone(true);
      toast.success("Fundraiser approved and API key issued");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const reject = async () => {
    if (!signupId) return;
    if (!confirm(`Reject application from ${teamName}?`)) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/fundraiser/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signupId, reviewNotes: notes }),
      });
      if (!res.ok) throw new Error("Failed to reject fundraiser");
      setDone(true);
      toast.success("Fundraiser rejected");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const rotateKey = async () => {
    if (!teamId) return;
    if (
      !confirm(
        `Rotate API key for ${teamName}? The old key stops working immediately.`,
      )
    )
      return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/fundraiser/rotate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setApiKey(data.apiKey);
      toast.success("API key rotated");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const copyKey = async () => {
    if (!apiKey) return;
    await navigator.clipboard.writeText(apiKey);
    toast.success("API key copied to clipboard");
  };

  if (done && !apiKey) {
    return <span className="text-xs text-muted-foreground">Done</span>;
  }

  if (apiKey) {
    return (
      <div className="mt-2 rounded-md border border-border bg-muted p-3">
        <div className="mb-1 font-mono text-xs font-bold text-destructive">
          API KEY — SHOWN ONCE. COPY NOW.
        </div>
        <code className="mb-2 block break-all font-mono text-xs text-foreground">
          {apiKey}
        </code>
        <div className="mb-2 text-xs text-muted-foreground">
          Email this key to {teamName}. It will not be shown again.
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={copyKey}>
            <Copy className="mr-1 h-3 w-3" />
            Copy
          </Button>
          {slug && (
            <Button size="sm" variant="outline" asChild>
              <a
                href={`/fundraise/${slug}`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="mr-1 h-3 w-3" />
                View Profile
              </a>
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (signupId) {
    return (
      <div className="mt-2 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor={`team-color-${signupId}`} className="text-xs">
              Team Color
            </Label>
            <Input
              id={`team-color-${signupId}`}
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-12 cursor-pointer p-1"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`period-${signupId}`} className="text-xs">
              Active Period (YYYY-MM)
            </Label>
            <Input
              id={`period-${signupId}`}
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="h-9 w-40 text-xs"
            />
          </div>
        </div>
        <Textarea
          placeholder="Admin notes (optional)..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="h-16 resize-none text-xs"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={approve}
            disabled={loading}
            className="flex-1"
          >
            {loading ? "Processing..." : "Approve + Issue API Key"}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={reject}
            disabled={loading}
          >
            Reject
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {slug && (
        <Button size="sm" variant="link" asChild className="h-auto p-0">
          <a href={`/fundraise/${slug}`} target="_blank" rel="noreferrer">
            Profile
          </a>
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={rotateKey}
        disabled={loading}
      >
        <KeyRound className="mr-1 h-3 w-3" />
        {loading ? "..." : "Rotate Key"}
      </Button>
    </div>
  );
}
