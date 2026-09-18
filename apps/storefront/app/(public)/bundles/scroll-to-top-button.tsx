'use client'

export function ScrollToTopButton() {
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="bg-white text-salsa-600 hover:bg-gray-100 font-semibold px-8 py-4 rounded-lg transition-colors"
    >
      Get Started
    </button>
  )
}
