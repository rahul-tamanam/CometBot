import type { ProgressData } from '@/api'

interface Props {
  progress: ProgressData
}

export default function ProgressBar({ progress }: Props) {
  const pct = Math.min(100, progress.percent_complete)
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
          className="h-2 rounded-full transition-all duration-500"
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
              className="h-1.5 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (progress.core_completed_credits / 18) * 100)}%`,
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
              className="h-1.5 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (progress.elective_completed_credits / 18) * 100)}%`,
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
