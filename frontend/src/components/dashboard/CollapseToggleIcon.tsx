export function CollapseToggleIcon({
  direction,
  variant,
}: {
  direction: 'left' | 'right'
  variant: 'outline' | 'solid'
}) {
  const isSolid = variant === 'solid'
  const chevronPath =
    direction === 'left'
      ? 'M12.8 6.2 L9.2 10 L12.8 13.8'
      : 'M7.2 6.2 L10.8 10 L7.2 13.8'

  // Side panel is on the collapsing side.
  const panelX = direction === 'left' ? 3.4 : 12.2

  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Outer rounded square */}
      <rect
        x="1.6"
        y="1.6"
        width="16.8"
        height="16.8"
        rx="3.2"
        fill={isSolid ? 'currentColor' : 'transparent'}
        stroke="currentColor"
        strokeWidth="1.4"
        opacity={isSolid ? 0.85 : 0.9}
      />

      {/* Inner side panel */}
      <rect
        x={panelX}
        y="3.4"
        width="4.4"
        height="13.2"
        rx="2.2"
        fill={isSolid ? '#ffffff' : 'currentColor'}
        opacity={isSolid ? 0.95 : 0.18}
      />

      {/* Chevron */}
      <path
        d={chevronPath}
        stroke={isSolid ? '#ffffff' : 'currentColor'}
        strokeWidth="2.0"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={isSolid ? 1 : 0.85}
      />
    </svg>
  )
}

