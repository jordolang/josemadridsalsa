/** The red-and-white ribbon that trails off the right edge of the header strip and footer banner. */
export function RibbonSwoosh({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 60"
      preserveAspectRatio="none"
      aria-hidden
      className={`pointer-events-none absolute inset-y-0 right-0 h-full ${className}`}
    >
      <path d="M40 60 C110 60 150 0 240 0 L240 60 Z" className="fill-salsa-800/40" />
      <path d="M90 60 C150 56 185 18 240 6" className="fill-none stroke-white" strokeWidth="7" />
      <path d="M125 60 C170 56 205 30 240 22" className="fill-none stroke-white/85" strokeWidth="4.5" />
      <path d="M160 60 C195 57 218 44 240 38" className="fill-none stroke-salsa-900/50" strokeWidth="4" />
      <path d="M185 60 C210 58 226 50 240 47" className="fill-none stroke-white/60" strokeWidth="3" />
    </svg>
  )
}
