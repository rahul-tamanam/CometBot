import type { CourseCard } from '@/api'

interface Props {
  course:       CourseCard
  /** Subtle accent outline — use only outside columns that already convey type. */
  highlighted?: boolean
  /** Hide the Core/Elective pill. Use when the card is inside a labeled
   *  Core/Elective column so the type is not repeated on every card. */
  hideBadge?:   boolean
}

export default function CourseCardComponent({
  course,
  highlighted,
  hideBadge,
}: Props) {
  const isCore = course.course_type === 'Core'
  const badgeColor = isCore ? '#4f6ef7' : '#4caf82'
  const badgeBg = isCore
    ? 'rgba(79,110,247,0.12)'
    : 'rgba(76,175,130,0.12)'

  return (
    <div
      className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: highlighted
          ? '0 0 0 1px var(--accent-glow)'
          : undefined,
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-xs font-mono font-semibold tracking-tight"
            style={{ color: 'var(--text)' }}
          >
            {course.course_id}
          </span>
          {!hideBadge && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide"
              style={{ color: badgeColor, background: badgeBg }}
            >
              {course.course_type}
            </span>
          )}
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {course.credits} credits
          </span>
        </div>
        <p
          className="text-sm mt-0.5 leading-snug"
          style={{ color: 'var(--text)' }}
        >
          {course.title}
        </p>
      </div>
    </div>
  )
}
