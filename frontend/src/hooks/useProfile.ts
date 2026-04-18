import { useEffect, useMemo, useState } from 'react'

export type ProfileSemester = {
  id: string
  label: string
  courses: string[]
}

export type CometbotProfile = {
  fullName: string
  studentId: string
  email: string
  program: 'MSBA'
  background: string
  semesters: ProfileSemester[]
}

const STORAGE_KEY = 'cometbot_profile'

const DEFAULT_PROFILE: CometbotProfile = {
  fullName: '',
  studentId: '',
  email: '',
  program: 'MSBA',
  background: '',
  semesters: [],
}

function safeParse(jsonText: string | null): unknown {
  if (!jsonText) return null
  try {
    return JSON.parse(jsonText)
  } catch {
    return null
  }
}

function normalizeCourseId(v: string) {
  return (v || '').trim().toUpperCase().replace(/\s+/g, ' ')
}

function coerceProfile(raw: unknown): CometbotProfile {
  if (!raw || typeof raw !== 'object') return DEFAULT_PROFILE
  const r = raw as Partial<CometbotProfile>
  const semesters: ProfileSemester[] = Array.isArray(r.semesters)
    ? r.semesters
        .filter((s): s is ProfileSemester => !!s && typeof s === 'object')
        .map((s: any) => ({
          id: String(s.id || ''),
          label: String(s.label || ''),
          courses: Array.isArray(s.courses) ? s.courses.map((c: any) => String(c)) : [],
        }))
        .filter((s) => s.id && s.label)
    : []

  return {
    fullName: String(r.fullName ?? ''),
    studentId: String(r.studentId ?? ''),
    email: String(r.email ?? ''),
    program: 'MSBA',
    background: String(r.background ?? ''),
    semesters,
  }
}

export function useProfile() {
  const [profile, setProfile] = useState<CometbotProfile>(() => {
    try {
      const raw = safeParse(localStorage.getItem(STORAGE_KEY))
      return coerceProfile(raw)
    } catch {
      return DEFAULT_PROFILE
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
    } catch {
      // ignore storage errors (quota/disabled)
    }
  }, [profile])

  const saveProfile = (data: CometbotProfile | ((prev: CometbotProfile) => CometbotProfile)) => {
    setProfile((prev) => (typeof data === 'function' ? (data as any)(prev) : data))
  }

  const getCompletedCourses = () => {
    const all = profile.semesters.flatMap((s) => s.courses || [])
    const seen = new Set<string>()
    const out: string[] = []
    for (const c of all) {
      const n = normalizeCourseId(c)
      if (!n) continue
      if (!seen.has(n)) {
        seen.add(n)
        out.push(n)
      }
    }
    return out
  }

  const isNewStudent = () => getCompletedCourses().length === 0

  const resetProfile = () => {
    setProfile(DEFAULT_PROFILE)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  const completedCourses = useMemo(() => getCompletedCourses(), [profile.semesters])

  return {
    profile,
    saveProfile,
    resetProfile,
    getCompletedCourses,
    completedCourses,
    isNewStudent,
  }
}

