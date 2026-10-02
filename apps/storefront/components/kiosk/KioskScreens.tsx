'use client'

import type { CSSProperties, ReactNode } from 'react'
import type { KioskFlavor } from '@/lib/kiosk/catalog'
import { dealLabel, formatCents, type KioskQuote } from '@/lib/kiosk/pricing'
import { DONE_RESET_SECONDS, FILTERS, FIRE_JARS, HEAT, PRICE_ROWS, matchesFilter, rnd, type KioskFilter } from './kiosk-data'

const LOGO = '/images/kiosk/logo.webp'

export interface CartLine {
  flavor: KioskFlavor
  qty: number
}

/* ---------- shared bits ---------- */

const CHILI_PATH =
  'M14 4c0 1.6 1 2.6 2.6 2.6-.8.8-1 1.8-1 2.6 0 6-4.6 11.8-11.1 11.8 2.8-2.8 4.6-6.6 4.6-10.6 0-3 2-5.2 4.9-5.2z'

function HeatPips({ heat, size }: { heat: KioskFlavor['heat']; size: number }) {
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      {[1, 2, 3, 4].map((i) => {
        const on = i <= HEAT[heat].n
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={on ? '#D62828' : 'none'} stroke={on ? '#8E1414' : '#CDB89A'} strokeWidth="1.6" strokeLinejoin="round">
            <path d={CHILI_PATH} />
            <path d="M14 4c.4-1.2 1.4-2 2.6-2" fill="none" />
          </svg>
        )
      })}
    </span>
  )
}

function Stepper({ qty, onDec, onInc, name, size, dark }: { qty: number; onDec: () => void; onInc: () => void; name: string; size: number; dark?: boolean }) {
  const ring = dark ? 'border-[#FFF3E0] text-[#FFF3E0]' : 'border-[#24130A] text-[#24130A]'
  const solid = dark ? 'bg-[#FFF3E0] text-[#0E4D3A]' : 'bg-[#24130A] text-[#FFF3E0]'
  const box = { width: size, height: size }
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={onDec} aria-label={`Remove one ${name}`} style={box} className={`flex items-center justify-center rounded-full border-[3px] bg-transparent ${ring}`}>
        <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 12h14" /></svg>
      </button>
      <span className="k-slab min-w-[40px] text-center" style={{ fontSize: size * 0.5 }}>{qty}</span>
      <button type="button" onClick={onInc} aria-label={`Add one ${name}`} style={box} className={`flex items-center justify-center rounded-full ${solid}`}>
        <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      </button>
    </div>
  )
}

function JarThumb({ flavor, w, h, imgH, radius }: { flavor: KioskFlavor; w: number; h: number; imgH: number; radius: number }) {
  return (
    <div className="flex shrink-0 items-end justify-center overflow-hidden" style={{ width: w, height: h, borderRadius: radius, background: flavor.tint }}>
      <img src={flavor.image} alt="" style={{ height: imgH }} className="block w-auto" />
    </div>
  )
}

function CtaPill({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`k-slab relative flex h-[112px] items-center gap-[18px] rounded-full bg-[#F4A81D] px-[58px] text-[44px] text-[#24130A] shadow-[0_10px_0_#B5740A,0_0_60px_rgba(255,140,30,.5)] ${className}`}>
      <span className="k-ring" />
      <span className="k-ring k-ring-2" />
      {children}
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
    </span>
  )
}

/* ---------- splash ---------- */

export function SplashScreen({ portrait, flavorCount, jars, onStart, notice }: { portrait: boolean; flavorCount: number; jars: readonly KioskFlavor[]; onStart: () => void; notice: string | null }) {
  const vid = portrait ? { w: 1300, h: 731, top: 500 } : { w: 1240, h: 698, top: -10 }
  const fireH = portrait ? 560 : 420
  const fireJars = FIRE_JARS.map((k) => jars.find((j) => j.key === k)).filter((j): j is KioskFlavor => !!j).slice(0, portrait ? 5 : 9)
  const mid = (fireJars.length - 1) / 2
  const flameCount = portrait ? 13 : 19

  return (
    <button type="button" onClick={onStart} aria-label="Touch anywhere to start an order" className="relative h-full w-full overflow-hidden border-0 bg-[#0B0605] p-0 text-left text-[#FFF3E0]">
      <div className="k-video-mask absolute left-1/2" style={{ top: vid.top, width: vid.w, height: vid.h, marginLeft: -vid.w / 2 }}>
        <video src="/videos/kiosk/fuego-loop.mp4" autoPlay muted loop playsInline aria-hidden="true" className="block h-full w-full object-cover" />
      </div>
      <div className="k-glow absolute left-1/2 bottom-[-260px] ml-[-1200px] h-[760px] w-[2400px] rounded-full bg-[radial-gradient(ellipse_at_50%_50%,rgba(255,122,24,.55)_0%,rgba(214,40,40,.35)_35%,transparent_70%)]" />

      {Array.from({ length: 8 }, (_, i) => (
        <svg key={`chili-${i}`} className="k-chili absolute bottom-[-120px] opacity-0" width={56 + Math.round(rnd(i + 320) * 60)} height={56 + Math.round(rnd(i + 320) * 60)} viewBox="0 0 64 64" aria-hidden="true"
          style={{ left: `${[6, 18, 30, 44, 58, 70, 82, 93][i]}%`, animationDuration: `${(14 + rnd(i + 340) * 10).toFixed(1)}s`, animationDelay: `${(-rnd(i + 360) * 24).toFixed(1)}s` }}>
          <path d="M40 14c-6 3-9 8-11 15-3 10-9 20-21 27 16 2 32-6 38-22 3-8 1-15-6-20z" fill={['#D62828', '#3F8F2F', '#E8401C', '#B91C1C'][i % 4]} />
          <path d="M40 14c-2 1-3 4-2 6 3-1 7-1 9 1 0-3-3-6-7-7z" fill="#2E6B22" />
          <path d="M44 13c1-4 3-6 7-7" fill="none" stroke="#2E6B22" strokeWidth="3" strokeLinecap="round" />
          <path d="M30 30c-2 6-5 11-10 15" fill="none" stroke="rgba(255, 255, 255, .35)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      ))}
      {Array.from({ length: 28 }, (_, i) => {
        const size = 3 + Math.round(rnd(i + 230) * 5)
        const color = ['#FFD23F', '#FF8A1F', '#FF5A1F'][i % 3]
        return (
          <span key={`ember-${i}`} className={`${i % 2 ? 'k-ember-a' : 'k-ember-b'} absolute bottom-[120px] rounded-full opacity-0`}
            style={{ left: `${Math.round(rnd(i + 200) * 100)}%`, width: size, height: size, background: color, boxShadow: `0 0 10px 2px ${color}`, animationDuration: `${(5 + rnd(i + 260) * 6).toFixed(1)}s`, animationDelay: `${(-rnd(i + 290) * 11).toFixed(1)}s` }} />
        )
      })}

      <div className="absolute inset-x-0 bottom-0" style={{ height: fireH }}>
        {Array.from({ length: flameCount }, (_, i) => {
          const w = Math.round(90 + rnd(i + 1) * 90)
          const h = Math.round((portrait ? 300 : 230) + rnd(i + 40) * (portrait ? 260 : 190))
          return (
            <svg key={`flame-${i}`} className="k-flame absolute bottom-0" width={w} height={h} viewBox="0 0 40 100" preserveAspectRatio="none" aria-hidden="true"
              style={{ left: `${Math.round((i / (flameCount - 1)) * 100)}%`, marginLeft: -w / 2, animationDuration: `${(0.5 + rnd(i + 80) * 0.6).toFixed(2)}s`, animationDelay: `${(-rnd(i + 120)).toFixed(2)}s` }}>
              <path d="M20 0C24 18 38 34 38 62c0 22-8 38-18 38S2 84 2 62C2 44 12 36 14 22c3 8 5 12 8 14C24 26 22 12 20 0z" fill={i % 3 ? '#E8401C' : '#D62828'} />
              <path d="M20 40c3 10 11 18 11 32 0 14-5 28-11 28S9 86 9 72c0-8 5-13 7-20 2 4 3 6 5 7 0-7-1-12-1-19z" fill={i % 2 ? '#FFB020' : '#FFD23F'} />
            </svg>
          )
        })}
        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(11,6,5,0)_0%,#0B0605_85%)]" style={{ height: portrait ? 120 : 90 }} />
        <div className="absolute inset-x-0 flex items-end justify-center" style={{ bottom: portrait ? 70 : 40, gap: portrait ? 18 : 26 }}>
          {fireJars.map((j, i) => (
            <img key={j.key} src={j.image} alt={`${j.name} jar`} className="k-shimmer block w-auto [filter:drop-shadow(0_-4px_22px_rgba(255,120,20,.55))_drop-shadow(0_18px_14px_rgba(0,0,0,.6))]"
              style={{ height: Math.round((portrait ? 300 : 250) - Math.abs(i - mid) * (portrait ? 26 : 16)), animationDelay: `${(i * 0.35) % 2.8}s` }} />
          ))}
        </div>
      </div>

      <img src={LOGO} alt="Jose Madrid Salsa logo" className="k-in-up absolute left-9 top-[26px] w-auto [filter:drop-shadow(0_0_30px_rgba(255,120,20,.35))]" style={{ height: portrait ? 170 : 190 }} />

      <div className={`absolute flex flex-col gap-[22px] ${portrait ? 'inset-x-10 top-[230px] items-center text-center' : 'left-24 top-[250px] w-[600px] items-start'}`}>
        <div className="k-in-up flex items-center gap-[18px] rounded-[18px] border-[3px] border-[#F4A81D] bg-[rgba(11,6,5,.55)] py-[10px] pl-5 pr-7">
          <svg className="k-crown" width="64" height="52" viewBox="0 0 64 52" aria-hidden="true">
            <path d="M4 40 0 10l17 13L32 0l15 23 17-13-4 30z" fill="#F4A81D" />
            <rect x="4" y="43" width="56" height="9" rx="2" fill="#F4A81D" />
            <circle cx="32" cy="27" r="5" fill="#D62828" />
            <circle cx="16" cy="31" r="3.5" fill="#3F8F2F" />
            <circle cx="48" cy="31" r="3.5" fill="#3F8F2F" />
          </svg>
          <span className="k-slab k-hot leading-none tracking-[.03em] text-[#F4A81D]" style={{ fontSize: portrait ? 64 : 60 }}>Salsa Kings</span>
        </div>
        <div className="k-in-up text-[22px] font-extrabold tracking-[.26em] text-[#F4A81D] [animation-delay:.1s]">SINCE 1987 · ZANESVILLE, OHIO</div>
        <div className="k-slab k-in-up leading-[.95] text-[#FFF3E0] [text-shadow:0_0_40px_rgba(255,110,20,.45)] [animation-delay:.15s]" style={{ fontSize: portrait ? 104 : 112 }}>
          Feel the{portrait ? ' ' : <br />}<span className="k-hot text-[#FF8A1F]">heat.</span>
        </div>
        <div className="k-in-up max-w-[520px] text-[28px] font-semibold leading-[1.35] text-[#F3DCC0] [animation-delay:.3s]">Small-batch salsa, made by hand in Ohio.</div>
      </div>

      {portrait ? (
        <div className="k-in-up absolute inset-x-10 top-[1200px] flex flex-col gap-[14px] rounded-[26px] border-2 border-[rgba(244,168,29,.6)] bg-[rgba(11,6,5,.74)] px-6 py-5 [animation-delay:.35s]">
          <div className="grid grid-cols-4 gap-3">
            {PRICE_ROWS.map((r) => (
              <div key={r.label} className="flex flex-col items-center gap-[2px]">
                <span className="k-slab text-[44px] leading-none text-[#F4A81D]">{r.price}</span>
                <span className="text-[20px] font-extrabold text-[#FFF3E0]">{r.label === 'Case' ? 'Case of 12' : r.label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-[18px] rounded-2xl bg-[#D62828] px-5 py-3">
            <span className="text-[18px] font-extrabold tracking-[.2em] text-[#FFD9A0]">SHOW SPECIAL</span>
            <span className="text-[24px] font-extrabold text-[#FFF3E0]">5 jars + a bag of chips</span>
            <span className="k-slab k-hot text-[44px] leading-none text-[#F4A81D]">$40</span>
          </div>
        </div>
      ) : (
        <div className="k-in-up absolute right-14 top-[108px] box-border flex w-[470px] flex-col gap-3 rounded-[28px] border-2 border-[rgba(244,168,29,.6)] bg-[rgba(11,6,5,.74)] px-[30px] pb-6 pt-[26px] shadow-[0_0_60px_rgba(255,110,20,.2)] [animation-delay:.35s]">
          <div className="k-slab text-[36px] leading-none text-[#FFF3E0]">Salsa prices</div>
          <div className="k-serape mb-[6px] h-[10px] rounded-[5px]" />
          {PRICE_ROWS.map((r) => (
            <div key={r.label} className="flex items-baseline gap-3">
              <span className="text-[26px] font-extrabold text-[#FFF3E0]">{r.label}{r.note && <span className="text-[18px] font-bold text-[#CDB89A]">{`  ${r.note}`}</span>}</span>
              <span className="grow -translate-y-[6px] border-b-[3px] border-dotted border-[rgba(255,243,224,.3)]" />
              <span className="k-slab text-[38px] leading-none text-[#F4A81D]">{r.price}</span>
            </div>
          ))}
          <div className="mt-2 flex items-center justify-between gap-[14px] rounded-[18px] bg-[#D62828] px-5 py-4 shadow-[0_6px_0_#8E1414]">
            <div className="flex flex-col gap-1">
              <span className="text-[17px] font-extrabold tracking-[.2em] text-[#FFD9A0]">SHOW SPECIAL</span>
              <span className="text-[24px] font-extrabold leading-[1.2] text-[#FFF3E0]">5 jars + a bag of chips</span>
            </div>
            <span className="k-slab k-hot text-[52px] leading-none text-[#F4A81D]">$40</span>
          </div>
          <div className="pt-1 text-center text-[18px] font-bold text-[#CDB89A]">Mix &amp; match any of our {flavorCount} flavors</div>
        </div>
      )}

      <div className="absolute inset-x-0 z-[3] flex justify-center" style={{ top: portrait ? 1440 : 640 }}>
        <CtaPill className="k-breathe">Touch to start</CtaPill>
      </div>

      {notice && (
        <div className="absolute bottom-6 left-6 z-[4] rounded-xl bg-[rgba(185,28,28,.92)] px-5 py-3 text-[18px] font-bold text-white">{notice}</div>
      )}
    </button>
  )
}

/* ---------- menu ---------- */

export interface MenuProps {
  portrait: boolean
  flavors: KioskFlavor[]
  soldOut: Set<string>
  cart: Record<string, number>
  filter: KioskFilter
  onFilter: (f: KioskFilter) => void
  onPick: (key: string) => void
  onReset: () => void
  orderPanel: ReactNode
  bottomBar: ReactNode
}

export function MenuScreen({ portrait, flavors, soldOut, cart, filter, onFilter, onPick, onReset, orderPanel, bottomBar }: MenuProps) {
  const shown = flavors.filter((f) => matchesFilter(filter, f))
  return (
    <div className="flex h-full flex-col bg-[#FFF3E0] text-[#24130A]">
      <KioskHeader title="Pick your salsa" subtitle="13 OZ JARS · $10.00 EACH" action={
        <button type="button" onClick={onReset} className="flex h-[72px] items-center gap-3 rounded-full border-[3px] border-[#FFF3E0] bg-transparent px-[30px] text-[24px] font-bold text-[#FFF3E0]">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7" /><path d="M4 4v5h5" /></svg>
          Start over
        </button>
      } />
      <div className="flex min-h-0 grow" style={{ flexDirection: portrait ? 'column' : 'row' }}>
        <div className="relative flex min-h-0 grow flex-col overflow-hidden bg-[#24130A]">
          <video src="/videos/kiosk/menu-broll.mp4" autoPlay muted loop playsInline aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(36,19,10,.82)_0%,rgba(36,19,10,.62)_45%,rgba(36,19,10,.86)_100%)]" />
          <div className="relative flex shrink-0 flex-wrap items-center gap-3 px-10 pt-[22px]">
            <span className="flex items-center gap-3 rounded-2xl bg-[#D62828] py-3 pl-[14px] pr-[22px] text-[22px] font-extrabold text-[#FFF3E0] shadow-[0_6px_0_#8E1414]">
              <span className="rounded-lg bg-[#F4A81D] px-[10px] py-1 text-[16px] font-extrabold tracking-[.14em] text-[#24130A]">SHOW SPECIAL</span>
              5 jars + a bag of chips <span className="k-slab text-[28px] text-[#F4A81D]">$40</span>
            </span>
            {[['3 for', '$25'], ['4 for', '$32'], ['Case of 12', '$80']].map(([label, price]) => (
              <span key={label} className="rounded-2xl border-2 border-[rgba(255,243,224,.45)] bg-[rgba(36,19,10,.55)] px-5 py-3 text-[22px] font-bold text-[#FFF3E0]">
                {label} <span className="k-slab text-[26px] text-[#F4A81D]">{price}</span>
              </span>
            ))}
          </div>
          <nav aria-label="Filter by heat" className="relative flex shrink-0 flex-wrap gap-[14px] px-10 pb-[10px] pt-[18px]">
            {FILTERS.map(([id, label]) => {
              const on = filter === id
              const count = flavors.filter((f) => matchesFilter(id, f)).length
              return (
                <button key={id} type="button" onClick={() => onFilter(id)}
                  className={`flex h-[72px] items-center gap-3 rounded-full border-[3px] px-[30px] text-[24px] font-extrabold ${on ? 'border-[#F4A81D] bg-[#F4A81D] text-[#24130A]' : 'border-[rgba(255,243,224,.55)] bg-[rgba(255,243,224,.1)] text-[#FFF3E0]'}`}>
                  {label}
                  <span className={`flex h-10 min-w-[40px] items-center justify-center rounded-full px-[10px] text-[20px] font-extrabold ${on ? 'bg-[#24130A] text-[#FFF3E0]' : 'bg-[#FFF3E0] text-[#24130A]'}`}>{count}</span>
                </button>
              )
            })}
          </nav>
          <div className="k-scroll relative min-h-0 grow overflow-y-auto px-10 pb-12 pt-[22px]">
            {shown.length === 0 ? (
              <p className="mt-16 text-center text-[30px] font-bold text-[#FFF3E0]">No salsas here right now.</p>
            ) : (
              <div className="grid gap-[26px]" style={{ gridTemplateColumns: `repeat(${portrait ? 3 : 4}, minmax(0, 1fr))` }}>
                {shown.map((f) => {
                  const qty = cart[f.key] ?? 0
                  const out = soldOut.has(f.key)
                  return (
                    <button key={f.key} type="button" disabled={out} onClick={() => onPick(f.key)} aria-label={`${f.name}, ${HEAT[f.heat].label}${out ? ', sold out' : ''}`}
                      className="k-tile relative flex flex-col overflow-hidden rounded-[30px] border-0 bg-[#FFFDF8] p-0 text-left text-[#24130A] disabled:cursor-not-allowed"
                      style={{ boxShadow: qty ? '0 0 0 6px #F4A81D, 0 14px 30px rgba(0, 0, 0, .5)' : '0 14px 30px rgba(0, 0, 0, .45)' }}>
                      <div className="relative flex h-[290px] items-end justify-center overflow-hidden" style={{ background: f.tint }}>
                        <div className="absolute left-1/2 top-[34px] ml-[-115px] h-[230px] w-[230px] rounded-full bg-[rgba(255,255,255,.18)]" />
                        <img src={f.image} alt={`${f.name} jar`} className="relative mb-[-6px] block h-[262px] w-auto [filter:drop-shadow(0_14px_14px_rgba(0,0,0,.35))]" style={out ? { filter: 'grayscale(1) opacity(.55)' } : undefined} />
                        {qty > 0 && (
                          <span className="k-slab absolute right-4 top-4 flex h-[60px] min-w-[60px] items-center justify-center rounded-full border-4 border-[#FFF3E0] bg-[#F4A81D] px-3 text-[28px] text-[#24130A]">{qty}</span>
                        )}
                        {out && (
                          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-6 rounded-xl bg-[#24130A] px-5 py-2 text-[26px] font-extrabold tracking-[.12em] text-[#FFF3E0]">SOLD OUT</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-3 px-[22px] pb-[22px] pt-5" style={{ borderTop: `6px solid ${f.tint}` }}>
                        <div className="flex min-h-[60px] items-center text-[26px] font-extrabold leading-[1.15]">{f.name}</div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center">
                            <HeatPips heat={f.heat} size={26} />
                            <span className="ml-2 text-[18px] font-extrabold tracking-[.08em]" style={{ color: HEAT[f.heat].ink }}>{HEAT[f.heat].label.toUpperCase()}</span>
                          </span>
                          <span className="k-slab text-[28px] text-[#C81E1E]">$10.00</span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
        {orderPanel}
      </div>
      {bottomBar}
    </div>
  )
}

function KioskHeader({ title, subtitle, action }: { title: string; subtitle?: string; action: ReactNode }) {
  return (
    <>
      <header className="flex h-[156px] shrink-0 items-center justify-between gap-6 bg-[#C81E1E] pl-[30px] pr-10 text-[#FFF3E0]">
        <div className="flex items-center gap-[26px]">
          <img src={LOGO} alt="Jose Madrid Salsa logo" className="block h-[140px] w-auto shrink-0 [filter:drop-shadow(0_4px_0_rgba(0,0,0,.25))]" />
          <div className="flex flex-col gap-[6px]">
            <div className="k-slab text-[52px] leading-none">{title}</div>
            {subtitle && <div className="text-[20px] font-bold tracking-[.2em] text-[#FFD9A0]">{subtitle}</div>}
          </div>
        </div>
        {action}
      </header>
      <div className="k-serape h-[18px] shrink-0" />
    </>
  )
}

/* ---------- order summary (shared by side panel, cart screen) ---------- */

export function Totals({ quote, hint, dark, big }: { quote: KioskQuote; hint: string | null; dark?: boolean; big?: boolean }) {
  return (
    <>
      {hint && (
        <div className="k-pop mb-2 flex items-center gap-[14px] rounded-[18px] bg-[#F4A81D] px-[18px] py-[14px] font-extrabold leading-[1.25] text-[#24130A]" style={{ fontSize: big ? 24 : 20 }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="#D62828" aria-hidden="true" className="shrink-0"><path d={CHILI_PATH} /></svg>
          <span>{hint}</span>
        </div>
      )}
      <div className="flex justify-between"><span>Subtotal</span><span>{formatCents(quote.listCents)}</span></div>
      {quote.savingsCents > 0 && (
        <div className="flex justify-between text-[#F4A81D]"><span>{dealLabel(quote.deals)}</span><span>-{formatCents(quote.savingsCents)}</span></div>
      )}
      {quote.freeChips > 0 && (
        <div className="flex justify-between text-[#F4A81D]"><span>{chipsText(quote.freeChips)}</span><span>FREE</span></div>
      )}
      <div className="flex justify-between"><span>Tax</span><span>$0.00</span></div>
      <div className={`flex items-baseline justify-between ${dark ? 'text-[#FFF3E0]' : ''}`} style={{ padding: big ? '6px 0 18px' : '8px 0 18px' }}>
        <span className="font-extrabold" style={{ fontSize: big ? 30 : 26 }}>Total</span>
        <span className="k-slab" style={{ fontSize: big ? 60 : 46 }}>{formatCents(quote.totalCents)}</span>
      </div>
    </>
  )
}

export const chipsText = (n: number) => (n === 1 ? 'Bag of chips' : `${n} bags of chips`)

function PayButton({ empty, label, onClick, height, fontSize }: { empty: boolean; label: string; onClick: () => void; height: number; fontSize: number }) {
  return (
    <button type="button" onClick={onClick} disabled={empty}
      className={`k-slab rounded-full border-0 ${empty ? 'bg-[#2C6B57] text-[#A7D9C0]' : 'bg-[#D62828] text-white shadow-[0_10px_0_#062A1F]'}`}
      style={{ height, fontSize }}>
      {label}
    </button>
  )
}

export function OrderPanel({ lines, quote, hint, onPay, onInc, onDec }: { lines: CartLine[]; quote: KioskQuote; hint: string | null; onPay: () => void; onInc: (k: string) => void; onDec: (k: string) => void }) {
  const empty = lines.length === 0
  return (
    <aside aria-label="Your order" className="box-border flex w-[500px] shrink-0 flex-col bg-[#0E4D3A] px-[34px] pb-9 pt-[34px] text-[#FFF3E0]">
      <div className="mb-[22px] flex items-baseline justify-between">
        <h2 className="k-slab m-0 text-[44px]">Your order</h2>
        <span className="text-[22px] font-bold text-[#A7D9C0]">{jarsText(quote.jars)}</span>
      </div>
      <div className="k-scroll flex min-h-0 grow flex-col gap-[14px] overflow-y-auto">
        {empty ? (
          <div className="flex grow flex-col items-center justify-center gap-[22px] p-5 text-center">
            <img className="k-bob h-auto w-[220px]" src="/images/kiosk/bowl.webp" alt="" />
            <p className="m-0 text-[28px] font-semibold leading-[1.35]">Your bag is empty.<br /><span className="text-[#F4A81D]">Tap a jar to start.</span></p>
          </div>
        ) : (
          lines.map(({ flavor, qty }) => (
            <div key={flavor.key} className="flex items-center gap-4 rounded-[22px] bg-[#145C46] py-[14px] pl-3 pr-4">
              <JarThumb flavor={flavor} w={70} h={84} imgH={76} radius={16} />
              <div className="flex min-w-0 grow flex-col gap-[10px]">
                <div className="flex justify-between gap-[10px] text-[21px] font-bold leading-[1.2]">
                  <span>{flavor.name}</span>
                  <span className="k-slab text-[22px] text-[#F4A81D]">{formatCents(qty * 1000)}</span>
                </div>
                <Stepper qty={qty} name={flavor.name} size={52} dark onDec={() => onDec(flavor.key)} onInc={() => onInc(flavor.key)} />
              </div>
            </div>
          ))
        )}
      </div>
      <div className="mt-3 flex flex-col gap-2 border-t-2 border-dashed border-[#3E7F69] pt-[22px] text-[22px] font-semibold text-[#A7D9C0]">
        <Totals quote={quote} hint={hint} dark />
        <PayButton empty={empty} onClick={onPay} height={116} fontSize={40} label={empty ? 'Add a salsa to pay' : `Pay ${formatCents(quote.totalCents)}`} />
      </div>
    </aside>
  )
}

export function PortraitBar({ lines, quote, onReview }: { lines: CartLine[]; quote: KioskQuote; onReview: () => void }) {
  const empty = lines.length === 0
  return (
    <div className="flex h-[196px] shrink-0 items-center justify-between gap-7 bg-[#0E4D3A] px-10 text-[#FFF3E0]">
      <div className="flex items-center gap-5">
        <div className="flex">
          {lines.slice(-3).map(({ flavor }) => (
            <div key={flavor.key} className="mr-[-22px] flex h-[92px] w-[76px] items-end justify-center overflow-hidden rounded-[18px] border-4 border-[#0E4D3A]" style={{ background: flavor.tint }}>
              <img src={flavor.image} alt="" className="h-[82px] w-auto" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1 pl-[30px]">
          <span className="k-slab text-[48px]">{formatCents(quote.totalCents)}</span>
          <span className="text-[22px] font-bold text-[#A7D9C0]">
            {jarsText(quote.jars)}
            {quote.savingsCents > 0 && <span className="text-[#F4A81D]">{` · saving ${formatCents(quote.savingsCents)}`}</span>}
          </span>
        </div>
      </div>
      <PayButton empty={empty} onClick={onReview} height={120} fontSize={40} label="Review order" />
    </div>
  )
}

export const jarsText = (n: number) => (n === 1 ? '1 jar' : `${n} jars`)

/* ---------- cart (portrait) ---------- */

export function CartScreen({ lines, quote, hint, onBack, onPay, onInc, onDec }: { lines: CartLine[]; quote: KioskQuote; hint: string | null; onBack: () => void; onPay: () => void; onInc: (k: string) => void; onDec: (k: string) => void }) {
  return (
    <div className="flex h-full flex-col bg-[#FFF3E0] text-[#24130A]">
      <KioskHeader title="Your order" action={
        <button type="button" onClick={onBack} className="flex h-[72px] items-center gap-[10px] rounded-full border-[3px] border-[#FFF3E0] bg-transparent pl-[18px] pr-[30px] text-[24px] font-bold text-[#FFF3E0]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          Add more salsa
        </button>
      } />
      <div className="k-scroll flex min-h-0 grow flex-col gap-5 overflow-y-auto px-10 py-8">
        {lines.map(({ flavor, qty }) => (
          <div key={flavor.key} className="flex items-center gap-6 rounded-[28px] bg-[#FFFDF8] py-4 pl-4 pr-6 shadow-[0_6px_0_#EBD9BE]">
            <JarThumb flavor={flavor} w={120} h={140} imgH={128} radius={20} />
            <div className="flex grow flex-col gap-[6px]">
              <span className="text-[30px] font-extrabold leading-[1.15]">{flavor.name}</span>
              <span className="text-[22px] font-semibold text-[#7A5A3A]">$10.00 each</span>
            </div>
            <Stepper qty={qty} name={flavor.name} size={72} onDec={() => onDec(flavor.key)} onInc={() => onInc(flavor.key)} />
            <span className="k-slab min-w-[130px] text-right text-[36px] text-[#C81E1E]">{formatCents(qty * 1000)}</span>
          </div>
        ))}
      </div>
      <div className="flex shrink-0 flex-col gap-[10px] bg-[#0E4D3A] px-10 pb-11 pt-[30px] text-[26px] font-semibold text-[#A7D9C0]">
        <Totals quote={quote} hint={hint} dark big />
        <PayButton empty={lines.length === 0} onClick={onPay} height={128} fontSize={46} label={`Pay ${formatCents(quote.totalCents)}`} />
      </div>
    </div>
  )
}

/* ---------- payment ---------- */

export type PayPhase = 'starting' | 'waiting' | 'canceling' | 'failed'

export function PayScreen({ phase, quote, error, onCancel, onRetry, onBack }: { phase: PayPhase; quote: KioskQuote; error: string | null; onCancel: () => void; onRetry: () => void; onBack: () => void }) {
  const failed = phase === 'failed'
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-10 overflow-hidden bg-[#C81E1E] p-16 text-center text-[#FFF3E0]">
      <div className="absolute left-1/2 top-1/2 ml-[-750px] mt-[-750px] h-[1500px] w-[1500px] rounded-full bg-[radial-gradient(circle,#D9352A_0_30%,transparent_30.2%),radial-gradient(circle,#CF2A22_0_50%,transparent_50.2%)]" />
      <div className="relative flex flex-col gap-[6px]">
        <span className="text-[28px] font-extrabold tracking-[.24em] text-[#FFD9A0]">{failed ? 'PAYMENT NOT COMPLETED' : 'TOTAL DUE'}</span>
        <span className="k-slab text-[170px] leading-none [text-shadow:6px_6px_0_#8E1414]">{formatCents(quote.totalCents)}</span>
        {quote.savingsCents > 0 && (
          <span className="mt-[10px] self-center rounded-3xl bg-[#F4A81D] px-6 py-[10px] text-[26px] font-extrabold text-[#24130A]">
            You saved {formatCents(quote.savingsCents)}{quote.freeChips ? ' + free chips' : ''}
          </span>
        )}
      </div>

      {failed ? (
        <>
          <div className="k-slab relative max-w-[960px] text-[56px] leading-[1.1]">That didn&apos;t go through.</div>
          <p className="relative m-0 max-w-[900px] text-[28px] font-semibold text-[#FFD9A0]">{error ?? 'The card reader canceled the payment.'} No money was taken.</p>
          <div className="relative flex gap-6">
            <button type="button" onClick={onRetry} className="k-slab h-[112px] rounded-full border-0 bg-[#F4A81D] px-14 text-[40px] text-[#24130A] shadow-[0_10px_0_#B5740A]">Try again</button>
            <button type="button" onClick={onBack} className="h-[112px] rounded-full border-[3px] border-[#FFF3E0] bg-transparent px-12 text-[30px] font-bold text-[#FFF3E0]">Back to my order</button>
          </div>
        </>
      ) : (
        <>
          <div className="relative flex h-[280px] w-[280px] items-center justify-center rounded-full bg-[#FFF3E0] text-[#C81E1E] shadow-[0_14px_0_#8E1414]" aria-hidden="true">
            <span className="k-ring" />
            <span className="k-ring k-ring-2" />
            <svg width="130" height="130" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8.5 8.5a5 5 0 0 1 0 7" /><path d="M12 6a8.5 8.5 0 0 1 0 12" /><path d="M15.5 3.5a12 12 0 0 1 0 17" /></svg>
          </div>
          <div className="k-slab relative max-w-[960px] text-[60px] leading-[1.1]" role="status">
            {phase === 'starting' ? 'Getting the card reader ready…' : phase === 'canceling' ? 'Canceling…' : 'Tap, insert or swipe on the card reader'}
          </div>
          {phase === 'waiting' && (
            <svg className="k-bounce relative" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="#F4A81D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v16M5 13l7 7 7-7" /></svg>
          )}
          <button type="button" onClick={onCancel} disabled={phase !== 'waiting'} className="relative h-[76px] rounded-full border-[3px] border-[#FFF3E0] bg-transparent px-10 text-[26px] font-bold text-[#FFF3E0] disabled:opacity-40">Cancel payment</button>
        </>
      )}
    </div>
  )
}

/* ---------- confirmation ---------- */

export function DoneScreen({ portrait, orderNumber, lines, quote, secondsLeft, printNote, onNewOrder }: { portrait: boolean; orderNumber: string; lines: CartLine[]; quote: KioskQuote; secondsLeft: number; printNote: string | null; onNewOrder: () => void }) {
  return (
    <div className="relative flex h-full items-center justify-center gap-[90px] overflow-hidden bg-[#0E4D3A] p-16 text-center text-[#FFF3E0]" style={{ flexDirection: portrait ? 'column' : 'row' }}>
      <div className="k-serape absolute inset-x-0 top-0 h-[26px]" />
      <div className="k-spin absolute left-1/2 top-1/2 ml-[-1300px] mt-[-1300px] h-[2600px] w-[2600px] rounded-full bg-[repeating-conic-gradient(#0E4D3A_0_7.5deg,#11563F_7.5deg_15deg)]" />
      <div className="relative flex flex-col items-center gap-[30px]">
        <div className="k-pop flex h-[150px] w-[150px] items-center justify-center rounded-full bg-[#F4A81D] text-[#24130A] shadow-[0_10px_0_#B5740A]">
          <svg width="86" height="86" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </div>
        <div className="k-slab k-in-up text-[150px] leading-none text-[#F4A81D] [text-shadow:6px_6px_0_#062A1F]">¡Gracias!</div>
        <div className="k-in-up text-[36px] font-bold [animation-delay:.15s]">Order {orderNumber} · {formatCents(quote.totalCents)} paid</div>
        <div className="flex items-end gap-4">
          {lines.slice(0, 3).map(({ flavor }, i) => (
            <div key={flavor.key} className="k-rise" style={{ animationDelay: `${0.3 + i * 0.15}s` }}>
              <JarThumb flavor={flavor} w={130} h={158} imgH={146} radius={24} />
            </div>
          ))}
        </div>
      </div>
      <div className="relative flex flex-col items-center gap-[26px]">
        <div className="flex flex-col items-center">
          <div className="h-[34px] w-[420px] rounded-[17px] bg-[#062A1F] shadow-[inset_0_-8px_0_#000]" />
          <div className="h-[430px] w-[340px] overflow-hidden">
            <div className="k-print box-border flex w-[340px] flex-col gap-2 bg-white px-6 pb-[26px] pt-[22px] text-left font-mono text-[15px] font-semibold leading-[1.4] text-black shadow-[0_12px_24px_rgba(0,0,0,.35)]">
              <span className="text-center text-[20px] font-extrabold">JOSE MADRID SALSA</span>
              <span className="text-center">Zanesville, OH · josemadrid.net</span>
              <span className="border-t-2 border-dashed border-black" />
              <span className="flex justify-between"><span>Order</span><span className="font-extrabold">{orderNumber}</span></span>
              {lines.map(({ flavor, qty }) => (
                <span key={flavor.key} className="flex justify-between gap-[10px]"><span>{qty} x {flavor.name}</span><span>{formatCents(qty * 1000)}</span></span>
              ))}
              <span className="border-t-2 border-dashed border-black" />
              {quote.savingsCents > 0 && <span className="flex justify-between gap-[10px]"><span>{dealLabel(quote.deals)}</span><span>-{formatCents(quote.savingsCents)}</span></span>}
              {quote.freeChips > 0 && <span className="flex justify-between gap-[10px]"><span>{chipsText(quote.freeChips)}</span><span>FREE</span></span>}
              <span className="flex justify-between text-[19px] font-extrabold"><span>TOTAL</span><span>{formatCents(quote.totalCents)}</span></span>
              <span className="pt-[6px] text-center font-extrabold">Gracias!</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-[14px] text-[30px] font-bold">
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M6 14h12v7H6z" /></svg>
          {printNote ?? (secondsLeft > DONE_RESET_SECONDS - 3 ? 'Printing your receipt…' : 'Grab your receipt from the printer')}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-12 flex justify-center">
        <button type="button" onClick={onNewOrder} className="flex h-[104px] items-center gap-[22px] rounded-full border-0 bg-[#FFF3E0] pl-11 pr-[22px] text-[30px] font-extrabold text-[#0E4D3A] shadow-[0_10px_0_#062A1F]">
          Back to start in {secondsLeft}s
          <span className="relative h-[72px] w-[72px]">
            <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true" className="-rotate-90">
              <circle cx="36" cy="36" r="30" fill="none" stroke="#CFE7DA" strokeWidth="8" />
              <circle className="k-countdown" cx="36" cy="36" r="30" fill="none" stroke="#D62828" strokeWidth="8" strokeLinecap="round" strokeDasharray="188.5" />
            </svg>
          </span>
        </button>
      </div>
    </div>
  )
}

/* ---------- detail modal ---------- */

export function DetailModal({ portrait, flavor, qty, onDec, onInc, onClose, onAdd }: { portrait: boolean; flavor: KioskFlavor; qty: number; onDec: () => void; onInc: () => void; onClose: () => void; onAdd: () => void }) {
  const art: CSSProperties = portrait ? { width: '100%', height: 560 } : { width: 500, height: 720 }
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[rgba(36,19,10,.72)] p-10" onClick={onClose}>
      <div role="dialog" aria-label={flavor.name} onClick={(e) => e.stopPropagation()}
        className="relative flex overflow-hidden rounded-[40px] bg-[#FFF3E0] shadow-[0_30px_60px_rgba(0,0,0,.4)]"
        style={{ width: portrait ? 960 : 1240, flexDirection: portrait ? 'column' : 'row' }}>
        <div className="relative flex shrink-0 items-center justify-center overflow-hidden" style={{ ...art, background: flavor.tint }}>
          <div className="absolute h-[420px] w-[420px] rounded-full bg-[rgba(255,255,255,.18)]" />
          <div className="absolute h-[600px] w-[600px] rounded-full border-[3px] border-dashed border-[rgba(255,255,255,.35)]" />
          <img className="k-bob relative w-auto [filter:drop-shadow(0_24px_22px_rgba(0,0,0,.4))]" src={flavor.image} alt={`${flavor.name} jar`} style={{ height: portrait ? 460 : 560 }} />
        </div>
        <div className="flex grow flex-col gap-6 px-[52px] pb-12 pt-[52px] text-[#24130A]">
          <button type="button" onClick={onClose} aria-label="Close" className="absolute right-[22px] top-[22px] flex h-[76px] w-[76px] items-center justify-center rounded-full border-0 bg-[#24130A] text-[#FFF3E0]">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
          <span className="self-start rounded-[22px] px-5 py-[10px] text-[20px] font-extrabold tracking-[.14em] text-white" style={{ background: HEAT[flavor.heat].chip }}>{HEAT[flavor.heat].label.toUpperCase()}</span>
          <h2 className="k-slab m-0 pr-[70px] text-[64px] leading-[1.02]">{flavor.name}</h2>
          <div className="flex items-center gap-[6px]">
            <HeatPips heat={flavor.heat} size={40} />
            <span className="ml-3 text-[26px] font-bold text-[#7A5A3A]">13 oz jar · $10.00 · mix &amp; match 3 for $25</span>
          </div>
          <div className="grow" />
          <Stepper qty={qty} name={flavor.name} size={96} onDec={onDec} onInc={onInc} />
          <button type="button" onClick={onAdd} className="k-slab h-[120px] w-full rounded-full border-0 bg-[#D62828] text-[42px] text-white shadow-[0_10px_0_#8E1414]">
            Add {qty} to my order
          </button>
        </div>
      </div>
    </div>
  )
}

export function Toast({ text }: { text: string }) {
  return (
    <div role="status" className="absolute inset-x-0 top-[190px] z-20 flex justify-center">
      <div className="k-pop rounded-[22px] bg-[#24130A] px-9 py-5 text-[28px] font-bold text-[#FFF3E0] shadow-[0_14px_30px_rgba(0,0,0,.45)]">{text}</div>
    </div>
  )
}
