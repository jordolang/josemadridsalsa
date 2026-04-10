"use client";

import { useState } from "react";

interface Props {
  signupId?: string;
  teamId?:   string;
  teamName:  string;
  hasKey?:   boolean;
  slug?:     string;
}

export default function AdminFundraiserActions({ signupId, teamId, teamName, hasKey, slug }: Props) {
  const [loading, setLoading] = useState(false);
  const [apiKey,  setApiKey]  = useState<string | null>(null);
  const [done,    setDone]    = useState(false);
  const [notes,   setNotes]   = useState("");
  const [color,   setColor]   = useState("#9B7FFF");
  const [period,  setPeriod]  = useState(new Date().toISOString().slice(0, 7));

  const approve = async () => {
    if (!signupId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/fundraiser/approve", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ signupId, teamColor: color, activePeriod: period, reviewNotes: notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setApiKey(data.apiKey); setDone(true);
    } catch (e: unknown) { alert((e as Error).message); }
    finally { setLoading(false); }
  };

  const reject = async () => {
    if (!signupId) return;
    if (!confirm(`Reject application from ${teamName}?`)) return;
    setLoading(true);
    await fetch("/api/admin/fundraiser/reject", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ signupId, reviewNotes: notes }),
    });
    setDone(true); setLoading(false);
  };

  const rotateKey = async () => {
    if (!teamId) return;
    if (!confirm(`Rotate API key for ${teamName}? The old key stops working immediately.`)) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/fundraiser/rotate-key", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ teamId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setApiKey(data.apiKey);
    } catch (e: unknown) { alert((e as Error).message); }
    finally { setLoading(false); }
  };

  if (done && !apiKey) return <span className="text-xs text-muted-foreground">Done</span>;

  if (apiKey) return (
    <div className="bg-black rounded p-3 mt-2">
      <div className="text-xs text-amber-400 mb-1 font-mono font-bold">API KEY — SHOWN ONCE. COPY NOW.</div>
      <code className="text-xs text-green-400 font-mono break-all block mb-2">{apiKey}</code>
      <div className="text-xs text-muted-foreground mb-2">Email this key to {teamName}. It will not be shown again.</div>
      <button onClick={() => navigator.clipboard.writeText(apiKey)} className="text-xs bg-green-700 text-white px-3 py-1 rounded mr-2">Copy to Clipboard</button>
      {slug && <a href={`/fundraise/${slug}`} target="_blank" className="text-xs text-blue-400 underline">View Profile Page</a>}
    </div>
  );

  if (signupId) return (
    <div className="space-y-2 mt-2">
      <div className="flex gap-3 items-center flex-wrap">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Team Color</label>
          <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer"/>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Active Period (YYYY-MM)</label>
          <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="border rounded px-2 py-1 text-xs"/>
        </div>
      </div>
      <textarea placeholder="Admin notes (optional)..." value={notes} onChange={e => setNotes(e.target.value)} className="w-full border rounded p-2 text-xs resize-none h-16"/>
      <div className="flex gap-2">
        <button onClick={approve} disabled={loading} className="flex-1 bg-green-600 text-white text-xs py-2 px-3 rounded font-semibold disabled:opacity-50">
          {loading ? "Processing..." : "APPROVE + ISSUE API KEY"}
        </button>
        <button onClick={reject} disabled={loading} className="bg-destructive/10 text-destructive text-xs py-2 px-3 rounded font-semibold disabled:opacity-50">Reject</button>
      </div>
    </div>
  );

  return (
    <div className="flex gap-2 items-center">
      {slug && <a href={`/fundraise/${slug}`} target="_blank" className="text-xs text-blue-500 underline">Profile</a>}
      <button onClick={rotateKey} disabled={loading} className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded font-semibold disabled:opacity-50">
        {loading ? "..." : "Rotate Key"}
      </button>
    </div>
  );
}
