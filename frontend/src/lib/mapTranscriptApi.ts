import type { ProfileSemester } from '@/hooks/useProfile'
import type { ParsedProgram, ParseTranscriptResult } from '@/lib/parseTranscript'

/** Shape returned by FastAPI `/api/parse-transcript` (`transcript_data` field). */
export type TranscriptApiData = {
  majors?: Array<{
    name: string
    start_date?: string
    program_level?: string
  }>
  minors?: Array<{ name: string; start_date?: string }>
  certifications?: Array<{ name: string; start_date?: string }>
  courses?: {
    utd_classes?: Record<
      string,
      Array<{
        course_code: string
        course_name?: string
      }>
    >
    transfer_credits?: unknown[]
    test_credits?: unknown[]
  }
}

function normalizeCourseCode(code: string) {
  return code.replace(/\s+/g, ' ').trim().toUpperCase()
}

export function mapTranscriptApiToParseResult(data: TranscriptApiData): ParseTranscriptResult {
  const programs: ParsedProgram[] = []

  for (const m of data.majors ?? []) {
    programs.push({
      id: `${m.name}-${m.start_date ?? ''}`,
      name: m.name,
      type: 'Master',
    })
  }

  for (const c of data.certifications ?? []) {
    programs.push({
      id: `${c.name}-${c.start_date ?? ''}`,
      name: `Graduate Certificate in ${c.name}`,
      type: 'Graduate Certificate',
    })
  }

  for (const mn of data.minors ?? []) {
    programs.push({
      id: `${mn.name}-${mn.start_date ?? ''}`,
      name: mn.name,
      type: 'Minor',
    })
  }

  const semesters: ProfileSemester[] = []
  const courseTitles: Record<string, string> = {}
  const utd = data.courses?.utd_classes ?? {}

  for (const [label, courses] of Object.entries(utd)) {
    const codes: string[] = []
    for (const row of courses) {
      const code = normalizeCourseCode(row.course_code)
      codes.push(code)
      const title = row.course_name?.trim()
      if (title) courseTitles[code] = title
    }
    semesters.push({
      id: `sem-${label.replace(/\s+/g, '-')}`,
      label,
      courses: codes,
    })
  }

  return { programs, semesters, courseTitles }
}
