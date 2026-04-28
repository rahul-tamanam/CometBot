import type { SemesterBlock } from '@/api'
import CourseCardComponent from './CourseCardComponent'

interface Props {
  semesters: SemesterBlock[]
}

export default function SemesterTimeline({ semesters }: Props) {
  if (!semesters || semesters.length === 0) return null

  return (
    <div className="w-full mt-2">
      <h3
        className="text-sm font-semibold mb-3"
        style={{ color: 'var(--text)' }}
      >
        Semester Plan
      </h3>
      <div className="relative">
        {/* Vertical timeline line */}
        <div
          className="absolute left-3 top-0 bottom-0 w-px"
          style={{ background: 'var(--border)' }}
        />

        <div className="flex flex-col gap-6">
          {semesters.map((sem, i) => (
            <div key={i} className="relative pl-10">
              {/* Timeline dot */}
              <div
                className="absolute left-0 top-1 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold"
                style={{
                  borderColor: '#c0392b',
                  background: 'var(--surface)',
                  color: '#c0392b',
                }}
              >
                {i + 1}
              </div>

              <div className="mb-2">
                <span
                  className="text-sm font-semibold"
                  style={{ color: 'var(--text)' }}
                >
                  {sem.label}
                </span>
                <span
                  className="text-xs ml-2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {sem.courses.length} courses · {sem.courses.length * 3} credits
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {sem.courses.map((course, j) => (
                  <CourseCardComponent key={j} course={course} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
