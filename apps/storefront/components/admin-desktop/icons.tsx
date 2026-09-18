/**
 * The desktop shell's icon set, drawn once into a hidden sprite and referenced
 * by `<use>`.
 *
 * These are inline rather than an icon package because the shell renders a few
 * hundred of them per screen and every one is the same handful of shapes at the
 * same 1.6px stroke — a sprite keeps the DOM small and the weight consistent.
 */

export function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <g id="i-gauge">
          <path d="M12 14a2 2 0 100-4 2 2 0 000 4zM13.4 10.6L17 7M3.5 18a9 9 0 1117 0" />
        </g>
        <g id="i-receipt">
          <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6" />
        </g>
        <g id="i-package">
          <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM4 7.5l8 4.5 8-4.5M12 12v9" />
        </g>
        <g id="i-boxes">
          <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
          <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
          <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
        </g>
        <g id="i-users">
          <path d="M9 11a3 3 0 100-6 3 3 0 000 6zM2.5 19a6.5 6.5 0 0113 0M16 6.2a3 3 0 010 5.6M18 19c0-2-.7-3.6-1.8-4.7" />
        </g>
        <g id="i-wallet">
          <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
          <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
        </g>
        <g id="i-gift">
          <rect x="3" y="8" width="18" height="4" rx="1" />
          <path d="M12 8v13" />
          <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
          <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
        </g>
        <g id="i-calendar">
          <path d="M4 6.5h16V20H4V6.5zM8 3.5v4M16 3.5v4M4 11h16M11 15h2" />
        </g>
        <g id="i-mail">
          <path d="M3 6h18v12H3V6zM3.5 6.6L12 13l8.5-6.4" />
        </g>
        <g id="i-share">
          <path d="M18 8a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM6 14.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM18 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM8.2 11.1l7.6-3.7M8.2 12.9l7.6 3.7" />
        </g>
        <g id="i-file">
          <path d="M6 3h8l4 4v14H6V3zM14 3v4h4M9 12h6M9 16h6" />
        </g>
        <g id="i-star">
          <path d="M12 4l2.4 5 5.6.7-4.1 3.8 1.1 5.5L12 16.3 6.9 19l1.1-5.5L4 9.7 9.6 9 12 4z" />
        </g>
        <g id="i-target">
          <path d="M12 20a8 8 0 100-16 8 8 0 000 16zM12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" />
        </g>
        <g id="i-chart">
          <path d="M4 20V4M4 20h16M8 17V11M12.5 17V7.5M17 17v-4" />
        </g>
        <g id="i-image">
          <path d="M3.5 5h17v14h-17V5zM3.8 16l4.7-4.6 3.4 3.3 3-2.8 5 4.6M15.5 9.8a1.2 1.2 0 100-2.4 1.2 1.2 0 000 2.4z" />
        </g>
        <g id="i-message">
          <path d="M4 5h16v11H9l-5 4V5zM8 10h8" />
        </g>
        <g id="i-shield">
          <path d="M12 3l8 3v6c0 4.4-3.3 7.7-8 9-4.7-1.3-8-4.6-8-9V6l8-3zM9 12l2 2 4-4" />
        </g>
        <g id="i-history">
          <path d="M12 20a8 8 0 10-7.6-10.4M4 4v5h5M12 8v4.5l3 1.8" />
        </g>
        <g id="i-settings">
          <path d="M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4zM19.5 12l1.6-1.4-1.4-2.8-2 .6-2-1.2-.4-2.1h-3l-.5 2.1-2 1.2-2-.6L4.4 10.6 6 12l-1.6 1.4 1.4 2.8 2-.6 2 1.2.5 2.1h3l.4-2.1 2-1.2 2 .6 1.4-2.8L19.5 12z" />
        </g>
        <g id="i-database">
          <path d="M12 8c4.4 0 8-1.1 8-2.5S16.4 3 12 3 4 4.1 4 5.5 7.6 8 12 8zM4 5.5v13C4 19.9 7.6 21 12 21s8-1.1 8-2.5v-13M4 12c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5" />
        </g>
        <g id="i-truck">
          <path d="M3 6h11v10H3V6zM14 9.5h4l3 3.2V16h-7V9.5zM7.5 19a2 2 0 100-4 2 2 0 000 4zM17.5 19a2 2 0 100-4 2 2 0 000 4z" />
        </g>
        <g id="i-rotate">
          <path d="M20 12a8 8 0 11-2.6-5.9M20 3.5V9h-5.5" />
        </g>
        <g id="i-search">
          <path d="M11 18a7 7 0 100-14 7 7 0 000 14zM16.2 16.2L21 21" />
        </g>
        <g id="i-plus">
          <path d="M12 5v14M5 12h14" />
        </g>
        <g id="i-chev">
          <path d="M9 5l7 7-7 7" />
        </g>
        <g id="i-pin">
          <path d="M12 21s7-6.1 7-11a7 7 0 10-14 0c0 4.9 7 11 7 11zM12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
        </g>
        <g id="i-check">
          <path d="M4 12.5l5 5L20 6.5" />
        </g>
        <g id="i-down">
          <path d="M12 4v11M7 11l5 5 5-5M4.5 20h15" />
        </g>
        <g id="i-up">
          <path d="M12 20V6M6 12l6-6 6 6" />
        </g>
        <g id="i-alert">
          <path d="M12 3.5L21 19.5H3L12 3.5zM12 9.5v4.5M12 16.6h.01" />
        </g>
        <g id="i-close">
          <path d="M6 6l12 12M18 6L6 18" />
        </g>
        <g id="i-pencil">
          <path d="M4 20h4L19 9a2.1 2.1 0 10-3-3L5 17v3zM14.5 6.5l3 3" />
        </g>
        <g id="i-trash">
          <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
        </g>
        <g id="i-columns">
          <path d="M4 4h16v16H4V4zM10 4v16M16 4v16" />
        </g>
      </defs>
    </svg>
  )
}

export function Icon({
  name,
  size = 14,
  className,
}: {
  name: string
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flex: 'none' }}
      aria-hidden="true"
    >
      <use href={`#${name}`} />
    </svg>
  )
}
