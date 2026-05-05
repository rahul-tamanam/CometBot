import { useEffect, useMemo, useState } from 'react'
import type { ProgressData } from '@/api'

interface Props {
  progress: ProgressData
}

export default function ProgressBar({ progress }: Props) {
  const targetPct = Math.min(100, progress.percent_complete)
  const targetCorePct = useMemo(
    () => Math.min(100, (progress.core_completed_credits / 18) * 100),
    [progress.core_completed_credits],
  )
  const targetElectivePct = useMemo(
    () => Math.min(100, (progress.elective_completed_credits / 18) * 100),
    [progress.elective_completed_credits],
  )

  const [pct, setPct] = useState(0)
  const [corePct, setCorePct] = useState(0)
  const [electivePct, setElectivePct] = useState(0)

  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

    if (reduceMotion) {
      setPct(targetPct)
      setCorePct(targetCorePct)
      setElectivePct(targetElectivePct)
      return
    }

    // Force a paint at 0% first, then animate to target.
    setPct(0)
    setCorePct(0)
    setElectivePct(0)

    const raf = window.requestAnimationFrame(() => {
      setPct(targetPct)
      setCorePct(targetCorePct)
      setElectivePct(targetElectivePct)
    })
    return () => window.cancelAnimationFrame(raf)
  }, [targetPct, targetCorePct, targetElectivePct])
  const degreeCreditsComplete =
    progress.total_remaining_credits <= 0 || pct >= 100

  return (
    <div
      className="w-full rounded-xl p-4 mb-4"
      style={{
        background:
          'color-mix(in oklab, #4caf82 7%, var(--surface) 93%)',
        border:
          '1px solid color-mix(in oklab, #4caf82 24%, var(--border) 76%)',
      }}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          Degree Progress
        </span>
        <span className="text-sm font-semibold" style={{ color: '#c0392b' }}>
          {degreeCreditsComplete ? (
            <>
              <span aria-hidden>🎓 </span>
              Complete
            </>
          ) : (
            `${pct.toFixed(0)}% complete`
          )}
        </span>
      </div>

      {/* Overall progress bar */}
      <div
        className="w-full rounded-full h-2 mb-4"
        style={{ background: 'color-mix(in oklab, var(--border) 70%, transparent 30%)' }}
      >
        <div
          className="h-2 rounded-full transition-[width] duration-1200 ease-out"
          style={{ width: `${pct}%`, background: '#c0392b' }}
        />
      </div>

      {/* Core + Elective breakdown */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div
            className="flex justify-between text-xs mb-1"
            style={{ color: 'var(--text-muted)' }}
          >
            <span>Core</span>
            <span>{progress.core_completed_credits} / 18 credits</span>
          </div>
          <div
            className="w-full rounded-full h-1.5"
            style={{ background: 'color-mix(in oklab, var(--border) 70%, transparent 30%)' }}
          >
            <div
              className="h-1.5 rounded-full transition-[width] duration-1200 ease-out"
              style={{
                width: `${corePct}%`,
                background: '#4f6ef7',
              }}
            />
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {progress.core_remaining_count} courses remaining
          </div>
        </div>

        <div>
          <div
            className="flex justify-between text-xs mb-1"
            style={{ color: 'var(--text-muted)' }}
          >
            <span>Elective</span>
            <span>{progress.elective_completed_credits} / 18 credits</span>
          </div>
          <div
            className="w-full rounded-full h-1.5"
            style={{ background: 'color-mix(in oklab, var(--border) 70%, transparent 30%)' }}
          >
            <div
              className="h-1.5 rounded-full transition-[width] duration-1200 ease-out"
              style={{
                width: `${electivePct}%`,
                background: '#4caf82',
              }}
            />
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {progress.elective_remaining_count} courses remaining
          </div>
        </div>
      </div>
    </div>
  )
}
