import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, Briefcase, BarChart2,
  Send, Paperclip,
  Loader, ChevronsUpDown
} from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { CometLanding } from '@/components/ui/comet-landing'
import { LandingBackground } from '@/landing-background'
import {
  degreePlannerChat,
  degreePlannerPlan,
  careerMentorChat,
  skillsGapAnalyze,
  skillsGapAnalyzeResume
} from './api'
import type { Message } from './api'
import './App.css'

// ── Component definitions ─────────────────────────────────────────────────────

type ComponentId = 'degree-planner' | 'career-mentor' | 'skills-gap'

/** BUAN 6333-style IDs from assistant/user text — used to keep session plan in sync with Neo4j. */
function extractPlanCourseIds(text: string): string[] {
  const re = /\b([A-Z]{2,5})\s*(\d{4,5})\b/g
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    out.push(`${m[1]} ${m[2]}`.toUpperCase())
  }
  return [...new Set(out)]
}

const COMPONENTS = [
  {
    id:          'degree-planner' as ComponentId,
    label:       'Degree Planner',
    description: 'Map your course path to graduation',
    icon:        BookOpen,
    color:       '#f08a24',
    shortcut:    '⌘1',
  },
  {
    id:          'career-mentor' as ComponentId,
    label:       'Career Mentor',
    description: 'Explore careers and required skills',
    icon:        Briefcase,
    color:       '#4caf82',
    shortcut:    '⌘2',
  },
  {
    id:          'skills-gap' as ComponentId,
    label:       'Skills Gap Analyzer',
    description: 'Find what skills you are missing',
    icon:        BarChart2,
    color:       '#ff9a33',
    shortcut:    '⌘3',
  },
]

// ── useAutoResize hook ────────────────────────────────────────────────────────

function useAutoResize(minHeight = 48, maxHeight = 150) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const adjust = useCallback((reset?: boolean) => {
    const el = ref.current
    if (!el) return
    el.style.height = `${minHeight}px`
    if (!reset) {
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
    }
  }, [minHeight, maxHeight])
  return { ref, adjust }
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  // Chat state
  const [activeComponent, setActiveComponent] = useState<ComponentId | null>(null)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [messages,         setMessages]         = useState<Message[]>([])
  const [chatInput,        setChatInput]         = useState('')
  const [loading,          setLoading]           = useState(false)

  // Skills gap extra state
  const [completedCourses, setCompletedCourses] = useState('')
  const [targetJob,        setTargetJob]        = useState('')
  const [jobDescription,   setJobDescription]   = useState('')
  const [resumeFile,       setResumeFile]        = useState<File | null>(null)
  const [sgMode,           setSgMode]            = useState<'courses'|'resume'>('courses')
  const [analyzed,         setAnalyzed]          = useState(false)
  /** Hide optional pre-inputs (courses, skills gap form) after continue or skip. */
  const [preInputDismissed, setPreInputDismissed] = useState(false)

  // Degree Planner guided onboarding
  const [dpStudentType, setDpStudentType] = useState<'new' | 'current' | null>(null)
  const [dpInterests, setDpInterests] = useState<string[]>([])
  /** Raw numeric input as string (typing/clearing works; empty on blur → default). */
  const [dpCoursesPerSemesterStr, setDpCoursesPerSemesterStr] = useState('3')
  const [dpCourseHistory, setDpCourseHistory] = useState<{ course: string; semester: string }[]>([])
  const [dpCourseDraft, setDpCourseDraft] = useState({ course: '', semester: '' })
  const [dpOnboardingDone, setDpOnboardingDone] = useState(false)
  /** IDs from onboarding + assistant plans this session (sent as completed_courses for Neo4j). */
  const [dpSessionCourseIds, setDpSessionCourseIds] = useState<string[]>([])

  const { ref: chatRef, adjust: chatAdjust } = useAutoResize()
  const bottomRef  = useRef<HTMLDivElement>(null)
  const fileInput  = useRef<HTMLInputElement>(null)

  const scrollDown = () =>
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)

  // ── Select a component from palette ──────────────────────────────────────

  const selectComponent = (id: ComponentId) => {
    setActiveComponent(id)
    setMessages([])
    setAnalyzed(false)
    setPreInputDismissed(false)

    if (id === 'degree-planner') {
      setDpStudentType(null)
      setDpInterests([])
      setDpCoursesPerSemesterStr('3')
      setDpCourseHistory([])
      setDpCourseDraft({ course: '', semester: '' })
      setDpOnboardingDone(false)
      setDpSessionCourseIds([])
    }
  }

  // ── Send message ──────────────────────────────────────────────────────────

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading || !activeComponent) return

    if (!preInputDismissed) setPreInputDismissed(true)

    const userMsg: Message = { role: 'user', content: content.trim() }
    const history          = [...messages, userMsg]
    setMessages(history)
    setChatInput('')
    chatAdjust(true)
    setLoading(true)
    scrollDown()

    try {
      let response = ''

      if (activeComponent === 'degree-planner') {
        const fromField = completedCourses
          .split(',').map(c => c.trim().toUpperCase()).filter(Boolean)
        const mergedCourses = [...new Set([...dpSessionCourseIds, ...fromField])]
        const res = await degreePlannerChat({
          message:              content.trim(),
          completed_courses:    mergedCourses,
          conversation_history: messages,
          student_type:         dpStudentType ?? undefined,
          interests:            dpInterests.length ? dpInterests : undefined,
          course_history:       dpCourseHistory.length ? dpCourseHistory : undefined,
        })
        response = res.response
        setDpSessionCourseIds(prev =>
          [...new Set([...prev, ...extractPlanCourseIds(response)])]
        )

      } else if (activeComponent === 'career-mentor') {
        const res = await careerMentorChat({
          message:              content.trim(),
          conversation_history: messages
        })
        response = res.response

      } else if (activeComponent === 'skills-gap') {
        const courses = completedCourses
          .split(',').map(c => c.trim().toUpperCase()).filter(Boolean)
        const res = await skillsGapAnalyze({
          completed_courses:    courses,
          target_job:           targetJob,
          job_description:      jobDescription,
          conversation_history: messages,
          message:              content.trim()
        })
        response = res.response
      }

      setMessages([...history, { role: 'assistant', content: response }])
      scrollDown()

    } catch {
      setMessages([...history, {
        role:    'assistant',
        content: 'Something went wrong. Please make sure the backend and LM Studio are running.'
      }])
    } finally {
      setLoading(false)
    }
  }

  // ── Skills gap analysis trigger ───────────────────────────────────────────

  const runSkillsGap = async () => {
    if (loading) return
    setLoading(true)
    setAnalyzed(true)

    try {
      let response = ''

      if (sgMode === 'resume' && resumeFile) {
        if (!targetJob.trim() && !jobDescription.trim()) {
          setAnalyzed(false)
          response =
            'Please enter a target job title or paste a job description so we can compare your resume to the role.'
          setMessages([{ role: 'assistant', content: response }])
          scrollDown()
          return
        }
        const res = await skillsGapAnalyzeResume(resumeFile, targetJob, jobDescription) as {
          response?: string
          error?: string
        }
        if (res.error) {
          response = res.error
        } else {
          response = res.response ?? 'No analysis text returned. Check backend logs and LM Studio.'
        }
      } else {
        const courses = completedCourses
          .split(',').map(c => c.trim().toUpperCase()).filter(Boolean)
        const res = await skillsGapAnalyze({
          completed_courses:    courses,
          target_job:           targetJob,
          job_description:      jobDescription,
          conversation_history: [],
          message:              'Please perform a skills gap analysis.'
        }) as { response?: string; error?: string }
        if (res.error) {
          response = res.error
        } else {
          response = res.response ?? 'No analysis text returned.'
        }
      }

      setMessages([{ role: 'assistant', content: response }])
      scrollDown()

    } catch {
      setMessages([{
        role:    'assistant',
        content: 'Something went wrong. For resume upload: use a PDF, ensure the backend is running, LM Studio is up for parsing, and Pinecone/embeddings are available if job matching is used.'
      }])
    } finally {
      setLoading(false)
    }
  }

  const activeComp = COMPONENTS.find(c => c.id === activeComponent)

  // ── RENDER ────────────────────────────────────────────────────────────────

  const showChatInput =
    activeComponent !== 'skills-gap' ||
    analyzed ||
    preInputDismissed

  const dpShowWizard = activeComponent === 'degree-planner' && !dpOnboardingDone

  const parseDpCoursesPerSemester = (): number => {
    const raw = dpCoursesPerSemesterStr.trim()
    if (raw === '') return 3
    const n = parseInt(raw.replace(/\D/g, ''), 10)
    if (Number.isNaN(n)) return 3
    return Math.min(9, Math.max(0, n))
  }

  const onDpCoursesPerSemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '')
    if (digits === '') {
      setDpCoursesPerSemesterStr('')
      return
    }
    const n = parseInt(digits, 10)
    if (Number.isNaN(n)) return
    setDpCoursesPerSemesterStr(String(Math.min(9, Math.max(0, n))))
  }

  const addDpCourse = () => {
    const course = dpCourseDraft.course.trim()
    const semester = dpCourseDraft.semester.trim()
    if (!course || !semester) return
    setDpCourseHistory(h => [...h, { course, semester }])
    setDpCourseDraft({ course: '', semester: '' })
  }

  const runDpOnboarding = async () => {
    if (!dpStudentType) return
    setLoading(true)
    try {
      const completed = dpCourseHistory.map(x => x.course)
      const cps = parseDpCoursesPerSemester()

      const planRes = await degreePlannerPlan({
        completed_courses: completed,
        courses_per_semester: cps,
        max_semesters: 4,
        interests: dpInterests.length ? dpInterests : undefined,
        course_history:
          dpCourseHistory.length > 0 ? dpCourseHistory : undefined,
      })

      // Seed the chat with a deterministic first-semester plan summary.
      const first = planRes.plan[0]
      if (first?.courses?.length) {
        setDpSessionCourseIds(
          Array.from(new Set(first.courses.map(c => c.course_id.trim().toUpperCase())))
        )
      }

      const lines: string[] = []
      lines.push(dpStudentType === 'new'
        ? "Welcome! I’ll start you with a first-semester plan based on your interests."
        : "Thanks — I’ll start with a next-semester plan based on your completed courses."
      )
      if (dpInterests.length) lines.push(`Focus: ${dpInterests.join(', ')}`)
      lines.push("")
      if (first) {
        const h0 = planRes.semester_headings?.[0] ?? 'Semester 1'
        if (planRes.next_semester_label && dpStudentType === 'current') {
          lines.push(`Next term: ${planRes.next_semester_label}`)
          lines.push('')
        }
        lines.push(`${h0} (${cps} course${cps === 1 ? '' : 's'}):`)
        for (const c of first.courses) {
          lines.push(`- ${c.course_id} — ${c.title} (${c.course_type})`)
        }
      } else {
        lines.push("I couldn’t build a first semester yet (missing prerequisites/constraints).")
      }
      if (planRes.warnings?.length) {
        lines.push("")
        lines.push("Notes:")
        for (const w of planRes.warnings) lines.push(`- ${w}`)
      }

      setMessages([{ role: 'assistant', content: lines.join('\n') }])
      setDpOnboardingDone(true)
      setPreInputDismissed(true)
      scrollDown()
    } catch {
      setMessages([{ role: 'assistant', content: 'Something went wrong while building your plan. Please make sure the backend is running.' }])
      setDpOnboardingDone(true)
      setPreInputDismissed(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col text-[#e8eaf6] font-sans">
      <LandingBackground />
      <CometLanding
        onSelectComponent={selectComponent}
        compact={Boolean(activeComponent)}
        showSearch={!activeComponent}
      />

      {activeComponent && activeComp && (
        <section className="relative z-20 flex min-h-0 flex-1 flex-col px-4 pb-6 pt-2">
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col min-h-0">
            {/* Minimal assistant header — no heavy card */}
            <header className="mb-3 flex shrink-0 items-center justify-center gap-2 py-1">
              <activeComp.icon size={18} color={activeComp.color} />
              <span className="text-sm font-medium text-neutral-200">{activeComp.label}</span>
            </header>

            {/* Optional pre-inputs above the thread */}
            <AnimatePresence mode="popLayout">
              {activeComponent === 'degree-planner' && dpShowWizard && (
                <motion.div
                  key="dp-pre"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 max-h-[min(70vh,36rem)] overflow-y-auto rounded-xl border border-neutral-700/80 bg-black/40 px-4 py-3 backdrop-blur-md"
                >
                  <div className="mb-2 text-xs text-neutral-400">Degree Planner setup (quick)</div>

                  {!dpStudentType && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setDpStudentType('new')}
                        className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15"
                      >
                        New student
                      </button>
                      <button
                        type="button"
                        onClick={() => setDpStudentType('current')}
                        className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15"
                      >
                        Current student
                      </button>
                    </div>
                  )}

                  {dpStudentType === 'new' && (
                    <div className="mt-3">
                      <div className="mb-2 text-xs text-neutral-400">What are you interested in?</div>
                      <div className="flex flex-wrap gap-2">
                        {['AI/ML', 'Data Engineering', 'Cybersecurity', 'Finance', 'Marketing', 'Product/Analytics'].map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setDpInterests(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                            className={`rounded-full border px-3 py-1.5 text-xs ${
                              dpInterests.includes(t)
                                ? 'border-neutral-500 bg-white/15 text-white'
                                : 'border-neutral-700 bg-black/30 text-neutral-300 hover:text-white'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs text-neutral-400">Number of courses to take</span>
                        <input
                          inputMode="numeric"
                          autoComplete="off"
                          value={dpCoursesPerSemesterStr}
                          onChange={onDpCoursesPerSemChange}
                          onBlur={() => {
                            if (dpCoursesPerSemesterStr.trim() === '') setDpCoursesPerSemesterStr('3')
                          }}
                          className="w-16 rounded-lg border border-neutral-700/80 bg-black/40 px-2 py-1 text-xs text-white"
                        />
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={runDpOnboarding}
                          className="rounded-lg bg-[#e87500] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#ff9a33] disabled:opacity-50"
                          disabled={loading}
                        >
                          Generate my first semester
                        </button>
                        <button
                          type="button"
                          onClick={() => { setDpOnboardingDone(true); setPreInputDismissed(true) }}
                          className="rounded-lg px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200"
                        >
                          Skip setup
                        </button>
                      </div>
                    </div>
                  )}

                  {dpStudentType === 'current' && (
                    <div className="mt-3">
                      <div className="mb-2 text-xs text-neutral-400">Add the courses you’ve taken + semester</div>
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap gap-2">
                          <input
                            value={dpCourseDraft.course}
                            onChange={e => setDpCourseDraft(d => ({ ...d, course: e.target.value }))}
                            placeholder="Course (ID or name)"
                            className="min-w-[8rem] flex-1 rounded-lg border border-neutral-700/80 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-neutral-500"
                          />
                          <input
                            value={dpCourseDraft.semester}
                            onChange={e => setDpCourseDraft(d => ({ ...d, semester: e.target.value }))}
                            placeholder="Semester (e.g., Fall 2025)"
                            className="w-40 min-w-[8rem] rounded-lg border border-neutral-700/80 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-neutral-500"
                          />
                          <button
                            type="button"
                            onClick={addDpCourse}
                            className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/15"
                          >
                            Add
                          </button>
                        </div>
                        {dpCourseHistory.length > 0 && (
                          <div className="rounded-lg border border-neutral-800 bg-black/30 p-2 text-xs text-neutral-300">
                            {dpCourseHistory.map((x, idx) => (
                              <div key={`${x.course}-${x.semester}-${idx}`} className="flex items-center justify-between gap-2 py-1">
                                <span className="truncate">{x.course}</span>
                                <span className="shrink-0 text-neutral-500">{x.semester}</span>
                                <button
                                  type="button"
                                  onClick={() => setDpCourseHistory(h => h.filter((_, i) => i !== idx))}
                                  className="shrink-0 text-neutral-500 hover:text-neutral-200"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-neutral-400">Number of courses to take</span>
                          <input
                            inputMode="numeric"
                            autoComplete="off"
                            value={dpCoursesPerSemesterStr}
                            onChange={onDpCoursesPerSemChange}
                            onBlur={() => {
                              if (dpCoursesPerSemesterStr.trim() === '') setDpCoursesPerSemesterStr('3')
                            }}
                            className="w-16 rounded-lg border border-neutral-700/80 bg-black/40 px-2 py-1 text-xs text-white"
                          />
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={runDpOnboarding}
                            className="rounded-lg bg-[#e87500] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#ff9a33] disabled:opacity-50"
                            disabled={loading || dpCourseHistory.length === 0}
                          >
                            Build my next semester
                          </button>
                          <button
                            type="button"
                            onClick={() => { setDpOnboardingDone(true); setPreInputDismissed(true) }}
                            className="rounded-lg px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200"
                          >
                            Skip setup
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="popLayout">
              {activeComponent === 'skills-gap' && !analyzed && !preInputDismissed && (
                <motion.div
                  key="sg-pre"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 overflow-hidden rounded-xl border border-neutral-700/80 bg-black/40 px-4 py-3 backdrop-blur-md"
                >
                  <div className="mb-3 flex gap-2 rounded-lg bg-black/40 p-1 w-fit">
                    {(['courses', 'resume'] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setSgMode(m)}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                          sgMode === m
                            ? 'bg-neutral-700 text-white'
                            : 'text-neutral-500 hover:text-white'
                        }`}
                      >
                        {m === 'courses' ? 'Completed courses' : 'Upload resume'}
                      </button>
                    ))}
                  </div>

                  {sgMode === 'courses' ? (
                    <input
                      value={completedCourses}
                      onChange={e => setCompletedCourses(e.target.value)}
                      placeholder="Completed courses e.g. BUAN 6333, BUAN 6340"
                      className="mb-3 w-full rounded-lg border border-neutral-700/80 bg-black/50 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-500"
                    />
                  ) : (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => fileInput.current?.click()}
                      onKeyDown={e => e.key === 'Enter' && fileInput.current?.click()}
                      className="mb-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-600 py-3 text-sm text-neutral-400 hover:border-[#ff9a33]"
                    >
                      {resumeFile ? (
                        <span className="text-white">{resumeFile.name}</span>
                      ) : (
                        <>
                          <Paperclip size={14} /> PDF
                        </>
                      )}
                    </div>
                  )}

                  <input
                    ref={fileInput}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={e => setResumeFile(e.target.files?.[0] || null)}
                  />

                  <input
                    value={targetJob}
                    onChange={e => setTargetJob(e.target.value)}
                    placeholder="Target job title"
                    className="mb-3 w-full rounded-lg border border-neutral-700/80 bg-black/50 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-500"
                  />

                  <textarea
                    value={jobDescription}
                    onChange={e => setJobDescription(e.target.value)}
                    placeholder="Job description (optional)"
                    rows={2}
                    className="mb-3 w-full resize-none rounded-lg border border-neutral-700/80 bg-black/50 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-500"
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={runSkillsGap}
                      disabled={loading}
                      className="rounded-lg bg-[#ff9a33] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#e87500] disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <Loader size={14} className="inline animate-spin" /> Analyzing
                        </>
                      ) : (
                        'Run analysis'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreInputDismissed(true)}
                      className="rounded-lg px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200"
                    >
                      Skip — chat only
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Message thread — full width, no card */}
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto py-2 pb-28">
                {messages.length === 0 && !loading && (
                  <div className="flex min-h-[30vh] items-center justify-center px-4 text-center text-sm text-neutral-500">
                    {activeComponent === 'career-mentor' && (
                      <span>Ask anything about careers and skills for your program.</span>
                    )}
                    {activeComponent === 'degree-planner' && (
                      <span>
                        {preInputDismissed
                          ? 'Message CometBot below to plan your degree.'
                          : 'Add your courses above, or skip to start chatting.'}
                      </span>
                    )}
                    {activeComponent === 'skills-gap' && (
                      <span>
                        {preInputDismissed || analyzed
                          ? 'Ask follow-ups about your skills and gaps below.'
                          : 'Run an analysis above, or skip to chat without it.'}
                      </span>
                    )}
                  </div>
                )}

                <AnimatePresence initial={false}>
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      className={`mb-4 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 whitespace-pre-wrap break-words ${
                          msg.role === 'user'
                            ? 'text-sm leading-relaxed rounded-br-md text-white shadow-lg'
                            : 'border border-neutral-700/60 bg-black/35 text-[15px] font-normal leading-[1.7] tracking-normal text-neutral-100/95 antialiased backdrop-blur-sm'
                        }`}
                        style={
                          msg.role === 'user'
                            ? { backgroundColor: activeComp.color }
                            : undefined
                        }
                      >
                        {msg.content}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {loading && (
                  <motion.div
                    className="mb-4 flex justify-start"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className="flex items-center gap-2 rounded-2xl border border-neutral-700/60 bg-black/35 px-4 py-3 text-sm text-neutral-400 backdrop-blur-sm">
                      <Loader size={14} className="animate-spin" />
                      Thinking…
                    </div>
                  </motion.div>
                )}

                <div ref={bottomRef} />
              </div>
            </div>

            {/* Composer — sticky, glass bar */}
            <div className="sticky bottom-0 z-10 -mx-1 border-t border-neutral-800/60 bg-gradient-to-t from-black/50 to-transparent pb-2 pt-3">
              <div className="flex items-end gap-2">
                <div className="relative z-30 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSwitcherOpen(s => !s)}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-700/80 bg-black/50 text-neutral-300 backdrop-blur-md hover:bg-black/70 hover:text-white"
                    title="Change assistant"
                  >
                    <ChevronsUpDown size={16} />
                  </button>
                  {switcherOpen && (
                    <div className="absolute bottom-full left-0 z-50 mb-2 w-56 rounded-xl border border-neutral-700/80 bg-black/80 p-1 shadow-2xl backdrop-blur-xl">
                      {COMPONENTS.map(comp => {
                        const Icon = comp.icon
                        return (
                          <button
                            key={comp.id}
                            type="button"
                            onClick={() => {
                              selectComponent(comp.id)
                              setSwitcherOpen(false)
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-left text-sm text-neutral-100 hover:bg-white/10"
                          >
                            <Icon size={14} color={comp.color} />
                            {comp.label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {showChatInput && (
                  <div className="relative min-w-0 flex-1 rounded-2xl border border-neutral-700/80 bg-black/45 shadow-xl backdrop-blur-xl">
                    <Textarea
                      ref={chatRef}
                      value={chatInput}
                      onFocus={() => {
                        if (!preInputDismissed) setPreInputDismissed(true)
                      }}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                        setChatInput(e.target.value)
                        chatAdjust()
                      }}
                      onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          sendMessage(chatInput)
                        }
                      }}
                      placeholder={
                        activeComponent === 'degree-planner'
                          ? 'Message CometBot about courses, prerequisites, or graduation…'
                          : activeComponent === 'career-mentor'
                            ? 'Ask about careers, roles, or skills…'
                            : 'Ask about your skills gap or next steps…'
                      }
                      className="min-h-[52px] w-full resize-none border-0 bg-transparent px-4 pt-3 pb-2 text-sm text-white placeholder:text-neutral-500 focus-visible:ring-0"
                      disabled={loading}
                    />
                    <div className="flex items-center justify-between px-3 pb-2">
                      <span className="text-[11px] text-neutral-500">
                        Enter to send · Shift+Enter for new line
                      </span>
                      <button
                        type="button"
                        onClick={() => sendMessage(chatInput)}
                        disabled={loading || !chatInput.trim()}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-white transition-opacity disabled:opacity-30"
                        style={{ background: activeComp.color }}
                      >
                        <Send size={15} color="white" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}