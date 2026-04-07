"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ============================================================================
//  ██████╗ ██████╗ ███╗   ██╗███████╗██╗ ██████╗
//  ██╔════╝██╔═══██╗████╗  ██║██╔════╝██║██╔════╝
//  ██║     ██║   ██║██╔██╗ ██║█████╗  ██║██║  ███╗
//  ██║     ██║   ██║██║╚██╗██║██╔══╝  ██║██║   ██║
//  ╚██████╗╚██████╔╝██║ ╚████║██║     ██║╚██████╔╝
//   ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝     ╚═╝ ╚═════╝
//
//  Edit only the CONFIG block below.
//  Nothing below the CONFIG section needs to change unless you are
//  adding a new mascot sprite or modifying core game mechanics.
// ============================================================================

const CONFIG = {

  // ── MY TEAM (the fundraiser page this component is embedded on) ──────────
  myTeam: {
    id:       "purple",
    name:     "West M Tornados",
    school:   "West Muskingum HS",
    color:    "#9955FF",
    mascot:   "tornado",           // must match a key in MASCOT_SPRITES
    goal:     1500,
    shareUrl: "https://josemadrid.net/fundraise/west-m-tornados",
    quips: [
      "SPIN TO WIN!",
      "You can't catch the wind!",
      "Category 5, baby!",
      "Here comes the STORM!",
      "I'll blow you away!",
      "Nothing survives the vortex!",
    ],
  },

  // ── OPPONENT TEAM ─────────────────────────────────────────────────────────
  oppTeam: {
    id:       "gold",
    name:     "Tri-Valley Scotties",
    school:   "Tri-Valley HS",
    color:    "#DDAA00",
    mascot:   "scottie",
    goal:     1200,
    quips: [
      "Woof. You done?",
      "These paws hit HARD.",
      "Terrier-ifying!",
      "Sit. Stay. Lose.",
    ],
  },

  // ── HP / GAME BALANCE ─────────────────────────────────────────────────────
  // Damage = exact dollar amount of sale ($45 sale = 45 damage).
  // Rounds reset HP when a mascot reaches 0.
  startingHP: 1000,

  // ── SHIELD MECHANICS ─────────────────────────────────────────────────────
  // Activated by a confirmed Facebook share.
  // Lasts shieldDurationMinutes and absorbs up to shieldHP total damage.
  // If opponent sale exceeds remaining shieldHP, overflow hits mascot HP.
  // Example: shield has 30 HP, opponent $100 sale → 30 absorbed, 70 to mascot.
  // Only one shield active at a time. Sharing while shielded = no effect.
  shieldDurationMinutes: 30,
  shieldHP:              30,

};

// ============================================================================
// MASCOT SPRITES
// To add a new mascot:
//   1. Create a function: function MyMascot(p: SpriteProps) { return <svg>...</svg>; }
//   2. Add to MASCOT_SPRITES: { mymascot: (p) => <MyMascot {...p}/> }
//   3. Set mascot: "mymascot" in CONFIG.myTeam or CONFIG.oppTeam
// ============================================================================

type SpriteProps = {
  color: string; state: string; tick: number;
  shielded: boolean; flipped: boolean; scale?: number;
};

function TornadoSprite({ color, state, tick, shielded, flipped, scale = 1 }: SpriteProps) {
  const atk = state === "attack", hit = state === "hit", dead = state === "dead";
  const bob = Math.sin(tick * 0.7) * 3;
  const spin = (tick * 18) % 360;
  const cL = "#C8C0E8", cD = "#2A1A55";
  const W = Math.round(128 * scale), H = Math.round(160 * scale);

  if (dead) return (
    <svg width={W} height={Math.round(40*scale)} style={{ imageRendering:"pixelated", transform:`scaleX(${flipped?-1:1})` }}>
      <ellipse cx={W/2} cy={Math.round(20*scale)} rx={W*0.45} ry={Math.round(14*scale)} fill={color} opacity="0.35"/>
    </svg>
  );

  return (
    <svg width={W} height={H} viewBox="0 0 128 160"
      style={{ imageRendering:"pixelated", transform:`scaleX(${flipped?-1:1}) translateY(${bob}px)`,
        filter: hit ? "brightness(3) saturate(0)" : "none",
        transition:"filter 0.08s, transform 0.09s", display:"block" }}>
      {shielded && <ellipse cx="64" cy="80" rx="60" ry="75" fill={color} opacity="0.08" stroke={color} strokeWidth="2" strokeDasharray="6 4"/>}
      {([
        [4,8,120,12],[12,22,104,10],[20,34,88,10],[28,46,72,10],[36,58,56,9],
        [42,69,44,9],[48,80,32,8],[52,90,24,8],[54,100,20,8],[57,110,14,8],
        [60,120,8,8],[62,130,6,8],[62,140,4,6],[63,148,2,6],
      ] as number[][]).map(([x,y,w,h],i)=>(
        <g key={i}>
          <rect x={x} y={y} width={w} height={h} rx="3" fill={color} opacity={0.9-i*0.04}/>
          {i<8 && <rect x={x+8} y={y+2} width={w-16} height={h-4} rx="2" fill={cL} opacity="0.38"/>}
        </g>
      ))}
      <ellipse cx="64" cy="46" rx="14" ry="10" fill={cD} opacity="0.7"/>
      <ellipse cx="64" cy="46" rx="7"  ry="5"  fill={cD} opacity="0.9"/>
      {[...Array(6)].map((_,i)=>{
        const a=(spin+i*60)*Math.PI/180, r=atk?48+i*4:34+i*3;
        return <rect key={i} x={64+Math.cos(a)*r*0.65-2} y={44+Math.sin(a)*r*0.32-2} width={3+(i%3)} height={3+(i%3)} rx="0.5" fill={cL} opacity={0.5-i*0.06}/>;
      })}
      {[...Array(5)].map((_,i)=>(
        <ellipse key={i} cx={64+(i-2)*14} cy={156} rx={9-i} ry={3} fill={color} opacity={0.14-i*0.02}/>
      ))}
      {atk && <>
        <line x1="18" y1="28" x2="4"   y2="50" stroke="#FFFF88" strokeWidth="2" opacity="0.85"/>
        <line x1="110" y1="28" x2="124" y2="50" stroke="#FFFF88" strokeWidth="2" opacity="0.85"/>
        <line x1="64"  y1="6"  x2="64"  y2="-4" stroke="#FFFF88" strokeWidth="3" opacity="0.9"/>
        <circle cx="4"   cy="50" r="4" fill="#FFFF88" opacity="0.65"/>
        <circle cx="124" cy="50" r="4" fill="#FFFF88" opacity="0.65"/>
      </>}
    </svg>
  );
}

function ScottieSprite({ color, state, tick, shielded, flipped, scale = 1 }: SpriteProps) {
  const atk = state === "attack", hit = state === "hit", dead = state === "dead";
  const bob = Math.sin(tick * 0.6) * 2;
  const bc = "#1A1208", col = "#CC1111";
  const W = Math.round(128 * scale), H = Math.round(120 * scale);

  if (dead) return (
    <svg width={W} height={Math.round(32*scale)} style={{ imageRendering:"pixelated", transform:`scaleX(${flipped?-1:1})` }}>
      <ellipse cx={W/2} cy={Math.round(16*scale)} rx={W*0.42} ry={Math.round(12*scale)} fill={bc} opacity="0.45"/>
    </svg>
  );

  return (
    <svg width={W} height={H} viewBox="0 0 128 120"
      style={{ imageRendering:"pixelated", transform:`scaleX(${flipped?-1:1}) translateY(${bob}px)`,
        filter: hit ? "brightness(3) saturate(0)" : "none",
        transition:"filter 0.08s, transform 0.09s", display:"block" }}>
      {shielded && <ellipse cx="64" cy="60" rx="58" ry="55" fill={color} opacity="0.08" stroke={color} strokeWidth="2" strokeDasharray="6 4"/>}
      <rect x="30" y="4"  width="12" height="8"  rx="1" fill={bc}/>
      <rect x="32" y="0"  width="8"  height="6"  rx="1" fill={bc}/>
      <rect x="33" y="-4" width="6"  height="6"  rx="1" fill={bc}/>
      <rect x="56" y="4"  width="12" height="8"  rx="1" fill={bc}/>
      <rect x="58" y="0"  width="8"  height="6"  rx="1" fill={bc}/>
      <rect x="59" y="-4" width="6"  height="6"  rx="1" fill={bc}/>
      <rect x="22" y="10" width="64" height="32" rx="8" fill={bc}/>
      <rect x="16" y="28" width="32" height="18" rx="4" fill={bc}/>
      <rect x="14" y="34" width="10" height="8"  rx="2" fill="#333"/>
      <rect x="15" y="36" width="3"  height="3"  rx="0.5" fill="#555"/>
      <rect x="38" y="16" width="10" height="10" rx="2" fill="#fff"/>
      <rect x="40" y="18" width="6"  height="6"  rx="1" fill="#111"/>
      <rect x="41" y="19" width="2"  height="2"  fill="#fff" opacity="0.8"/>
      <line x1="18" y1="30" x2="5"  y2="28" stroke="#555" strokeWidth="1.5" opacity="0.6"/>
      <line x1="18" y1="33" x2="4"  y2="33" stroke="#555" strokeWidth="1.5" opacity="0.6"/>
      <line x1="18" y1="36" x2="5"  y2="38" stroke="#555" strokeWidth="1.5" opacity="0.6"/>
      {[36,44,52,60,68].map((x,i)=>(
        <rect key={i} x={x} y={40} width="8" height="8" rx="1" fill={col} transform={`rotate(${(i-2)*5},${x+4},44)`}/>
      ))}
      <circle cx="54" cy="50" r="4" fill="#F5C842"/>
      <circle cx="54" cy="50" r="2" fill="#6B4010"/>
      <rect x="30" y="50" width="80" height="38" rx="8" fill={bc}/>
      <rect x="36" y="52" width="60" height="8"  rx="4" fill="#2A2218" opacity="0.55"/>
      <rect x="106" y="28" width="12" height="36" rx="6" fill={bc}/>
      <rect x="106" y="24" width="10" height="10" rx="5" fill={bc}/>
      <rect x="108" y="16" width="8"  height="12" rx="4" fill={bc}/>
      {[32,52,74,94].map((x,i)=>(
        <g key={i}>
          <rect x={x} y={i<2?80:78} width={14} height={i<2?28:30} rx="4" fill={bc}/>
          <rect x={x-2} y={100} width={18} height={8} rx="3" fill={bc}/>
        </g>
      ))}
      {atk && <>
        <line x1="14" y1="72" x2="-10" y2="58" stroke="#FFCC44" strokeWidth="3" opacity="0.9"/>
        <line x1="12" y1="76" x2="-12" y2="70" stroke="#FFCC44" strokeWidth="2" opacity="0.7"/>
        <line x1="12" y1="80" x2="-10" y2="84" stroke="#FFCC44" strokeWidth="2" opacity="0.7"/>
        <circle cx="-10" cy="70" r="9" fill="#FFCC44" opacity="0.18"/>
      </>}
    </svg>
  );
}

const MASCOT_SPRITES: Record<string, (p: SpriteProps) => JSX.Element> = {
  tornado: (p) => <TornadoSprite {...p}/>,
  scottie: (p) => <ScottieSprite {...p}/>,
  // Add new mascots here ↑
};

// ============================================================================
// PALETTE & HELPERS — do not edit
// ============================================================================

const PAL = {
  bg:"#0C0804", panel:"#1A1008", panelBord:"#3D2208",
  gold:"#C8860A", gold2:"#F5C842", goldDim:"#6B4010",
  maroon:"#5A0808", maroonBrd:"#8A1414",
  cream:"#E8D5A8", creamDim:"#9A7E50",
  orange:"#D4620E", red:"#CC2222",
  purple:"#4A1A88", purpleBrd:"#7A3ACC",
};

const SHIELD_MS  = CONFIG.shieldDurationMinutes * 60 * 1000;
const SHIELD_MAX = CONFIG.shieldHP;
const MY  = CONFIG.myTeam;
const OPP = CONFIG.oppTeam;
const BT  = "'Courier New',monospace";

function Arena({ width, height }: { width:number; height:number }) {
  const fY = height * 0.7;
  const stones: React.ReactNode[] = [];
  for (let r=0;r<Math.ceil(fY/28)+1;r++) for (let c=0;c<Math.ceil(width/36)+1;c++) {
    const x=c*36+(r%2===0?0:18)-18, y=r*28;
    const fills=["#161008","#121006","#1A1208","#100E06","#181006"];
    stones.push(<rect key={`${r}${c}`} x={x+1} y={y+1} width={34} height={26} rx="2" fill={fills[(r*7+c*11)%5]} stroke="#0A0804" strokeWidth="1"/>);
  }
  const T=({x,y}:{x:number;y:number})=>(
    <g>
      <rect x={x-3} y={y+8} width={6} height={10} rx="1" fill="#4A2408"/>
      <polygon points={`${x-3},${y+8} ${x},${y-2} ${x+3},${y+8}`} fill="#E07030" opacity="0.9"/>
      <polygon points={`${x-1.5},${y+6} ${x},${y+1} ${x+1.5},${y+6}`} fill="#F5C842" opacity="0.85"/>
      <ellipse cx={x} cy={y+4} rx={16} ry={9} fill="#E07030" opacity="0.07"/>
    </g>
  );
  return (
    <svg width={width} height={height} style={{display:"block",imageRendering:"pixelated"}}>
      <rect width={width} height={height} fill="#0E0A06"/>
      {stones}
      {Array.from({length:Math.ceil(width/32)+1}).map((_,i)=>(
        <rect key={i} x={i*32} y={fY} width={30} height={height-fY+4} rx="1" fill={i%2===0?"#1C1008":"#181006"} stroke="#0A0804" strokeWidth="0.8"/>
      ))}
      <rect x={0} y={fY-8} width={width} height={10} fill="#0A0804" opacity="0.7"/>
      <T x={80} y={22}/><T x={width-80} y={22}/><T x={Math.round(width/2)} y={18}/>
      <rect x={0} y={0} width={70} height={height} fill="#0E0A06" opacity="0.45"/>
      <rect x={width-70} y={0} width={70} height={height} fill="#0E0A06" opacity="0.45"/>
    </svg>
  );
}

function HPBar({ cur, max, color, shieldCur, shieldMax }:
  { cur:number; max:number; color:string; shieldCur?:number; shieldMax?:number }) {
  const pct = Math.max(0,Math.min(1,cur/max));
  const bc  = pct<0.25?PAL.red:pct<0.5?PAL.orange:color;
  const sP  = shieldMax&&shieldMax>0?Math.max(0,Math.min(1,(shieldCur??0)/shieldMax)):0;
  return (
    <div>
      <div style={{height:14,background:"#0A0804",border:`1px solid ${PAL.goldDim}`,borderRadius:3,overflow:"hidden",position:"relative"}}>
        <div style={{position:"absolute",inset:0,width:`${pct*100}%`,background:bc,borderRadius:3,transition:"width 0.4s ease"}}/>
        <div style={{position:"absolute",top:0,left:0,width:`${pct*100}%`,height:"45%",background:"rgba(255,255,255,0.14)",borderRadius:3}}/>
      </div>
      {shieldMax&&shieldMax>0&&(
        <div style={{height:6,background:"#0A0804",border:`1px solid #5A3A88`,borderRadius:2,overflow:"hidden",position:"relative",marginTop:3}}>
          <div style={{position:"absolute",inset:0,width:`${sP*100}%`,background:"#9B7FFF",borderRadius:2,transition:"width 0.4s ease"}}/>
          <div style={{position:"absolute",top:0,left:0,width:`${sP*100}%`,height:"45%",background:"rgba(255,255,255,0.2)",borderRadius:2}}/>
        </div>
      )}
    </div>
  );
}

function Float({text,color}:{text:string;color:string}) {
  return (
    <div style={{position:"absolute",top:-54,left:"50%",transform:"translateX(-50%)",pointerEvents:"none",
      animation:"floatUp 1.6s ease-out forwards",whiteSpace:"nowrap",
      fontFamily:BT,fontSize:15,fontWeight:700,color,
      textShadow:"0 2px 6px #000,0 0 3px #000",zIndex:30}}>
      {text}
    </div>
  );
}

// ============================================================================
// COMPONENT PROPS — wired by your Next.js fundraiser profile page
// ============================================================================

export interface BattleArenaProps {
  /**
   * Dollar amount of the latest sale on MY team's fundraiser page.
   * Set this to a new value each time a sale webhook fires.
   * The component detects the change and triggers an attack.
   * Reset behavior: the component tracks the previous value internally —
   * just pass the new sale amount and it handles the rest.
   */
  incomingSaleDollars?: number;

  /**
   * Dollar amount of the latest sale on the OPPONENT's fundraiser page.
   * Same pattern as incomingSaleDollars.
   */
  opponentSaleDollars?: number;

  /**
   * Set to true for one render cycle when a Facebook share is confirmed.
   * The component activates the shield and resets to false internally.
   * Toggle this value (not just set to true) so each share triggers a new effect.
   */
  shareConfirmed?: boolean;

  /**
   * ISO timestamp string of when the shield expires.
   * Passed from your DB on initial page load if a shield is already active.
   * Example: "2026-04-05T14:30:00.000Z"
   */
  shieldExpiresAt?: string | null;

  /**
   * Remaining shield HP from the DB (passed on initial load).
   * Allows the shield bar to render correctly after a page refresh.
   */
  shieldHPRemaining?: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function BattleArena({
  incomingSaleDollars = 0,
  opponentSaleDollars = 0,
  shareConfirmed = false,
  shieldExpiresAt = null,
  shieldHPRemaining,
}: BattleArenaProps) {
  const [myHP,      setMyHP]      = useState(CONFIG.startingHP);
  const [oppHP,     setOppHP]     = useState(CONFIG.startingHP);
  const [shieldHP,  setShieldHP]  = useState(shieldHPRemaining ?? 0);
  const [shieldExp, setShieldExp] = useState<number|null>(
    shieldExpiresAt ? new Date(shieldExpiresAt).getTime() : null
  );
  const [shieldCD,  setShieldCD]  = useState<string|null>(null);
  const [myWins,    setMyWins]    = useState(0);
  const [oppWins,   setOppWins]   = useState(0);
  const [round,     setRound]     = useState(1);
  const [feed,      setFeed]      = useState<Array<{id:number;type:string;msg:string}>>([]);
  const [myState,   setMyState]   = useState("idle");
  const [oppState,  setOppState]  = useState("idle");
  const [myFloats,  setMyFloats]  = useState<Array<{id:number;text:string;color:string}>>([]);
  const [oppFloats, setOppFloats] = useState<Array<{id:number;text:string;color:string}>>([]);
  const [shake,     setShake]     = useState(false);
  const [tick,      setTick]      = useState(0);
  const [tab,       setTab]       = useState<"info"|"log">("info");

  const shieldActive = !!shieldExp && shieldExp > Date.now();

  useEffect(()=>{ if(shieldExpiresAt) setShieldExp(new Date(shieldExpiresAt).getTime()); },[shieldExpiresAt]);
  useEffect(()=>{ if(shieldHPRemaining!==undefined) setShieldHP(shieldHPRemaining); },[shieldHPRemaining]);
  useEffect(()=>{ const id=setInterval(()=>setTick(t=>t+1),360); return()=>clearInterval(id); },[]);

  useEffect(()=>{
    if(!shieldExp) return;
    const id=setInterval(()=>{
      const r=Math.max(0,shieldExp-Date.now());
      if(r===0){setShieldCD(null);setShieldExp(null);setShieldHP(0);return;}
      setShieldCD(`${Math.floor(r/60000)}:${String(Math.floor((r%60000)/1000)).padStart(2,"0")}`);
    },1000);
    return()=>clearInterval(id);
  },[shieldExp]);

  const log=useCallback((type:string,msg:string)=>{
    setFeed(f=>[{id:Date.now()+Math.random(),type,msg},...f].slice(0,40));
  },[]);

  const addFloat=useCallback((side:"my"|"opp",text:string,color:string)=>{
    const id=Date.now()+Math.random(), item={id,text,color};
    if(side==="my"){setMyFloats(f=>[...f,item]);setTimeout(()=>setMyFloats(f=>f.filter(x=>x.id!==id)),1800);}
    else           {setOppFloats(f=>[...f,item]);setTimeout(()=>setOppFloats(f=>f.filter(x=>x.id!==id)),1800);}
  },[]);

  const doState=useCallback((who:"my"|"opp",s:string,dur=580)=>{
    if(who==="my"){setMyState(s);setTimeout(()=>setMyState("idle"),dur);}
    else          {setOppState(s);setTimeout(()=>setOppState("idle"),dur);}
  },[]);

  const resetRound=useCallback(()=>{
    setTimeout(()=>{setMyHP(CONFIG.startingHP);setOppHP(CONFIG.startingHP);setShieldHP(0);setRound(r=>r+1);},2600);
  },[]);

  // ── MY TEAM SALE → ATTACK ────────────────────────────────────────────────
  const prevMySale=useRef(0);
  useEffect(()=>{
    if(!incomingSaleDollars||incomingSaleDollars===prevMySale.current)return;
    prevMySale.current=incomingSaleDollars;
    const dmg=incomingSaleDollars;
    doState("my","attack",600);
    setTimeout(()=>{
      setOppHP(h=>{
        const next=Math.max(0,h-dmg);
        addFloat("opp",`−${dmg}`,PAL.orange);
        const q=MY.quips[Math.floor(Math.random()*MY.quips.length)];
        addFloat("my",`"${q}"`,PAL.gold2);
        log("attack",`$${dmg} sale — ${MY.name} deals ${dmg} damage!`);
        doState("opp","hit",360);
        setShake(true);setTimeout(()=>setShake(false),300);
        if(next<=0){setMyWins(w=>w+1);log("death",`${OPP.name} defeated! ${MY.name} wins the round!`);resetRound();}
        return next;
      });
    },280);
  },[incomingSaleDollars]);

  // ── OPP SALE → DAMAGE (with shield absorption) ──────────────────────────
  const prevOppSale=useRef(0);
  useEffect(()=>{
    if(!opponentSaleDollars||opponentSaleDollars===prevOppSale.current)return;
    prevOppSale.current=opponentSaleDollars;
    const raw=opponentSaleDollars;
    doState("opp","attack",600);
    setTimeout(()=>{
      log("defend",`${OPP.name} gets a $${raw} sale — incoming!`);
      setShieldHP(sh=>{
        setMyHP(mh=>{
          let absorb=0, hpDmg=raw;
          if(shieldActive&&sh>0){
            absorb=Math.min(sh,raw); hpDmg=raw-absorb;
            if(absorb>0){addFloat("my",`SHIELD −${absorb}`,"#C4A0FF");log("shield",`Shield absorbed ${absorb} damage!`);}
          }
          if(hpDmg>0){doState("my","hit",360);addFloat("my",`−${hpDmg}`,PAL.red);log("defend",`${hpDmg} damage hits ${MY.name}!`);}
          else addFloat("my","FULLY BLOCKED!","#C4A0FF");
          const next=Math.max(0,mh-hpDmg);
          if(next<=0){setOppWins(w=>w+1);log("death",`${MY.name} defeated! ${OPP.name} wins the round!`);resetRound();}
          return next;
        });
        return Math.max(0,sh-Math.min(sh,raw));
      });
    },280);
  },[opponentSaleDollars]);

  // ── FACEBOOK SHARE → SHIELD ──────────────────────────────────────────────
  const prevShare=useRef(false);
  useEffect(()=>{
    if(!shareConfirmed||shareConfirmed===prevShare.current)return;
    prevShare.current=shareConfirmed;
    if(shieldActive){log("shield","Share noted — shield already active.");return;}
    setShieldExp(Date.now()+SHIELD_MS);
    setShieldHP(SHIELD_MAX);
    addFloat("my","SHIELD UP!","#C4A0FF");
    log("shield",`Shield activated! ${CONFIG.shieldDurationMinutes} min, absorbs up to $${SHIELD_MAX}.`);
  },[shareConfirmed]);

  const handleShare=()=>{
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(MY.shareUrl)}&quote=${encodeURIComponent(`Support ${MY.name} in the Jose Madrid Salsa Fundraiser Battle!`)}`,
      "fb","width=600,height=400,menubar=no,toolbar=no"
    );
    // In production your page detects the share callback and sets shareConfirmed=true.
    // The FB JS SDK fires window.fbAsyncInit events you can hook into.
    // For now this directly triggers the shield for demo purposes:
    if(!shieldActive){
      setShieldExp(Date.now()+SHIELD_MS);
      setShieldHP(SHIELD_MAX);
      addFloat("my","SHIELD UP!","#C4A0FF");
      log("shield",`Shield activated! ${CONFIG.shieldDurationMinutes} min, absorbs up to $${SHIELD_MAX}.`);
    } else {
      log("shield","Already shielded — no change.");
    }
  };

  const MascotEl=({team,state,fl,side,sc}:{team:typeof MY;state:string;fl:typeof myFloats;side:"my"|"opp";sc?:number})=>{
    const Sprite=MASCOT_SPRITES[team.mascot]??MASCOT_SPRITES.tornado;
    return (
      <div style={{position:"relative",display:"inline-block"}}>
        {fl.map(f=><Float key={f.id} text={f.text} color={f.color}/>)}
        <div style={{position:"absolute",bottom:-4,left:"8%",width:"84%",height:8,
          background:"rgba(0,0,0,0.45)",borderRadius:"50%",filter:"blur(3px)"}}/>
        <Sprite color={team.color} state={state} tick={tick} shielded={side==="my"&&shieldActive} flipped={side==="opp"} scale={sc??0.95}/>
      </div>
    );
  };

  const FEED_COL: Record<string,string>={attack:PAL.gold2,defend:"#FF7755",shield:"#C4A0FF",death:PAL.red,info:PAL.creamDim};
  const myPct=myHP/CONFIG.startingHP, oppPct=oppHP/CONFIG.startingHP;

  return (
    <div style={{background:PAL.bg,maxWidth:700,margin:"0 auto",fontFamily:BT,overflow:"hidden"}}>
      <style>{`
        @keyframes floatUp{0%{opacity:1;transform:translateX(-50%) translateY(0)}100%{opacity:0;transform:translateX(-50%) translateY(-54px)}}
        @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
        @keyframes glow{0%,100%{color:${PAL.gold}}50%{color:${PAL.gold2}}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.2}}
      `}</style>

      {/* HEADER */}
      <div style={{background:"#080502",borderBottom:`3px solid ${PAL.gold}`,padding:"12px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:9,color:PAL.goldDim,letterSpacing:4}}>JOSE MADRID SALSA</div>
          <div style={{fontSize:20,fontWeight:700,color:PAL.gold2,letterSpacing:3,animation:"glow 2.5s infinite"}}>MASCOT BATTLE</div>
          <div style={{fontSize:9,color:PAL.creamDim,letterSpacing:2,marginTop:1}}>FUNDRAISER SHOWDOWN</div>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:9,color:PAL.creamDim,letterSpacing:2,marginBottom:2}}>ROUND</div>
          <div style={{fontSize:26,fontWeight:700,color:PAL.gold2,lineHeight:1}}>{round}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:9,color:PAL.creamDim,letterSpacing:2,marginBottom:4}}>ROUND WINS</div>
          <div style={{display:"flex",gap:10,alignItems:"center",justifyContent:"flex-end"}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:22,fontWeight:700,color:MY.color}}>{myWins}</div>
              <div style={{fontSize:8,color:MY.color,opacity:0.7,letterSpacing:1}}>US</div>
            </div>
            <div style={{fontSize:13,color:PAL.goldDim}}>—</div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:22,fontWeight:700,color:OPP.color}}>{oppWins}</div>
              <div style={{fontSize:8,color:OPP.color,opacity:0.7,letterSpacing:1}}>THEM</div>
            </div>
          </div>
        </div>
      </div>

      {/* ARENA */}
      <div style={{position:"relative",animation:shake?"shake 0.28s":"none"}}>
        <Arena width={700} height={280}/>
        <div style={{position:"absolute",inset:0,pointerEvents:"none",background:"repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.04) 3px,rgba(0,0,0,0.04) 4px)",zIndex:5}}/>
        <div style={{position:"absolute",bottom:22,left:55,zIndex:8,textAlign:"center"}}>
          <MascotEl team={MY} state={myHP<=0?"dead":myState} fl={myFloats} side="my"/>
          <div style={{fontSize:10,color:MY.color,fontWeight:700,letterSpacing:1,marginTop:4}}>{MY.name}</div>
        </div>
        <div style={{position:"absolute",bottom:22,right:55,zIndex:8,textAlign:"center"}}>
          <MascotEl team={OPP} state={oppHP<=0?"dead":oppState} fl={oppFloats} side="opp"/>
          <div style={{fontSize:10,color:OPP.color,fontWeight:700,letterSpacing:1,marginTop:4}}>{OPP.name}</div>
        </div>
        <div style={{position:"absolute",top:"42%",left:"50%",transform:"translate(-50%,-50%)",zIndex:10,textAlign:"center",pointerEvents:"none"}}>
          <div style={{background:"rgba(8,5,2,0.88)",border:`1px solid ${PAL.goldDim}`,padding:"4px 16px",display:"inline-block"}}>
            <span style={{fontSize:15,color:PAL.gold2,letterSpacing:5,fontWeight:700}}>VS</span>
          </div>
        </div>
      </div>

      {/* HP BARS */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",borderTop:`2px solid ${PAL.goldDim}`,borderBottom:`2px solid ${PAL.goldDim}`}}>
        <div style={{background:PAL.panel,borderRight:`1px solid ${PAL.panelBord}`,padding:"14px 18px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:10,height:10,borderRadius:2,background:MY.color}}/>
              <span style={{fontSize:12,color:MY.color,fontWeight:700,letterSpacing:1}}>{MY.name.split(" ").slice(-1)[0].toUpperCase()}</span>
            </div>
            <span style={{fontSize:11,color:PAL.creamDim}}>{Math.round(myHP)}/{CONFIG.startingHP}</span>
          </div>
          <HPBar cur={myHP} max={CONFIG.startingHP} color={MY.color} shieldCur={shieldHP} shieldMax={shieldActive?SHIELD_MAX:0}/>
          {shieldActive&&<div style={{marginTop:5,fontSize:10,color:"#C4A0FF",animation:"pulse 1s infinite",letterSpacing:1}}>SHIELD {shieldCD} — {Math.round(shieldHP)}/${SHIELD_MAX} remaining</div>}
        </div>
        <div style={{background:PAL.panel,padding:"14px 18px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:10,height:10,borderRadius:2,background:OPP.color}}/>
              <span style={{fontSize:12,color:OPP.color,fontWeight:700,letterSpacing:1}}>{OPP.name.split(" ").slice(-1)[0].toUpperCase()}</span>
            </div>
            <span style={{fontSize:11,color:PAL.creamDim}}>{Math.round(oppHP)}/{CONFIG.startingHP}</span>
          </div>
          <HPBar cur={oppHP} max={CONFIG.startingHP} color={OPP.color}/>
        </div>
      </div>

      {/* SHARE BUTTON */}
      <div style={{borderBottom:`2px solid ${PAL.goldDim}`}}>
        <button onClick={handleShare}
          style={{width:"100%",background:shieldActive?PAL.purple:"#1A1040",border:"none",
            color:shieldActive?"#C4A0FF":"#D4AAFF",fontSize:13,fontFamily:BT,fontWeight:700,
            padding:"14px 0",cursor:"pointer",letterSpacing:2,textTransform:"uppercase"}}>
          {shieldActive
            ? `SHIELD ACTIVE — ${shieldCD} — ${Math.round(shieldHP)}/${SHIELD_MAX} HP LEFT`
            : `SHARE ON FACEBOOK + ACTIVATE ${CONFIG.shieldDurationMinutes}-MIN SHIELD`}
        </button>
      </div>

      {/* TABS */}
      <div style={{background:"#100804"}}>
        <div style={{display:"flex",borderBottom:`1px solid ${PAL.panelBord}`}}>
          {(["info","log"] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              style={{flex:1,background:"none",border:"none",borderBottom:tab===t?`3px solid ${PAL.gold}`:"3px solid transparent",
                color:tab===t?PAL.gold2:PAL.creamDim,padding:"10px 0",fontSize:11,fontFamily:BT,fontWeight:700,cursor:"pointer",letterSpacing:3,textTransform:"uppercase"}}>
              {t==="info"?"MATCHUP":"BATTLE LOG"}
            </button>
          ))}
        </div>
        {tab==="info"&&(
          <div style={{padding:"16px 20px",display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:14,alignItems:"start"}}>
            <div style={{background:PAL.panel,border:`1px solid ${MY.color}44`,borderRadius:4,padding:"12px 14px"}}>
              <div style={{fontSize:11,color:MY.color,fontWeight:700,letterSpacing:1,marginBottom:3}}>{MY.name.toUpperCase()}</div>
              <div style={{fontSize:10,color:PAL.creamDim,marginBottom:10}}>{MY.school}</div>
              <div style={{fontSize:9,color:PAL.goldDim,letterSpacing:1,marginBottom:3}}>SHIELD</div>
              <div style={{fontSize:10,color:PAL.cream,lineHeight:1.6,marginBottom:10}}>Share on Facebook for a {CONFIG.shieldDurationMinutes}-min shield absorbing up to ${SHIELD_MAX}.</div>
              <div style={{fontSize:9,color:PAL.goldDim,letterSpacing:1,marginBottom:3}}>GOAL</div>
              <div style={{fontSize:16,fontWeight:700,color:MY.color}}>${MY.goal.toLocaleString()}</div>
            </div>
            <div style={{textAlign:"center",paddingTop:12}}>
              <div style={{fontSize:9,color:PAL.goldDim,letterSpacing:2,marginBottom:6}}>DAMAGE</div>
              <div style={{fontSize:10,color:PAL.cream,lineHeight:1.8}}>$1 sale<br/>= 1 HP</div>
              <div style={{height:30,borderLeft:`1px solid ${PAL.goldDim}`,margin:"8px auto",width:1}}/>
              <div style={{fontSize:9,color:PAL.goldDim,letterSpacing:2}}>RULES</div>
            </div>
            <div style={{background:PAL.panel,border:`1px solid ${OPP.color}44`,borderRadius:4,padding:"12px 14px"}}>
              <div style={{fontSize:11,color:OPP.color,fontWeight:700,letterSpacing:1,marginBottom:3}}>{OPP.name.toUpperCase()}</div>
              <div style={{fontSize:10,color:PAL.creamDim,marginBottom:10}}>{OPP.school}</div>
              <div style={{fontSize:9,color:PAL.goldDim,letterSpacing:1,marginBottom:3}}>ATTACK</div>
              <div style={{fontSize:10,color:PAL.cream,lineHeight:1.6,marginBottom:10}}>Every sale on their page deals exact dollar-for-dollar damage.</div>
              <div style={{fontSize:9,color:PAL.goldDim,letterSpacing:1,marginBottom:3}}>GOAL</div>
              <div style={{fontSize:16,fontWeight:700,color:OPP.color}}>${OPP.goal.toLocaleString()}</div>
            </div>
          </div>
        )}
        {tab==="log"&&(
          <div style={{padding:"10px 16px",maxHeight:200,overflowY:"auto"}}>
            {feed.length===0&&<div style={{fontSize:11,color:PAL.creamDim,padding:"8px 0"}}>No events yet — waiting for sales...</div>}
            {feed.map(item=>(
              <div key={item.id} style={{display:"flex",gap:8,alignItems:"flex-start",padding:"5px 0",borderBottom:`1px solid ${PAL.panelBord}`}}>
                <div style={{width:3,flexShrink:0,alignSelf:"stretch",background:FEED_COL[item.type]??PAL.creamDim,borderRadius:2,marginTop:2}}/>
                <div style={{fontSize:11,color:FEED_COL[item.type]??PAL.creamDim,lineHeight:1.5,fontWeight:item.type==="death"||item.type==="attack"?700:400}}>{item.msg}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div style={{background:"#080502",borderTop:`1px solid ${PAL.goldDim}`,padding:"7px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:9,color:PAL.goldDim,letterSpacing:3}}>JOSEMADRIDSALSA.COM</span>
        <a href="#" onClick={e=>{e.preventDefault();handleShare();}}
          style={{fontSize:9,color:"#5A8FE0",textDecoration:"none",border:"1px solid #5A8FE044",borderRadius:2,padding:"3px 10px",letterSpacing:2}}>
          f SHARE
        </a>
      </div>
    </div>
  );
}
