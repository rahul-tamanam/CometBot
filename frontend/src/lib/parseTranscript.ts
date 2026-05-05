import * as pdfjsLib from 'pdfjs-dist'
import type { ProfileSemester } from '@/hooks/useProfile'
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc

export type ParsedProgram = {
  id: string
  name: string
  type: string
}

export type ParseTranscriptResult = {
  programs: ParsedProgram[]
  semesters: ProfileSemester[]
  /** Display titles keyed by normalized course code e.g. "BUAN 6320" */
  courseTitles: Record<string, string>
}

const SEMESTER_LINE = /\b(Fall|Spring|Summer|Winter)\s+(\d{4})\b/i
const COURSE_CODE = /\b([A-Z]{2,4})\s*(\d{4})\b/

function uid() {
  return `p-${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`
}

function normalizeCode(a: string, b: string) {
  return `${a.toUpperCase()} ${b}`.replace(/\s+/g, ' ').trim()
}

function inferProgramType(line: string): string {
  const l = line.toLowerCase()
  if (l.includes('certificate')) return 'Graduate Certificate'
  if (l.includes('bachelor')) return 'Bachelor'
  if (l.includes('doctor') || l.includes(' phd')) return 'Doctoral'
  if (l.includes('master')) return 'Master'
  return 'Program'
}

/** Extract logical lines from PDF.js text items (preserves hasEOL breaks). */
async function extractLines(data: ArrayBuffer): Promise<string[]> {
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const lines: string[] = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const text = await page.getTextContent()
    let buf = ''
    for (const item of text.items) {
      const any = item as { str?: string; hasEOL?: boolean }
      const s = any.str ?? ''
      buf += s
      if (any.hasEOL) {
        const t = buf.trim()
        if (t) lines.push(t)
        buf = ''
      }
    }
    const tail = buf.trim()
    if (tail) lines.push(tail)
  }

  return lines
}

function scanProgramsFromText(fullText: string): ParsedProgram[] {
  const programs: ParsedProgram[] = []
  const seen = new Set<string>()
  const kw = /(Master|Bachelor|Certificate|Graduate Certificate|Doctor of|Ph\.?D\.?)/i
  const rawLines = fullText.split(/\r?\n/)

  for (const raw of rawLines) {
    const line = raw.trim()
    if (!line || line.length < 8) continue
    if (!kw.test(line)) continue
    if (/^(Fall|Spring|Summer|Winter)\s+\d{4}/i.test(line)) continue
    if (/^[A-Z]{2,4}\s*\d{4}/.test(line)) continue
    const key = line.slice(0, 120)
    if (seen.has(key)) continue
    seen.add(key)
    programs.push({
      id: uid(),
      name: line.slice(0, 200),
      type: inferProgramType(line),
    })
  }

  return programs
}

/**
 * Parses UTD SSR_TSRPT-style PDFs client-side.
 * Heuristic: semester headers, course codes on lines, programs from degree keywords.
 */
export async function parseTranscript(data: ArrayBuffer): Promise<ParseTranscriptResult> {
  const lines = await extractLines(data)
  const fullText = lines.join('\n')

  const programs = scanProgramsFromText(fullText)
  const semesters: ProfileSemester[] = []
  const courseTitles: Record<string, string> = {}

  let current: ProfileSemester | null = null

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    const sm = line.match(SEMESTER_LINE)
    if (sm) {
      const label = `${sm[1].charAt(0).toUpperCase() + sm[1].slice(1).toLowerCase()} ${sm[2]}`
      current = { id: uid(), label, courses: [] }
      semesters.push(current)
      continue
    }

    const cm = line.match(COURSE_CODE)
    if (cm) {
      const code = normalizeCode(cm[1], cm[2])
      const idx = cm.index ?? line.search(COURSE_CODE)
      const after = idx >= 0 ? line.slice(idx + cm[0].length) : ''
      const title = after.replace(/^[\s\-–—:]+/, '').trim()
      if (title) courseTitles[code] = title

      const bucket = current ?? (() => {
        const s: ProfileSemester = { id: uid(), label: 'Transfer / Unassigned', courses: [] }
        semesters.push(s)
        current = s
        return s
      })()

      if (!bucket.courses.includes(code)) {
        bucket.courses.push(code)
      }
    }
  }

  return { programs, semesters, courseTitles }
}
