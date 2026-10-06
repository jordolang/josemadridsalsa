"use client";

import { useState } from "react";
import {
  BROCHURE_OPTIONS,
  FULFILLMENT_OPTIONS,
  ONLINE_LINK_NOTE,
  RESALE_NUMBER_NOTE,
  needsBrochureChoice,
} from "@/lib/fundraising/fulfillment";
import type { BrochureOption, FulfillmentMethod } from "@prisma/client";

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
    resaleNumber:"",
  });
  // Collecting order forms is what most groups do, so it starts selected rather than making
  // them choose blind. The online link is live either way — see lib/fundraising/fulfillment.
  const [fulfillment, setFulfillment] = useState<FulfillmentMethod>("ORDER_FORMS_AND_BULK");
  const [brochure, setBrochure] = useState<BrochureOption>("PRINT_YOUR_OWN");
  const collecting = needsBrochureChoice(fulfillment);
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
        body: JSON.stringify({
          ...form,
          goalAmount: parseFloat(form.goalAmount) || 1000,
          requestedFulfillment: fulfillment,
          // Both only mean anything on a drive that collects forms; an online-only campaign
          // has nothing to print and makes no wholesale purchase.
          requestedBrochure: collecting ? brochure : undefined,
          resaleNumber: collecting ? form.resaleNumber || undefined : undefined,
        }),
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

          {/* How they run the drive. Explained in full here rather than in a tooltip: a
              coordinator who reaches the end surprised to learn they owe us an invoice, or
              that nothing was written down on their side, is a coordinator we lost. */}
          <div style={{marginBottom:24,borderTop:`1px solid ${P.goldDim}`,paddingTop:20}}>
            <div style={{fontSize:13,color:P.gold3,letterSpacing:2,fontWeight:700,marginBottom:6}}>HOW WILL YOU RUN YOUR FUNDRAISER?</div>
            <div style={{fontSize:11,color:P.creamDim,lineHeight:1.7,marginBottom:14}}>
              Most groups run the classic paper drive, and that is what we have selected for you.
              Whichever you choose, you also get your own web page and link.
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {FULFILLMENT_OPTIONS.map((opt) => {
                const active = fulfillment === opt.value;
                return (
                  <label
                    key={opt.value}
                    style={{
                      display:"block", cursor:"pointer", padding:"14px 16px",
                      background: active ? P.bg2 : P.bg0,
                      border:`1px solid ${active ? P.gold : P.goldDim}`,
                    }}
                  >
                    <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:6}}>
                      <input
                        type="radio" name="fulfillment" value={opt.value} checked={active}
                        onChange={() => setFulfillment(opt.value)}
                        style={{accentColor:P.gold,marginTop:2}}
                      />
                      <span style={{fontSize:12,color:active ? P.gold3 : P.cream,fontWeight:700,letterSpacing:1}}>
                        {opt.label.toUpperCase()}
                      </span>
                      {opt.recommended && (
                        <span style={{fontSize:9,color:P.bg0,background:P.gold,padding:"1px 6px",letterSpacing:1,fontWeight:700}}>
                          RECOMMENDED
                        </span>
                      )}
                    </div>
                    <div style={{fontSize:10,color:P.goldDim,letterSpacing:1,marginBottom:8,paddingLeft:24}}>
                      {opt.tagline}
                    </div>
                    <div style={{paddingLeft:24,display:"flex",flexDirection:"column",gap:8}}>
                      {opt.body.map((para, i) => (
                        <div key={i} style={{fontSize:11,color:P.creamDim,lineHeight:1.75}}>{para}</div>
                      ))}
                      <div style={{fontSize:11,color:P.cream,lineHeight:1.75}}>
                        <span style={{color:P.gold}}>The trade-off: </span>{opt.tradeOff}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* True of both options, and the thing coordinators most often misunderstand. */}
            <div style={{marginTop:12,padding:"12px 16px",background:P.bg0,border:`1px dashed ${P.goldDim}`,fontSize:10,color:P.creamDim,lineHeight:1.8}}>
              {ONLINE_LINK_NOTE}
            </div>

            {collecting && (
              <div style={{marginTop:16,paddingLeft:16,borderLeft:`2px solid ${P.goldDim}`,display:"flex",flexDirection:"column",gap:16}}>
                <div>
                  <label style={LABEL}>Where will your brochures come from?</label>
                  <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:6}}>
                    {BROCHURE_OPTIONS.map((opt) => (
                      <label key={opt.value} style={{display:"flex",gap:10,cursor:"pointer",alignItems:"flex-start"}}>
                        <input
                          type="radio" name="brochure" value={opt.value}
                          checked={brochure === opt.value}
                          onChange={() => setBrochure(opt.value)}
                          style={{accentColor:P.gold,marginTop:3}}
                        />
                        <span>
                          <span style={{fontSize:11,color:P.cream,display:"block"}}>{opt.label}</span>
                          <span style={{fontSize:10,color:P.creamDim,lineHeight:1.7}}>{opt.detail}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={LABEL}>Resale certificate number</label>
                  <input style={INPUT} value={form.resaleNumber} onChange={set("resaleNumber")} placeholder="Optional for now"/>
                  <div style={{fontSize:9,color:P.goldDim,marginTop:4,lineHeight:1.7}}>{RESALE_NUMBER_NOTE}</div>
                </div>
              </div>
            )}
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
