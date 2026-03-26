"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { FundraiserTeam, BattleState, CharacterState } from "@/types/fundraiser";

// ─── PALETTE ────────────────────────────────────────────────────────────────
const P = {
  bg0:"#0a0603", bg1:"#140c05", bg2:"#1e1008", bg3:"#2a1509",
  gold:"#C8860A", gold2:"#E8A020", gold3:"#F5C842", goldDim:"#6B4A18", goldDark:"#3D2508",
  brown:"#2A1206", brownMid:"#3D1A08",
  orange:"#C45A10", orangeLight:"#E07030",
  maroon:"#5A0A0A", maroonMid:"#7A1212", maroonLight:"#B02020",
  cream:"#D4A870", creamDim:"#8A6030",
};

const CLASSES: Record<string, { name:string; weapon:string; dmgMod:number; hpMod:number; height:number }> = {
  warrior:  { name:"Warrior",   weapon:"Broadsword",  dmgMod:1.0,  hpMod:1.35, height:1.0  },
  mage:     { name:"Mage",      weapon:"Arcane Staff", dmgMod:1.45, hpMod:0.7,  height:0.88 },
  rogue:    { name:"Rogue",     weapon:"Twin Blades",  dmgMod:1.1,  hpMod:0.9,  height:0.93 },
  archer:   { name:"Archer",    weapon:"Longbow",      dmgMod:1.2,  hpMod:0.85, height:0.95 },
  paladin:  { name:"Paladin",   weapon:"Holy Mace",    dmgMod:0.9,  hpMod:1.25, height:1.05 },
  berserker:{ name:"Berserker", weapon:"War Axe",      dmgMod:1.5,  hpMod:1.1,  height:1.08 },
};

const BASE_HP  = 190;
const BASE_DMG = 30;
const SHIELD_MS = 15 * 60 * 1000;
const CRIT_CHANCE = 0.18;

interface CharDef {
  id: string;
  name: string;
  cls: string;
  gender: "m" | "f";
  skin: string;
  hair: string;
  quips: string[];
}

interface TeamConfig {
  id: string;
  name: string;
  school: string;
  color: string;
  dark: string;
  roster: CharDef[];
  goal: number;
}

export interface BattleArenaProps {
  /** The team that "owns" this profile page — treated as MY team */
  myTeam: TeamConfig;
  /** All other active fundraiser teams this month */
  opponents: TeamConfig[];
  /** Fundraiser profile URL to share on Facebook */
  shareUrl: string;
  /** Called when a real sale event occurs — triggers an attack */
  onSaleReceived?: () => void;
  /** Set to true when a Facebook share is confirmed externally */
  shieldActive?: boolean;
  /** ISO timestamp of shield expiry (from your backend) */
  shieldExpiresAt?: string | null;
}

function getMaxHP(cls: string) {
  return Math.round(BASE_HP * (CLASSES[cls]?.hpMod ?? 1));
}

// ─── CHAIN STRIP ────────────────────────────────────────────────────────────
function ChainStrip({ width = 700 }: { width?: number }) {
  const links = Math.floor(width / 20);
  return (
    <svg width={width} height={16} style={{ display: "block", imageRendering: "pixelated" }}>
      <rect width={width} height={16} fill={P.goldDark} />
      {Array.from({ length: links }).map((_, i) => (
        <g key={i}>
          <ellipse cx={i * 20 + 10} cy={8} rx={7} ry={4} fill="none" stroke={P.gold} strokeWidth="2" />
          <ellipse cx={i * 20 + 10} cy={8} rx={7} ry={4} fill="none" stroke={P.gold3} strokeWidth="0.7" opacity="0.5" />
        </g>
      ))}
      <line x1={0} y1={0}  x2={width} y2={0}  stroke={P.gold3}   strokeWidth="0.5" opacity="0.4" />
      <line x1={0} y1={15} x2={width} y2={15} stroke={P.goldDim} strokeWidth="0.5" />
    </svg>
  );
}

function Corner({ size = 14, flip = false }: { size?: number; flip?: boolean }) {
  const s = size;
  return (
    <svg width={s} height={s} style={{ imageRendering: "pixelated", transform: flip ? "scaleX(-1)" : "none" }}>
      <rect x={0} y={0} width={s} height={s} fill={P.bg1} />
      <line x1={s} y1={0} x2={0} y2={0} stroke={P.gold} strokeWidth="1.5" />
      <line x1={0} y1={0} x2={0} y2={s} stroke={P.gold} strokeWidth="1.5" />
      <rect x={2} y={2} width={s * 0.5} height={2} fill={P.gold3} opacity="0.5" />
      <rect x={2} y={2} width={2} height={s * 0.5} fill={P.gold3} opacity="0.5" />
      <rect x={3} y={3} width={3} height={3} fill={P.gold3} opacity="0.7" />
    </svg>
  );
}

function OrnatePanel({ children, style = {}, color = P.gold }: { children: React.ReactNode; style?: React.CSSProperties; color?: string }) {
  return (
    <div style={{ position: "relative", border: `1.5px solid ${color}`, background: P.bg1, ...style }}>
      <div style={{ position: "absolute", top: -1, left: -1, zIndex: 2 }}><Corner size={12} /></div>
      <div style={{ position: "absolute", top: -1, right: -1, zIndex: 2 }}><Corner size={12} flip /></div>
      {children}
    </div>
  );
}

// ─── HP BAR ─────────────────────────────────────────────────────────────────
function GoldHPBar({ cur, max, color, name, cls, dead }: { cur:number; max:number; color:string; name:string; cls:string; dead:boolean }) {
  const pct = Math.max(0, cur / max);
  const W = 172, H = 12;
  const fill = Math.max(0, Math.round(pct * (W - 4)));
  const barColor = pct < 0.25 ? P.maroonLight : pct < 0.5 ? P.orange : P.gold2;
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
        <span style={{ fontFamily: "'Courier New',monospace", fontSize: 11, color: dead ? "#4A2A0A" : P.cream, letterSpacing: 1, fontWeight: 700, textDecoration: dead ? "line-through" : "none" }}>{name}</span>
        <span style={{ fontFamily: "'Courier New',monospace", fontSize: 10, color: P.goldDim }}>{CLASSES[cls]?.name}</span>
      </div>
      <svg width={W} height={H} style={{ display: "block", imageRendering: "pixelated" }}>
        <rect x={0} y={0} width={W} height={H} rx="1" fill={P.bg0} />
        <rect x={1} y={1} width={W - 2} height={H - 2} rx="0.5" fill="#1A0C04" />
        {fill > 0 && <rect x={2} y={2} width={fill} height={H - 4} rx="0.5" fill={barColor} />}
        {fill > 0 && <rect x={2} y={2} width={fill} height={3} fill={P.gold3} opacity="0.3" />}
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={i} x1={(i + 1) * (W / 10)} y1={2} x2={(i + 1) * (W / 10)} y2={H - 2} stroke={P.bg0} strokeWidth="1" opacity="0.5" />
        ))}
        <rect x={0} y={0} width={W} height={H} rx="1" fill="none" stroke={P.goldDim} strokeWidth="1" />
        <rect x={0} y={0} width={W} height={H} rx="1" fill="none" stroke={P.gold3}   strokeWidth="0.5" opacity="0.3" />
      </svg>
      <div style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: P.creamDim, marginTop: 1 }}>{Math.round(cur)}/{max} HP</div>
    </div>
  );
}

// ─── FLOAT TEXT ──────────────────────────────────────────────────────────────
function FloatText({ text, color }: { text: string; color: string }) {
  return (
    <div style={{ position: "absolute", top: -38, left: "50%", transform: "translateX(-50%)", pointerEvents: "none", animation: "floatUp 1.6s ease-out forwards", whiteSpace: "nowrap", fontFamily: "'Courier New',monospace", fontSize: 13, fontWeight: 700, color, textShadow: `2px 2px 0 ${P.bg0}, -1px -1px 0 ${P.bg0}`, zIndex: 30 }}>
      {text}
    </div>
  );
}

// ─── DUNGEON SCENE ──────────────────────────────────────────────────────────
function DungeonScene({ width, height }: { width: number; height: number }) {
  const stones: React.ReactNode[] = [];
  const cw = 34, rh = 26;
  const rows = Math.ceil(height * 0.7 / rh) + 1, cols = Math.ceil(width / cw) + 1;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const ox = r % 2 === 0 ? 0 : cw / 2;
    const x = c * cw + ox - cw / 2, y = r * rh;
    const v = (r * 7 + c * 13) % 6;
    const fills = ["#1A0E06","#1E1008","#160C04","#1C1006","#201208","#180A04"];
    stones.push(<rect key={`s${r}${c}`} x={x+1} y={y+1} width={cw-2} height={rh-2} rx="2" fill={fills[v]} stroke="#0C0602" strokeWidth="1"/>);
  }
  const floorY = height * 0.7;
  const Torch = ({ x, y }: { x:number; y:number }) => (
    <g>
      <rect x={x-4} y={y+10} width={8} height={12} rx="1" fill="#4A2808"/>
      <rect x={x-2} y={y+4} width={4} height={10} fill="#6B3010"/>
      <ellipse cx={x} cy={y+8} rx={18} ry={10} fill="#C45A10" opacity="0.07"/>
      <polygon points={`${x-4},${y+6} ${x},${y-4} ${x+4},${y+6} ${x+2},${y+3} ${x-2},${y+3}`} fill="#E07030" opacity="0.95"/>
      <polygon points={`${x-2},${y+5} ${x},${y} ${x+2},${y+5} ${x+1},${y+3} ${x-1},${y+3}`} fill="#F5C842" opacity="0.9"/>
    </g>
  );
  const Banner = ({ x, dir }: { x:number; dir:number }) => {
    const bw = 28, bh = 60;
    const px2 = dir === 1 ? x : x - bw;
    return (
      <g>
        <rect x={px2+bw/2-2} y={0} width={4} height={bh+4} fill="#2A1206"/>
        <rect x={px2+2} y={8} width={bw-4} height={bh-8} rx="1" fill={P.maroon} stroke={P.goldDim} strokeWidth="0.5"/>
        <line x1={px2+4} y1={24} x2={px2+bw-4} y2={24} stroke={P.goldDim} strokeWidth="0.5"/>
        <line x1={px2+4} y1={36} x2={px2+bw-4} y2={36} stroke={P.goldDim} strokeWidth="0.5"/>
        <circle cx={px2+bw/2} cy={20} r={4} fill={P.goldDark} stroke={P.goldDim} strokeWidth="0.5"/>
        <rect x={px2+bw/2-1} y={18} width={2} height={4} fill={P.gold3} opacity="0.7"/>
        <rect x={px2+bw/2-2} y={20} width={4} height={2} fill={P.gold3} opacity="0.7"/>
      </g>
    );
  };
  return (
    <svg width={width} height={height} style={{ display: "block", imageRendering: "pixelated" }}>
      <rect width={width} height={height} fill="#0C0804"/>
      {stones}
      {Array.from({ length: Math.ceil(width / 28) + 1 }).map((_, c) => (
        <rect key={`f${c}`} x={c*28} y={floorY} width={26} height={height-floorY+2} rx="1" fill={c%3===0?"#221006":c%3===1?"#1C0E05":"#261208"} stroke="#0C0602" strokeWidth="0.8"/>
      ))}
      <Banner x={56} dir={1}/>
      <Banner x={width-28} dir={-1}/>
      <Torch x={100} y={18}/>
      <Torch x={width-100} y={18}/>
      <Torch x={Math.round(width/2)} y={14}/>
      <rect x={0} y={0} width={80} height={height} fill="#0C0804" opacity="0.4"/>
      <rect x={width-80} y={0} width={80} height={height} fill="#0C0804" opacity="0.4"/>
      <rect x={0} y={height-40} width={width} height={40} fill="#0C0804" opacity="0.5"/>
    </svg>
  );
}

// ─── PIXEL CHARACTER ─────────────────────────────────────────────────────────
function PixelChar({ char, teamColor, animState, flipped, shielded, tick, scale = 1 }: {
  char: CharDef; teamColor: string; animState: string; flipped: boolean; shielded: boolean; tick: number; scale?: number;
}) {
  const dead = animState === "dead";
  const atk  = animState === "attack";
  const hit  = animState === "hit";
  const bobY = (!dead && !atk) ? Math.sin(tick * 0.6) * 2 : 0;
  const W = Math.round(52 * scale), H = Math.round(82 * scale);
  const p = (v: number) => Math.round(v * scale);
  const tc = teamColor;

  return (
    <svg width={W} height={H + 8} viewBox={`0 0 ${W} ${H + 8}`}
      style={{ imageRendering: "pixelated", transform: `scaleX(${flipped ? -1 : 1}) translateY(${bobY}px)`, filter: hit ? "brightness(2.5) saturate(0)" : "none", transition: "filter 0.06s, transform 0.08s", display: "block" }}>
      {shielded && <>
        <ellipse cx={W/2} cy={(H+8)/2} rx={W/2-2} ry={(H+8)/2-2} fill={teamColor} opacity="0.1"/>
        <ellipse cx={W/2} cy={(H+8)/2} rx={W/2-2} ry={(H+8)/2-2} fill="none" stroke={teamColor} strokeWidth="1.5" strokeDasharray="4 3"/>
      </>}
      {dead ? (
        <g transform={`translate(4, ${H-8})`}>
          <rect x={0} y={0} width={W-10} height={10} rx="2" fill={tc} opacity="0.4"/>
          <circle cx={8} cy={5} r={4} fill={tc} opacity="0.6"/>
        </g>
      ) : (
        <g>
          {/* Head */}
          <circle cx={p(18)} cy={p(8)} r={p(7)} fill={char.skin}/>
          <rect x={p(10)} y={p(2)} width={p(16)} height={p(10)} rx="3" fill={char.hair} opacity="0.9"/>
          <rect x={p(11)} y={p(6)} width={p(4)} height={p(4)} rx="0.5" fill="#0A0400"/>
          <rect x={p(21)} y={p(6)} width={p(4)} height={p(4)} rx="0.5" fill="#0A0400"/>
          <rect x={p(12)} y={p(12)} width={p(12)} height={p(2)} rx="0.5" fill="#0A0400" opacity="0.5"/>
          {/* Body */}
          <rect x={p(7)} y={p(15)} width={p(22)} height={p(18)} rx="2" fill={tc}/>
          <rect x={p(9)} y={p(17)} width={p(18)} height={p(10)} rx="1" fill={tc} opacity="0.4"/>
          {/* Arms */}
          <rect x={p(0)} y={p(16)} width={p(8)} height={p(14)} rx="2" fill={tc} opacity="0.85"/>
          <rect x={p(29)} y={p(16)} width={p(8)} height={p(14)} rx="2" fill={tc} opacity="0.85"/>
          {/* Legs */}
          <rect x={p(9)}  y={p(33)} width={p(8)}  height={p(18)} rx="2" fill={tc}/>
          <rect x={p(20)} y={p(33)} width={p(8)}  height={p(18)} rx="2" fill={tc}/>
          {/* Boots */}
          <rect x={p(8)}  y={p(46)} width={p(10)} height={p(5)} rx="1" fill={char.hair} opacity="0.6"/>
          <rect x={p(19)} y={p(46)} width={p(10)} height={p(5)} rx="1" fill={char.hair} opacity="0.6"/>
          {/* Weapon */}
          {atk && char.cls === "mage" && <circle cx={p(42)} cy={p(10)} r={p(6)} fill="#9B7FFF" opacity="0.8"/>}
          {atk && char.cls !== "mage" && <rect x={p(36)} y={p(12)} width={p(3)} height={p(18)} rx="1" fill="#C8C0A0"/>}
          {!atk && <rect x={p(37)} y={p(15)} width={p(2.5)} height={p(16)} rx="1" fill="#909090" opacity="0.8"/>}
        </g>
      )}
    </svg>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function BattleArena({
  myTeam,
  opponents,
  shareUrl,
  onSaleReceived,
  shieldActive = false,
  shieldExpiresAt = null,
}: BattleArenaProps) {
  const allTeams = [myTeam, ...opponents];

  const [charHP, setCharHP] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    allTeams.forEach(t => t.roster.forEach(c => { m[c.id] = getMaxHP(c.cls); }));
    return m;
  });

  const maxHPRef = useRef<Record<string, number>>({});
  if (Object.keys(maxHPRef.current).length === 0) {
    allTeams.forEach(t => t.roster.forEach(c => { maxHPRef.current[c.id] = getMaxHP(c.cls); }));
  }

  const [oppIdx, setOppIdx]         = useState(0);
  const [shieldExpiry, setShieldExpiry] = useState<number | null>(
    shieldExpiresAt ? new Date(shieldExpiresAt).getTime() : null
  );
  const [shieldCD, setShieldCD]     = useState<string | null>(null);
  const [scores, setScores]         = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    allTeams.forEach(t => { m[t.id] = 0; });
    return m;
  });
  const [feed, setFeed]             = useState<Array<{ type:string; msg:string; id:number }>>([]);
  const [charStates, setCharStates] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    allTeams.forEach(t => t.roster.forEach(c => { m[c.id] = "idle"; }));
    return m;
  });
  const [floats, setFloats]         = useState<Array<{ id:number; charId:string; text:string; color:string }>>([]);
  const [shake, setShake]           = useState(false);
  const [tick, setTick]             = useState(0);
  const [clickCounts, setClickCounts] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab]   = useState("party");

  const currentOpp = opponents[oppIdx % opponents.length];
  const isShielded = !!shieldExpiry && shieldExpiry > Date.now();
  const myRoster   = myTeam.roster;
  const oppRoster  = currentOpp.roster;

  const frontline = useCallback(
    (roster: CharDef[]) => roster.find(c => charHP[c.id] > 0) ?? null,
    [charHP]
  );

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 350);
    return () => clearInterval(id);
  }, []);

  // Sync external shield prop
  useEffect(() => {
    if (shieldActive && !isShielded) {
      setShieldExpiry(Date.now() + SHIELD_MS);
    }
  }, [shieldActive]);

  useEffect(() => {
    if (shieldExpiresAt) {
      setShieldExpiry(new Date(shieldExpiresAt).getTime());
    }
  }, [shieldExpiresAt]);

  const log = useCallback((type: string, msg: string) => {
    setFeed(f => [{ type, msg, id: Date.now() + Math.random() }, ...f].slice(0, 25));
  }, []);

  const addFloat = useCallback((charId: string, text: string, color: string) => {
    const id = Date.now() + Math.random();
    setFloats(f => [...f, { id, charId, text, color }]);
    setTimeout(() => setFloats(f => f.filter(x => x.id !== id)), 1700);
  }, []);

  const setCharState = useCallback((id: string, state: string, dur = 500) => {
    setCharStates(s => ({ ...s, [id]: state }));
    setTimeout(() => setCharStates(s => ({ ...s, [id]: (charHP[id] ?? 1) <= 0 ? "dead" : "idle" })), dur);
  }, [charHP]);

  const doDamage = useCallback((targetId: string, rawDmg: number, srcTeamId: string) => {
    const myIds = myRoster.map(c => c.id);
    if (myIds.includes(targetId) && isShielded) {
      addFloat(targetId, "BLOCKED!", "#9B7FFF");
      return null;
    }
    const isCrit = Math.random() < CRIT_CHANCE;
    const dmg = Math.round(rawDmg * (isCrit ? 1.8 : 1));
    setCharHP(h => ({ ...h, [targetId]: Math.max(0, h[targetId] - dmg) }));
    setScores(s => ({ ...s, [srcTeamId]: (s[srcTeamId] || 0) + (isCrit ? 20 : 10) }));
    addFloat(targetId, isCrit ? `CRIT! -${dmg}` : `-${dmg}`, isCrit ? "#FF5522" : "#E07030");
    return { dmg, isCrit };
  }, [isShielded, addFloat, myRoster]);

  const doAttack = useCallback((srcTeamId: string, tgtTeamId: string) => {
    const srcT = allTeams.find(t => t.id === srcTeamId);
    const tgtT = allTeams.find(t => t.id === tgtTeamId);
    if (!srcT || !tgtT) return;
    const attacker = frontline(srcT.roster);
    const defender = frontline(tgtT.roster);
    if (!attacker || !defender) return;
    const dmgBase = Math.round(BASE_DMG * (CLASSES[attacker.cls]?.dmgMod ?? 1));
    setCharState(attacker.id, "attack", 600);
    setTimeout(() => {
      const res = doDamage(defender.id, dmgBase, srcTeamId);
      if (!res) return;
      setCharState(defender.id, "hit", 350);
      if ((charHP[defender.id] || 0) - res.dmg <= 0) {
        setTimeout(() => setCharState(defender.id, "dead", 99999), 400);
        log("death", `${defender.name} has fallen!`);
        if (tgtTeamId === myTeam.id) setTimeout(() => setOppIdx(i => i + 1), 1200);
      }
      if (srcTeamId === myTeam.id) {
        const q = attacker.quips[Math.floor(Math.random() * attacker.quips.length)];
        addFloat(attacker.id, `"${q}"`, P.gold3);
        log("attack", `${attacker.name} strikes! ${res.isCrit ? "CRITICAL — " : ""}${res.dmg} dmg to ${defender.name}!`);
        setShake(true); setTimeout(() => setShake(false), 300);
      } else if (tgtTeamId === myTeam.id && !isShielded) {
        log("defend", `${attacker.name} hits ${defender.name} for ${res.dmg}${res.isCrit ? " CRIT" : ""}!`);
      }
    }, 280);
  }, [charHP, doDamage, setCharState, log, addFloat, frontline, isShielded, myTeam, allTeams]);

  // AI simulation ticks for opponent teams
  useEffect(() => {
    const id = setInterval(() => {
      const alive = allTeams.filter(t => t.roster.some(c => charHP[c.id] > 0));
      if (alive.length < 2) return;
      const src = alive[Math.floor(Math.random() * alive.length)];
      const tgts = alive.filter(t => t.id !== src.id);
      const tgt = tgts[Math.floor(Math.random() * tgts.length)];
      if (src.id !== myTeam.id) log("event", `${src.name} scores a sale!`);
      doAttack(src.id, tgt.id);
    }, 3800);
    return () => clearInterval(id);
  }, [charHP, doAttack, log, myTeam]);

  // Shield countdown
  useEffect(() => {
    if (!shieldExpiry) return;
    const id = setInterval(() => {
      const r = Math.max(0, shieldExpiry - Date.now());
      if (r === 0) { setShieldCD(null); setShieldExpiry(null); return; }
      const m = Math.floor(r / 60000), s = Math.floor((r % 60000) / 1000);
      setShieldCD(`${m}:${String(s).padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(id);
  }, [shieldExpiry]);

  const handleSale = () => {
    doAttack(myTeam.id, currentOpp.id);
    log("sale", "Sale received! Front-liner charges!");
    onSaleReceived?.();
  };

  const handleShare = () => {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent("Support our team in the Jose Madrid Salsa Fundraiser Battle!")}`;
    window.open(fbUrl, "fb", "width=600,height=400,menubar=no,toolbar=no");
    if (!isShielded) {
      setShieldExpiry(Date.now() + SHIELD_MS);
      const f = myRoster.find(c => charHP[c.id] > 0);
      if (f) addFloat(f.id, "SHIELD UP!", "#C4A0FF");
      log("shield", "Community SHIELD activated — 15 minutes of protection!");
    } else {
      log("shield", "Already shielded. Share noted.");
    }
  };

  const handleClickChar = (char: CharDef) => {
    if (charHP[char.id] <= 0) return;
    const next = (clickCounts[char.id] || 0) + 1;
    setClickCounts(c => ({ ...c, [char.id]: next }));
    if (next % 5 === 0) {
      const q = char.quips[Math.floor(Math.random() * char.quips.length)];
      addFloat(char.id, `"${q}"`, P.gold3);
      log("click", `${char.name}: "${q}"`);
    }
    setCharState(char.id, "attack", 300);
  };

  const sorted = [...allTeams].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));
  const BT = "'Courier New',monospace";

  return (
    <div style={{ background: P.bg0, fontFamily: BT, maxWidth: 700, margin: "0 auto", overflow: "hidden" }}>
      <style>{`
        @keyframes floatUp{0%{opacity:1;transform:translateX(-50%) translateY(0)}100%{opacity:0;transform:translateX(-50%) translateY(-46px)}}
        @keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-5px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}
        @keyframes goldGlow{0%,100%{color:${P.gold2}}50%{color:${P.gold3}}}
        @keyframes shieldPulse{0%,100%{opacity:1}50%{opacity:0.3}}
      `}</style>

      {/* HEADER */}
      <div style={{ background: P.brown, borderBottom: `3px solid ${P.gold}`, padding: "10px 16px 8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 10, color: P.goldDim, letterSpacing: 4, marginBottom: 2 }}>JOSE MADRID SALSA</div>
            <div style={{ fontSize: 20, color: P.gold3, letterSpacing: 3, fontWeight: 700, animation: "goldGlow 2.5s infinite" }}>BATTLE ARENA</div>
            <div style={{ fontSize: 10, color: P.creamDim, letterSpacing: 2, marginTop: 2 }}>FUNDRAISER DUNGEON</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: P.goldDim, letterSpacing: 2 }}>{myTeam.school.toUpperCase()}</div>
            <div style={{ fontSize: 12, color: myTeam.color, fontWeight: 700, letterSpacing: 1 }}>{myTeam.name.toUpperCase()}</div>
          </div>
        </div>
      </div>
      <ChainStrip width={700}/>

      {/* BATTLE STAGE */}
      <div style={{ position: "relative", animation: shake ? "shake 0.3s" : "none" }}>
        <DungeonScene width={700} height={240}/>
        <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.05) 3px,rgba(0,0,0,0.05) 4px)", pointerEvents: "none", zIndex: 15 }}/>

        {/* LEFT HP PANEL */}
        <div style={{ position: "absolute", top: 10, left: 10, zIndex: 12, width: 188 }}>
          <OrnatePanel>
            <div style={{ padding: "8px 10px" }}>
              <div style={{ fontSize: 11, color: myTeam.color, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>{myTeam.name.toUpperCase()}</div>
              {myRoster.map(c => <GoldHPBar key={c.id} cur={charHP[c.id]} max={maxHPRef.current[c.id]} color={myTeam.color} name={c.name} cls={c.cls} dead={charHP[c.id] <= 0}/>)}
              {isShielded && <div style={{ fontSize: 10, color: "#C4A0FF", animation: "shieldPulse 1s infinite", letterSpacing: 1, marginTop: 2, fontWeight: 700 }}>SHIELD {shieldCD}</div>}
            </div>
          </OrnatePanel>
        </div>

        {/* RIGHT HP PANEL */}
        <div style={{ position: "absolute", top: 10, right: 10, zIndex: 12, width: 188 }}>
          <OrnatePanel>
            <div style={{ padding: "8px 10px" }}>
              <div style={{ fontSize: 11, color: currentOpp.color, letterSpacing: 2, fontWeight: 700, marginBottom: 6, textAlign: "right" }}>{currentOpp.name.toUpperCase()}</div>
              {oppRoster.map(c => <GoldHPBar key={c.id} cur={charHP[c.id]} max={maxHPRef.current[c.id]} color={currentOpp.color} name={c.name} cls={c.cls} dead={charHP[c.id] <= 0}/>)}
            </div>
          </OrnatePanel>
        </div>

        {/* MY PARTY */}
        <div style={{ position: "absolute", bottom: 14, left: 16, display: "flex", gap: 6, alignItems: "flex-end", zIndex: 8 }}>
          {myRoster.map((char, i) => {
            const dead = charHP[char.id] <= 0;
            const myFloats = floats.filter(f => f.charId === char.id);
            const sc = i === 0 ? 1 : i === 1 ? 0.82 : 0.68;
            return (
              <div key={char.id} onClick={() => handleClickChar(char)}
                style={{ position: "relative", cursor: dead ? "default" : "pointer", opacity: dead ? 0.3 : 1, transform: `translateY(${i === 0 ? 0 : i === 1 ? 10 : 18}px)` }}>
                {myFloats.map(f => <FloatText key={f.id} text={f.text} color={f.color}/>)}
                <div style={{ position: "absolute", bottom: -4, left: "10%", width: "80%", height: 4, background: P.bg0, opacity: 0.5, borderRadius: "50%" }}/>
                <PixelChar char={char} teamColor={myTeam.color} animState={dead ? "dead" : charStates[char.id]} flipped={false} shielded={isShielded && i === 0 && !dead} tick={tick + i * 4} scale={sc}/>
                {i === 0 && !dead && <div style={{ textAlign: "center", fontSize: 9, color: P.gold, letterSpacing: 1, marginTop: 1, fontWeight: 700 }}>FRONT</div>}
              </div>
            );
          })}
        </div>

        {/* OPP PARTY */}
        <div style={{ position: "absolute", bottom: 14, right: 16, display: "flex", gap: 6, alignItems: "flex-end", flexDirection: "row-reverse", zIndex: 8 }}>
          {oppRoster.map((char, i) => {
            const dead = charHP[char.id] <= 0;
            const myFloats = floats.filter(f => f.charId === char.id);
            const sc = i === 0 ? 1 : i === 1 ? 0.82 : 0.68;
            return (
              <div key={char.id} style={{ position: "relative", opacity: dead ? 0.25 : 1, transform: `translateY(${i === 0 ? 0 : i === 1 ? 10 : 18}px)` }}>
                {myFloats.map(f => <FloatText key={f.id} text={f.text} color={f.color}/>)}
                <div style={{ position: "absolute", bottom: -4, left: "10%", width: "80%", height: 4, background: P.bg0, opacity: 0.5, borderRadius: "50%" }}/>
                <PixelChar char={char} teamColor={currentOpp.color} animState={dead ? "dead" : charStates[char.id]} flipped={true} shielded={false} tick={tick + i * 4 + 6} scale={sc}/>
                {i === 0 && !dead && <div style={{ textAlign: "center", fontSize: 9, color: currentOpp.color, letterSpacing: 1, marginTop: 1, fontWeight: 700 }}>FRONT</div>}
              </div>
            );
          })}
        </div>

        {/* VS */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 14, textAlign: "center", pointerEvents: "none" }}>
          <div style={{ background: P.bg0, border: `2px solid ${P.gold}`, padding: "6px 14px", display: "inline-block" }}>
            <div style={{ fontSize: 26, color: P.gold3, letterSpacing: 6, fontWeight: 700, animation: "goldGlow 2s infinite", lineHeight: 1 }}>VS</div>
            <div style={{ fontSize: 8, color: P.goldDim, letterSpacing: 3, marginTop: 2 }}>DUNGEON BATTLE</div>
          </div>
        </div>
      </div>

      <ChainStrip width={700}/>

      {/* BUTTONS */}
      <div style={{ background: P.bg1, padding: "10px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <button onClick={handleSale} style={{ background: P.brown, border: `2px solid ${P.gold}`, color: P.gold3, padding: "11px 0", fontSize: 13, fontFamily: BT, fontWeight: 700, cursor: "pointer", letterSpacing: 2, textTransform: "uppercase" }}>
          SALE RECEIVED
        </button>
        <button onClick={handleShare} style={{ background: P.brown, border: `2px solid ${isShielded ? P.goldDim : "#9B7FFF"}`, color: isShielded ? P.creamDim : "#D4AAFF", padding: "11px 0", fontSize: 13, fontFamily: BT, fontWeight: 700, cursor: "pointer", letterSpacing: 2, textTransform: "uppercase" }}>
          {isShielded ? "SHIELDED" : "SHARE + SHIELD"}
        </button>
      </div>

      <ChainStrip width={700}/>

      {/* TABS */}
      <div style={{ background: P.bg1 }}>
        <div style={{ display: "flex", borderBottom: `2px solid ${P.goldDark}` }}>
          {(["party","roster","board","log"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ flex: 1, background: activeTab === tab ? P.bg2 : "transparent", border: "none", borderBottom: activeTab === tab ? `3px solid ${P.gold}` : "3px solid transparent", color: activeTab === tab ? P.gold3 : P.creamDim, padding: "9px 0", fontSize: 10, fontFamily: BT, fontWeight: 700, cursor: "pointer", letterSpacing: 2, textTransform: "uppercase" }}>
              {tab === "party" ? "MY PARTY" : tab === "roster" ? "ALL UNITS" : tab === "board" ? "RANKINGS" : "BATTLE LOG"}
            </button>
          ))}
        </div>

        {activeTab === "party" && (
          <div style={{ padding: "12px 14px", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {myRoster.map((char, i) => {
              const cls = CLASSES[char.cls];
              const dead = charHP[char.id] <= 0;
              const pct = charHP[char.id] / maxHPRef.current[char.id];
              return (
                <div key={char.id} onClick={() => handleClickChar(char)}
                  style={{ background: P.bg2, border: `1.5px solid ${dead ? P.goldDark : P.goldDim}`, padding: "10px", cursor: dead ? "default" : "pointer", opacity: dead ? 0.45 : 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                    <div style={{ width: 7, height: 7, background: dead ? P.goldDim : cls?.name === "Mage" ? "#A78BFA" : myTeam.color }}/>
                    <span style={{ fontSize: 12, color: P.cream, fontWeight: 700, letterSpacing: 1 }}>{char.name}</span>
                    <span style={{ fontSize: 10, color: P.goldDim, marginLeft: "auto" }}>{char.gender === "f" ? "F" : "M"}</span>
                  </div>
                  <div style={{ fontSize: 9, color: myTeam.color, marginBottom: 3, letterSpacing: 1 }}>{cls?.name} | {cls?.weapon}</div>
                  <div style={{ height: 4, background: P.bg0, overflow: "hidden", marginBottom: 5, border: `0.5px solid ${P.goldDim}` }}>
                    <div style={{ width: `${pct * 100}%`, height: "100%", background: pct < 0.3 ? P.maroonLight : P.gold2, transition: "width 0.3s" }}/>
                  </div>
                  <div style={{ fontSize: 9, color: P.creamDim }}>{charHP[char.id]}/{maxHPRef.current[char.id]} HP</div>
                  <div style={{ fontSize: 8, color: P.goldDim, marginTop: 4, fontStyle: "italic", lineHeight: 1.4 }}>"{char.quips[0]}"</div>
                  {i === 0 && !dead && <div style={{ fontSize: 8, color: P.gold, marginTop: 4, letterSpacing: 1, fontWeight: 700 }}>FRONTLINE</div>}
                  {dead && <div style={{ fontSize: 8, color: P.maroonLight, marginTop: 3, letterSpacing: 1 }}>FALLEN</div>}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "roster" && (
          <div style={{ padding: "12px 14px", maxHeight: 220, overflowY: "auto" }}>
            {allTeams.map(team => (
              <div key={team.id} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ height: 1, flex: 1, background: P.goldDark }}/>
                  <span style={{ fontSize: 11, color: team.color, letterSpacing: 2, fontWeight: 700 }}>{team.name.toUpperCase()}</span>
                  <div style={{ height: 1, flex: 1, background: P.goldDark }}/>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                  {team.roster.map(char => {
                    const cls = CLASSES[char.cls];
                    const dead = charHP[char.id] <= 0;
                    return (
                      <div key={char.id} style={{ background: P.bg2, border: `0.5px solid ${P.goldDark}`, padding: "7px 8px", opacity: dead ? 0.3 : 1 }}>
                        <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 2 }}>
                          <div style={{ width: 5, height: 5, background: team.color }}/>
                          <span style={{ fontSize: 10, color: P.cream, fontWeight: 700 }}>{char.name}</span>
                          <span style={{ fontSize: 9, color: P.goldDim, marginLeft: "auto" }}>{char.gender === "f" ? "F" : "M"}</span>
                        </div>
                        <div style={{ fontSize: 8, color: team.color, letterSpacing: 1 }}>{cls?.name}</div>
                        <div style={{ fontSize: 8, color: P.creamDim }}>{cls?.weapon}</div>
                        {dead && <div style={{ fontSize: 8, color: P.maroonLight, marginTop: 2, letterSpacing: 1 }}>FALLEN</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "board" && (
          <div style={{ padding: "12px 14px" }}>
            {sorted.map((t, i) => {
              const alive = t.roster.some(c => charHP[c.id] > 0);
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: t.id === myTeam.id ? P.bg2 : "transparent", marginBottom: 4, border: t.id === myTeam.id ? `1px solid ${P.goldDim}` : "1px solid transparent" }}>
                  <span style={{ fontSize: 13, color: P.goldDim, width: 22, fontWeight: 700 }}>#{i + 1}</span>
                  <div style={{ width: 9, height: 9, background: alive ? t.color : P.goldDim }}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: alive ? P.cream : P.creamDim, fontWeight: t.id === myTeam.id ? 700 : 400, letterSpacing: 1 }}>{t.name}</div>
                    <div style={{ fontSize: 9, color: P.goldDim }}>{t.school}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, color: t.id === myTeam.id ? P.gold3 : P.creamDim, fontWeight: 700 }}>{scores[t.id] || 0} pts</div>
                    {!alive && <div style={{ fontSize: 9, color: P.maroonLight }}>WIPED</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "log" && (
          <div style={{ padding: "12px 14px", maxHeight: 190, overflowY: "auto" }}>
            {feed.length === 0 && <div style={{ fontSize: 11, color: P.goldDim }}>Awaiting battle events...</div>}
            {feed.map(item => {
              const col = item.type === "shield" ? "#C4A0FF" : item.type === "sale" || item.type === "attack" ? P.gold3 : item.type === "defend" ? P.orangeLight : item.type === "death" ? P.maroonLight : item.type === "click" ? P.gold2 : P.creamDim;
              return (
                <div key={item.id} style={{ fontSize: 11, color: col, marginBottom: 5, lineHeight: 1.6, borderLeft: `2px solid ${col}55`, paddingLeft: 7, fontWeight: item.type === "death" || item.type === "attack" ? 700 : 400 }}>
                  {item.msg}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ChainStrip width={700}/>

      {/* FOOTER */}
      <div style={{ background: P.bg0, padding: "7px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 9, color: P.goldDark, letterSpacing: 3 }}>JOSEMADRIDSALSA.COM</div>
        <a href={shareUrl}
          onClick={e => { e.preventDefault(); window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, "fb", "width=600,height=400,menubar=no,toolbar=no"); }}
          style={{ fontSize: 9, color: "#6090E0", textDecoration: "none", border: "1px solid #6090E044", padding: "3px 10px", letterSpacing: 2 }}>
          f SHARE THIS PAGE
        </a>
      </div>
    </div>
  );
}
