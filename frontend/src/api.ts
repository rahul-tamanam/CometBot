import axios from 'axios'

const BASE = 'http://localhost:8000/api'

export interface Message {
  role:    'user' | 'assistant'
  content: string
}

// ── Degree Planner ────────────────────────────────────────────────────────────

export interface DegreePlannerRequest {
  message:              string
  completed_courses:    string[]
  conversation_history: Message[]
  student_type?:        'new' | 'current'
  interests?:           string[]
  course_history?:      { course: string; semester: string }[]
}

export interface DegreePlannerResponse {
  response:         string
  corrections:      any[]
  removed:          any[]
  progress:         {
    total_completed:    number
    core_completed:     number
    elective_completed: number
    total_remaining:    number
    core_remaining:     number
    elective_remaining: number
    percent_complete:   number
  }
  invalid_courses:  any[]
  eligible_count:   number
  // Present when backend returns a deterministic plan via chat trigger
  plan?:            { semester: number; courses: { course_id: string; title: string; course_type: string }[] }[]
  warnings?:        string[]
}

export const degreePlannerChat = async (
  data: DegreePlannerRequest
): Promise<DegreePlannerResponse> => {
  const res = await axios.post(`${BASE}/degree-planner/chat`, data)
  return res.data
}

export interface DegreePlannerPlanRequest {
  completed_courses:    string[]
  courses_per_semester?: number
  max_semesters?:        number
  core_per_semester?:    number | null
  elective_per_semester?: number | null
  interests?:            string[]
  course_history?:       { course: string; semester: string }[]
}

export interface DegreePlannerPlanResponse {
  plan: { semester: number; courses: { course_id: string; title: string; course_type: string }[] }[]
  warnings: string[]
  progress: {
    total_completed: number
    core_completed: number
    elective_completed: number
    total_remaining: number
    core_remaining: number
    elective_remaining: number
    percent_complete: number
  }
  invalid_courses: any[]
  next_semester_label?: string | null
  semester_headings?:   string[]
}

export const degreePlannerPlan = async (
  data: DegreePlannerPlanRequest
): Promise<DegreePlannerPlanResponse> => {
  const res = await axios.post(`${BASE}/degree-planner/plan`, data)
  return res.data
}

// ── Career Mentor ─────────────────────────────────────────────────────────────

export interface CareerMentorRequest {
  message:              string
  conversation_history: Message[]
}

export interface CareerMentorResponse {
  response:    string
  corrections: any[]
  removed:     any[]
  job_role:    {
    job_title:        string
    technical_skills: string[]
    soft_skills:      string[]
    score:            number
  } | null
}

export const careerMentorChat = async (
  data: CareerMentorRequest
): Promise<CareerMentorResponse> => {
  const res = await axios.post(`${BASE}/career-mentor/chat`, data)
  return res.data
}

// ── Skills Gap ────────────────────────────────────────────────────────────────

export interface SkillsGapRequest {
  completed_courses:    string[]
  target_job:           string
  conversation_history: Message[]
  message:              string
}

export interface SkillsGapResponse {
  response:           string
  corrections:        any[]
  removed:            any[]
  job_role:           any
  confidence_warning: string | null
  gap: {
    matched:           { skill: string; type: string }[]
    missing_technical: string[]
    missing_soft:      string[]
  }
  recommendations:    Record<string, { course_id: string; title: string }[]>
  student_skills:     string[]
  invalid_courses:    any[]
  /** Present for resume upload when structured LLM parse failed but keyword fallback ran */
  resume_parse_note?: string | null
  resume_data?:      Record<string, unknown>
}

export const skillsGapAnalyze = async (
  data: SkillsGapRequest
): Promise<SkillsGapResponse> => {
  const res = await axios.post(`${BASE}/skills-gap/analyze`, data)
  return res.data
}
// ── Skills Gap — resume upload ────────────────────────────────────────────────

export const skillsGapAnalyzeResume = async (
  file:           File,
  targetJob:      string,
  jobDescription: string
): Promise<SkillsGapResponse> => {
  const form = new FormData()
  form.append('file',            file)
  form.append('target_job',      targetJob)
  form.append('job_description', jobDescription)

  // Let axios set multipart boundary automatically — a manual Content-Type breaks uploads.
  const res = await axios.post(`${BASE}/skills-gap/analyze-resume`, form)
  return res.data
}
export interface SkillsGapRequest {
  completed_courses:    string[]
  target_job:           string
  job_description:      string    
  conversation_history: Message[]
  message:              string
}