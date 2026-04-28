import { Mic, Send } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

export function InputBar({
  value,
  onChange,
  onSend,
  disabled,
  placeholder,
  leadingButton,
}: {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  disabled?: boolean
  placeholder?: string
  /** Replaces the default (disabled) mic button. Use this to surface a
   *  mode-specific action such as "Show Degree Progress". */
  leadingButton?: ReactNode
}) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        ref.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      className="sticky bottom-0 z-20 -mx-4 px-4 pb-4 pt-3 backdrop-blur"
      style={{
        borderTop: '1px solid var(--border)',
        backgroundColor: 'color-mix(in oklab, var(--bg) 85%, transparent 15%)',
      }}
    >
      <div
        className="flex items-center gap-2 rounded-2xl px-3 py-2 shadow-sm"
        style={{ backgroundColor: 'var(--surface2, var(--surface))', border: '1px solid var(--border)' }}
      >
        {leadingButton ?? (
          <button
            type="button"
            className="hidden h-9 w-9 items-center justify-center rounded-xl md:flex"
            style={{ color: 'var(--text-muted)' }}
            title="Voice (optional)"
            disabled
          >
            <Mic size={18} />
          </button>
        )}
        <input
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
          placeholder={placeholder ?? 'Start researching...'}
          className="h-10 min-w-0 flex-1 bg-transparent px-1 text-sm outline-none"
          style={{ color: 'var(--text)' }}
          disabled={disabled}
        />
        <button
          type="button"
          onClick={onSend}
          disabled={disabled || !value.trim()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white shadow-sm transition-opacity disabled:opacity-40"
          style={{
            background:
              'linear-gradient(90deg, #ff4d4d 0%, #ff7a1a 55%, #ff9a33 100%)',
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}

