"use client";

import { useState } from "react";

const P = {
  bg0:"#0a0603", bg1:"#140c05", bg2:"#1e1008",
  gold:"#C8860A", gold3:"#F5C842", goldDim:"#6B4A18",
  brown:"#2A1206", cream:"#D4A870", creamDim:"#8A6030",
  maroonLight:"#B02020",
};

const INPUT: React.CSSProperties = {
  width:"100%", padding:"10px 12px", background:P.bg2,
  border:`1px solid ${P.goldDim}`, color:P.cream,
  fontFamily:"'Courier New',monospace", fontSize:13,
  outline:"none", boxSizing:"border-box",
};
const LABEL: React.CSSProperties = {
  display:"block", fontSize:10, color:P.goldDim,
  letterSpacing:2, marginBottom:4,
  fontFamily:"'Courier New',monospace", textTransform:"uppercase",
};

export default function FundraiserSignupPage() {
  const [form, setForm] = useState({
    schoolName:"", teamName:"", contactName:"",
    contactEmail:"", contactPhone:"", goalAmount:"1000", message:"",
  });
  const [status, setStatus] = useState<"idle"|"submitting"|"success"|"error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.schoolName || !form.teamName || !form.contactName || !form.contactEmail) {
      setErrorMsg("Please fill in all required fields."); return;
    }
    setStatus("submitting"); setErrorMsg("");
    try {
      const res = await fetch("/api/fundraiser/signup", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ ...form, goalAmount: parseFloat(form.goalAmount) || 1000 }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Submission failed");
      setStatus("success");
    } catch (e: unknown) {
      setErrorMsg((e as Error).message); setStatus("error");
    }
  };

  if (status === "success") return (
    <div style={{background:P.bg0,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{maxWidth:480,width:"100%",background:P.bg1,border:`2px solid ${P.gold}`,padding:32,textAlign:"center",fontFamily:"'Courier New',monospace"}}>
        <div style={{fontSize:18,color:P.gold3,letterSpacing:3,marginBottom:12,fontWeight:700}}>APPLICATION RECEIVED</div>
        <div style={{fontSize:12,color:P.creamDim,lineHeight:1.8}}>
          Your fundraiser signup has been submitted for review.<br/>
          You will receive your unique API key once approved.<br/><br/>
          <span style={{color:P.goldDim}}>Watch your email for approval confirmation.</span>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{background:P.bg0,minHeight:"100vh",padding:"32px 16px",fontFamily:"'Courier New',monospace"}}>
      <div style={{maxWidth:560,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:10,color:P.goldDim,letterSpacing:4,marginBottom:4}}>JOSE MADRID SALSA</div>
          <div style={{fontSize:22,color:P.gold3,letterSpacing:3,fontWeight:700}}>FUNDRAISER SIGNUP</div>
          <div style={{fontSize:11,color:P.creamDim,letterSpacing:2,marginTop:6}}>JOIN THE BATTLE ARENA — RAISE FUNDS FOR YOUR SCHOOL</div>
        </div>
        <div style={{background:P.bg1,border:`1.5px solid ${P.gold}`,padding:28}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
            <div><label style={LABEL}>School / Organization *</label><input style={INPUT} value={form.schoolName} onChange={set("schoolName")} placeholder="Tri-County HS"/></div>
            <div><label style={LABEL}>Team / Group Name *</label><input style={INPUT} value={form.teamName} onChange={set("teamName")} placeholder="Purple Phoenix"/></div>
          </div>
          <div style={{marginBottom:16}}><label style={LABEL}>Your Name *</label><input style={INPUT} value={form.contactName} onChange={set("contactName")} placeholder="Coach / Team Lead Name"/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
            <div><label style={LABEL}>Email Address *</label><input style={INPUT} type="email" value={form.contactEmail} onChange={set("contactEmail")} placeholder="you@school.edu"/></div>
            <div><label style={LABEL}>Phone (optional)</label><input style={INPUT} type="tel" value={form.contactPhone} onChange={set("contactPhone")} placeholder="(740) 555-0100"/></div>
          </div>
          <div style={{marginBottom:16}}>
            <label style={LABEL}>Fundraising Goal ($)</label>
            <input style={INPUT} type="number" min={100} step={50} value={form.goalAmount} onChange={set("goalAmount")}/>
            <div style={{fontSize:9,color:P.goldDim,marginTop:4}}>Your goal determines your warrior&apos;s HP in the Battle Arena</div>
          </div>
          <div style={{marginBottom:24}}><label style={LABEL}>Message to Admin (optional)</label><textarea style={{...INPUT,resize:"vertical",minHeight:80}} value={form.message} onChange={set("message")} placeholder="Tell us about your team..."/></div>
          {errorMsg && <div style={{color:P.maroonLight,fontSize:11,marginBottom:16,border:`1px solid ${P.maroonLight}`,padding:"8px 12px"}}>{errorMsg}</div>}
          <div style={{background:P.bg0,border:`1px solid ${P.goldDim}`,padding:"12px 16px",marginBottom:20,fontSize:10,color:P.creamDim,lineHeight:1.8}}>
            <div style={{color:P.gold,marginBottom:4,fontWeight:700}}>HOW IT WORKS</div>
            After approval, you will receive a unique API key by email.<br/>
            Every sale through your page triggers an attack on opponents.<br/>
            Share on Facebook to activate a 15-minute damage shield.
          </div>
          <button onClick={handleSubmit} disabled={status==="submitting"}
            style={{width:"100%",padding:"13px 0",background:P.brown,border:`2px solid ${P.gold}`,color:P.gold3,fontSize:13,fontWeight:700,letterSpacing:3,textTransform:"uppercase",cursor:status==="submitting"?"not-allowed":"pointer",opacity:status==="submitting"?0.6:1}}>
            {status==="submitting" ? "SUBMITTING..." : "SUBMIT APPLICATION"}
          </button>
        </div>
      </div>
    </div>
  );
}
