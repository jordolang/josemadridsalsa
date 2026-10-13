/**
 * Gold award seal for the homepage hero: a laurel wreath around a dark medallion.
 * The wording reflects the confirmed national awards recorded in PRODUCT.md.
 */

const GOLD = '#d9a235'
const GOLD_LIGHT = '#e6b54e'

// Leaves along one branch of the wreath, from the bottom of the seal up its side.
function laurelLeaves(side: -1 | 1) {
  const leaves = []
  const R = 86
  for (let i = 0; i < 11; i++) {
    // Sweep from just off the bottom (90°) to the upper shoulder (~235°) on the left.
    const deg = 98 + i * 13.5
    const theta = (side === -1 ? deg : 180 - deg) * (Math.PI / 180)
    const x = 100 + R * Math.cos(theta)
    const y = 100 + R * Math.sin(theta)
    const tangent = (theta * 180) / Math.PI + (side === -1 ? 90 : -90)
    for (const offset of [-1, 1]) {
      const lx = x + offset * 6 * Math.cos(theta)
      const ly = y + offset * 6 * Math.sin(theta)
      leaves.push(
        <ellipse
          key={`${side}-${i}-${offset}`}
          cx={lx}
          cy={ly}
          rx={9 - i * 0.25}
          ry={3.6}
          fill={offset === -1 ? GOLD : GOLD_LIGHT}
          transform={`rotate(${tangent + offset * 28} ${lx} ${ly})`}
        />,
      )
    }
  }
  return leaves
}

export function AwardSeal({ className = '' }: { className?: string }) {
  return (
    <div
      className={className}
      title="Best Green Salsa in the US — National Salsa Shoot Out, Fort Worth, Texas, 2004"
    >
      <svg viewBox="0 0 200 220" role="img" aria-label="Award winning, nationally recognized" className="h-full w-full drop-shadow-[0_8px_18px_rgba(0,0,0,0.6)]">
        <defs>
          <path id="award-seal-arc" d="M 52 100 A 48 48 0 0 1 148 100" />
        </defs>

        {/* Ribbon tails */}
        <polygon points="78,150 66,206 80,196 90,210 98,156" fill="#b8821f" />
        <polygon points="122,150 134,206 120,196 110,210 102,156" fill="#b8821f" />

        {/* Laurel wreath */}
        <path d="M 100 188 A 86 86 0 0 1 22 70" fill="none" stroke={GOLD} strokeWidth="1.5" />
        <path d="M 100 188 A 86 86 0 0 0 178 70" fill="none" stroke={GOLD} strokeWidth="1.5" />
        {laurelLeaves(-1)}
        {laurelLeaves(1)}

        {/* Medallion */}
        <circle cx="100" cy="100" r="68" fill="#140d06" stroke={GOLD} strokeWidth="3.5" />
        <circle cx="100" cy="100" r="61" fill="none" stroke={GOLD} strokeWidth="1" strokeDasharray="2 3" opacity="0.8" />

        <text fill={GOLD} fontSize="10.5" letterSpacing="2.2" fontWeight="600" style={{ fontFamily: 'var(--font-oswald), sans-serif' }}>
          <textPath href="#award-seal-arc" startOffset="50%" textAnchor="middle">
            NATIONALLY RECOGNIZED
          </textPath>
        </text>

        {/* Crown */}
        <path d="M84 98 L82 84 L92 91 L100 80 L108 91 L118 84 L116 98 Z" fill={GOLD} />
        <rect x="84" y="100" width="32" height="4" rx="1" fill={GOLD} />

        <text x="100" y="128" textAnchor="middle" fill={GOLD_LIGHT} fontSize="21" fontWeight="700" letterSpacing="1.5" style={{ fontFamily: 'var(--font-oswald), sans-serif' }}>
          AWARD
        </text>
        <text x="100" y="149" textAnchor="middle" fill={GOLD_LIGHT} fontSize="21" fontWeight="700" letterSpacing="1.5" style={{ fontFamily: 'var(--font-oswald), sans-serif' }}>
          WINNING
        </text>
      </svg>
    </div>
  )
}
