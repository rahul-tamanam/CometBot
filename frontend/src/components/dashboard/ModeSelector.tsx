import type { ModeId } from './types'

export function ModeSelector({
  value,
  onChange,
  options,
}: {
  value: ModeId
  onChange: (m: ModeId) => void
  options: Array<{ id: ModeId; label: string }>
}) {
  return (
    <div className="inline-flex rounded-2xl bg-slate-100 p-1 ring-1 ring-slate-200">
      {options.map((opt) => {
        const active = opt.id === value
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={[
              'rounded-xl px-3 py-2 text-xs font-semibold transition-colors',
              active
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                : 'text-slate-600 hover:text-slate-900',
            ].join(' ')}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

