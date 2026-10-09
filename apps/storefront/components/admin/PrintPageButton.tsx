'use client'

interface PrintPageButtonProps {
  label: string
}

// The invoice and packing slip pages are Server Components, which cannot hold
// an onClick handler, so their print button lives here.
export default function PrintPageButton({ label }: PrintPageButtonProps) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{ background: '#dc2626', color: 'white', border: 'none', padding: '10px 24px', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
    >
      {label}
    </button>
  )
}
