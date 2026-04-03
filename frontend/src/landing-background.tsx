/** Shared full-viewport background (matches landing aesthetic). */
export function LandingBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      style={{
        background: `
            radial-gradient(ellipse 120% 70% at 50% -10%, rgba(22, 110, 80, 0.18) 0%, rgba(22, 110, 80, 0.18) 38%, transparent 100%),
            radial-gradient(ellipse 130% 85% at 50% 100%, rgba(75, 77, 85, 0.42) 0%, rgba(232, 116, 0, 0.1) 38%, transparent 58%),
            radial-gradient(ellipse 60% 40% at 50% 100%, rgba(90, 85, 80, 0.16) 0%, transparent 44%),
            #404443
          `,
      }}
    />
  )
}
