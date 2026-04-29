import { useState } from 'react'

export function PromptCard({
  text,
  onClick,
}: {
  text: string
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group flex min-h-[86px] items-center justify-center rounded-2xl p-4 text-center shadow-sm transition-all hover:-translate-y-[1px] hover:shadow-md"
      style={{
        backgroundColor: hovered ? '#FFBF77' : 'var(--surface2)',
        border: '2px solid color-mix(in oklab, var(--accent) 35%, var(--border) 65%)',
      }}
    >
      <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
        {text}
      </div>
    </button>
  )
}

