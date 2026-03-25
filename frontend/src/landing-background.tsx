/** Shared full-viewport background (matches landing aesthetic). */
export function LandingBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      style={{
        background: `
            radial-gradient(ellipse 120% 70% at 50% -10%, rgba(12, 27, 92, 0.7) 0%, rgba(22, 110, 80, 0.18) 38%, transparent 100%),
            radial-gradient(ellipse 130% 85% at 50% 100%, rgba(0, 50, 232, 0.42) 0%, rgba(232, 116, 0, 0.1) 38%, transparent 58%),
            radial-gradient(ellipse 60% 40% at 50% 100%, rgba(232, 117, 0, 0.16) 0%, transparent 44%),
            #030306
          `,
      }}
    />
  )
}
