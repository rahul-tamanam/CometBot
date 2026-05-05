import { useEffect, useId, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown } from 'lucide-react'

export type CustomSelectOption = { value: string; label: string }

type CustomSelectProps = {
  instanceKey: string
  openInstanceKey: string | null
  setOpenInstanceKey: (key: string | null) => void
  id?: string
  value: string
  onChange: (value: string) => void
  options: CustomSelectOption[]
  placeholder?: string
  variant?: 'course' | 'status'
}

export function CustomSelect({
  instanceKey,
  openInstanceKey,
  setOpenInstanceKey,
  id: idProp,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  variant = 'course',
}: CustomSelectProps) {
  const autoId = useId()
  const id = idProp ?? `custom-select-${autoId}`
  const rootRef = useRef<HTMLDivElement>(null)
  const listboxId = `${id}-listbox`
  const open = openInstanceKey === instanceKey

  const setOpen = (next: boolean) => setOpenInstanceKey(next ? instanceKey : null)

  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target
      if (t instanceof Element && rootRef.current?.contains(t)) return
      setOpenInstanceKey(null)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenInstanceKey(null)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, setOpenInstanceKey])

  const fmt = (s: string) => (variant === 'course' ? s.toUpperCase() : s)

  const selected = options.find((o) => o.value === value)
  const displayLabel = selected
    ? fmt(selected.label)
    : value.trim()
      ? fmt(value)
      : fmt(placeholder)

  const triggerClass =
    variant === 'course'
      ? 'w-full flex items-center justify-between gap-2 rounded-lg border border-[#d1d5db] bg-white py-2.5 pl-4 pr-3 text-left shadow-[0_1px_2px_rgba(0,0,0,0.06)] outline-none transition-[border-color,box-shadow] duration-200 hover:border-[#c4b8a8] focus-visible:border-[#FE6507] focus-visible:ring-2 focus-visible:ring-[#FE6507]/18'
      : 'min-w-[11rem] w-full flex items-center justify-between gap-2 rounded-lg border border-[#d1d5db] bg-white py-2.5 pl-3 pr-3 text-left shadow-[0_1px_2px_rgba(0,0,0,0.06)] outline-none transition-[border-color,box-shadow] duration-200 hover:border-[#c4b8a8] focus-visible:border-[#0f6b44] focus-visible:ring-2 focus-visible:ring-[#0f6b44]/20 sm:min-w-[12rem]'

  const labelClass =
    variant === 'course'
      ? 'min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wide text-[#0f172a] sm:text-xs'
      : 'min-w-0 flex-1 truncate text-left text-sm font-medium text-[#0f172a]'

  const itemBase =
    variant === 'course'
      ? 'flex w-full items-center gap-2 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide transition-colors duration-150 sm:text-xs'
      : 'flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium transition-colors duration-150'

  return (
    <div ref={rootRef} className="relative min-w-0 w-full">
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        className={triggerClass}
        onClick={() => setOpen(!open)}
      >
        <span className={labelClass}>{displayLabel}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
          strokeWidth={2.2}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={listboxId}
            role="listbox"
            aria-labelledby={id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white py-1 shadow-[0_10px_40px_rgba(0,0,0,0.14),0_4px_12px_rgba(0,0,0,0.06)]"
          >
            <div className="max-h-[min(280px,42vh)] overflow-y-auto overscroll-contain py-0.5">
              {options.map((opt) => {
                const isSelected = opt.value === value
                const hoverClass =
                  variant === 'course'
                    ? 'text-[#0f172a] hover:bg-[#e8f4fc]'
                    : 'text-[#0f172a] hover:bg-slate-50'
                const selectedClass =
                  variant === 'course'
                    ? isSelected
                      ? 'bg-[#e8f4fc]'
                      : 'bg-white'
                    : isSelected
                      ? 'bg-[#c8f9ec]'
                      : 'bg-white'

                return (
                  <button
                    key={`${instanceKey}-${opt.value}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`${itemBase} ${hoverClass} ${selectedClass}`}
                    onClick={() => {
                      onChange(opt.value)
                      setOpen(false)
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">{fmt(opt.label)}</span>
                    {isSelected && (
                      <Check className="h-4 w-4 shrink-0 text-[#0f172a]" strokeWidth={2.5} aria-hidden />
                    )}
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
