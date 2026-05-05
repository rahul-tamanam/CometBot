import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2, Pencil, Upload } from 'lucide-react'
import { AnimatedText } from '@/components/ui/animated-shiny-text'
import useFileUpload from '@/hooks/useFileUpload'
import { useProfile, type ProfileSemester } from '@/hooks/useProfile'
import { mapTranscriptApiToParseResult, type TranscriptApiData } from '@/lib/mapTranscriptApi'
import { parseTranscript, type ParsedProgram, type ParseTranscriptResult } from '@/lib/parseTranscript'

const ONBOARDING_COMPLETE_KEY = 'cometbot_onboarding_complete'

const ONBOARDING_BG = '#FAF7F2'

type Step =
  | 'landing'
  | 'program'
  | 'upload'
  | 'confirm-programs'
  | 'confirm-classes'

type StudentType = 'new' | 'current'

type ProgramId = 'msba' | 'msitm'

const PROGRAM_OPTIONS: {
  id: ProgramId
  name: string
  description: string
}[] = [
  {
    id: 'msba',
    name: 'MS in Business Analytics & AI',
    description: 'Analytics, ML, and business intelligence focus.',
  },
  {
    id: 'msitm',
    name: 'MS in Information Technology & Management',
    description: 'IT leadership, systems, and digital strategy.',
  },
]

function programNameFor(id: ProgramId) {
  return id === 'msitm'
    ? 'MS in Information Technology and Management'
    : 'MS in Business Analytics and Artificial Intelligence'
}

type ProgramRow = ParsedProgram & { status: 'In Progress' | 'Completed' | 'Not Mine' }

function markOnboardingComplete() {
  try {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true')
  } catch {
    // ignore
  }
}

function cloneSemesters(s: ProfileSemester[]): ProfileSemester[] {
  return s.map((sem) => ({
    id: sem.id,
    label: sem.label,
    courses: [...sem.courses],
  }))
}

const TRANSCRIPT_API = (import.meta.env.VITE_TRANSCRIPTPARSER_API ?? '').trim()

/** Quadratic bezier ~ M 8vw 85vh Q 25vw 20vh 58vw 32vh at ~1280×800 reference */
const COMET_PATH_D = 'M 120 680 Q 380 160 870 290'

const COMET_P0 = [120, 680] as const
const COMET_P1 = [380, 160] as const
const COMET_P2 = [870, 290] as const

function quadBezierPoint(t: number): readonly [number, number] {
  const u = 1 - t
  const x = u * u * COMET_P0[0] + 2 * u * t * COMET_P1[0] + t * t * COMET_P2[0]
  const y = u * u * COMET_P0[1] + 2 * u * t * COMET_P1[1] + t * t * COMET_P2[1]
  return [x, y]
}

const COMET_FRAME_N = 48
const COMET_TIMES = Array.from({ length: COMET_FRAME_N + 1 }, (_, i) => i / COMET_FRAME_N)
const COMET_CX = COMET_TIMES.map((t) => quadBezierPoint(t)[0])
const COMET_CY = COMET_TIMES.map((t) => quadBezierPoint(t)[1])
/** Fade in early, hold, fade out — aligned to path progress */
const COMET_HEAD_OPACITY = COMET_TIMES.map((t) => {
  if (t < 0.06) return t / 0.06
  if (t > 0.78) return Math.max(0, 1 - (t - 0.78) / 0.22)
  return 1
})
const COMET_HALO_OPACITY = COMET_TIMES.map((t) => {
  if (t < 0.06) return (t / 0.06) * 0.6
  if (t > 0.78) return Math.max(0, 0.6 * (1 - (t - 0.78) / 0.22))
  return 0.6
})

function CometAnimation() {
  return (
    <svg
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 5,
        overflow: 'visible',
      }}
      aria-hidden
    >
      <defs>
        <linearGradient id="cometTail" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FE6507" stopOpacity={0} />
          <stop offset="60%" stopColor="#FE6507" stopOpacity={0.15} />
          <stop offset="100%" stopColor="#FE6507" stopOpacity={0.7} />
        </linearGradient>
        <filter id="cometGlow">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <motion.path
        d={COMET_PATH_D}
        stroke="url(#cometTail)"
        strokeWidth={18}
        fill="none"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: [0, 1, 1, 0] }}
        transition={{
          pathLength: { duration: 1.2, ease: 'easeInOut' },
          opacity: {
            duration: 1.4,
            times: [0, 0.1, 0.7, 1],
            ease: 'easeInOut',
          },
        }}
      />

      <motion.path
        d={COMET_PATH_D}
        stroke="#FE6507"
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        opacity={0.4}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
      />

      <motion.circle
        r={8}
        fill="#FE6507"
        filter="url(#cometGlow)"
        initial={{ cx: COMET_CX[0], cy: COMET_CY[0], opacity: COMET_HEAD_OPACITY[0] }}
        animate={{ cx: COMET_CX, cy: COMET_CY, opacity: COMET_HEAD_OPACITY }}
        transition={{
          duration: 1.2,
          ease: 'easeInOut',
          times: COMET_TIMES,
        }}
      />

      <motion.circle
        r={16}
        fill="rgba(254,101,7,0.2)"
        initial={{ cx: COMET_CX[0], cy: COMET_CY[0], opacity: COMET_HALO_OPACITY[0] }}
        animate={{ cx: COMET_CX, cy: COMET_CY, opacity: COMET_HALO_OPACITY }}
        transition={{
          duration: 1.2,
          ease: 'easeInOut',
          times: COMET_TIMES,
        }}
      />
    </svg>
  )
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { saveProfile } = useProfile()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { selectedFile, isUploading, handleFileChange, uploadFile, selectFile } =
    useFileUpload(TRANSCRIPT_API)

  const [step, setStep] = useState<Step>('landing')
  const [studentType, setStudentType] = useState<StudentType | null>(null)
  const [programId, setProgramId] = useState<ProgramId | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<ParseTranscriptResult | null>(null)
  const [programRows, setProgramRows] = useState<ProgramRow[]>([])
  const [semestersDraft, setSemestersDraft] = useState<ProfileSemester[]>([])
  const [editingSemesterId, setEditingSemesterId] = useState<string | null>(null)

  const goDashboard = useCallback(() => {
    markOnboardingComplete()
    navigate('/', { replace: true })
  }, [navigate])

  const startProgramRows = useCallback((data: TranscriptApiData | ParseTranscriptResult) => {
    // API `/parse-transcript` shape: separate majors / certifications / minors
    if (
      typeof data === 'object' &&
      data !== null &&
      ('majors' in data || 'certifications' in data || 'minors' in data)
    ) {
      const d = data as TranscriptApiData
      const rows: ProgramRow[] = [
        ...(d.majors ?? []).map((m) => ({
          id: `${m.name}-${m.start_date ?? ''}`,
          name: m.name,
          type: 'Master',
          status: 'In Progress' as const,
        })),
        ...(d.certifications ?? []).map((c) => ({
          id: `${c.name}-${c.start_date ?? ''}`,
          name: `Graduate Certificate in ${c.name}`,
          type: 'Graduate Certificate',
          status: 'In Progress' as const,
        })),
        ...(d.minors ?? []).map((m) => ({
          id: `${m.name}-${m.start_date ?? ''}`,
          name: m.name,
          type: 'Minor',
          status: 'In Progress' as const,
        })),
      ]
      setProgramRows(
        rows.length > 0
          ? rows
          : [
              {
                id: `synthetic-${Date.now()}`,
                name: 'Program not detected — add manually',
                type: 'Master',
                status: 'In Progress' as const,
              },
            ],
      )
      return
    }

    const pr = data as ParseTranscriptResult
    const rows: ProgramRow[] =
      pr.programs.length > 0
        ? pr.programs.map((p) => ({ ...p, status: 'In Progress' as const }))
        : [
            {
              id: `synthetic-${Date.now()}`,
              name: 'Program not detected — add manually',
              type: 'Master',
              status: 'In Progress' as const,
            },
          ]
    setProgramRows(rows)
  }, [])

  /** New students only — program step → dashboard with chosen MSBA/MSITM. */
  const handleNewStudentContinue = () => {
    if (!programId) return
    saveProfile((prev) => ({
      ...prev,
      program_id: programId,
      program_name: programNameFor(programId),
      semesters: [],
    }))
    goDashboard()
  }

  const handleFilePick = () => fileInputRef.current?.click()

  const handleUploadSubmit = async () => {
    if (!selectedFile) return
    setParsing(true)
    try {
      if (TRANSCRIPT_API) {
        const response = (await uploadFile('user-123', null)) as {
          message?: string
          transcript_data?: TranscriptApiData
        }
        if (response?.message !== 'Transcript processed successfully' || !response.transcript_data) {
          throw new Error('Transcript parser returned an unexpected response.')
        }
        const td = response.transcript_data
        setParsed(mapTranscriptApiToParseResult(td))
        startProgramRows(td)
        if (studentType === 'current') {
          const primaryMajor = td.majors?.[0]
          if (primaryMajor?.name) {
            saveProfile((prev) => ({
              ...prev,
              program_name: primaryMajor.name,
              semesters: prev.semesters,
            }))
          }
        }
      } else {
        const buf = await selectedFile.arrayBuffer()
        const result = await parseTranscript(buf)
        setParsed(result)
        startProgramRows(result)
        if (studentType === 'current') {
          const master = result.programs.find(
            (p) => p.type === 'Master' || p.type === 'Program',
          )
          const primary = master ?? result.programs[0]
          if (primary?.name) {
            saveProfile((prev) => ({
              ...prev,
              program_name: primary.name,
              semesters: prev.semesters,
            }))
          }
        }
      }
      setStep('confirm-programs')
    } catch {
    } finally {
      setParsing(false)
    }
  }

  const handleConfirmProgramsNext = () => {
    if (!parsed) return
    setSemestersDraft(cloneSemesters(parsed.semesters))
    setStep('confirm-classes')
  }

  const handleClassesDone = () => {
    if (studentType === 'new') {
      if (!programId) return
      saveProfile((prev) => ({
        ...prev,
        program_id: programId,
        program_name: programNameFor(programId),
        semesters: cloneSemesters(semestersDraft),
      }))
    } else {
      const primaryMajor = parsed?.programs?.find((p) => p.type === 'Master')
      saveProfile((prev) => ({
        ...prev,
        program_name: primaryMajor?.name ?? prev.program_name,
        semesters: cloneSemesters(semestersDraft),
      }))
    }
    goDashboard()
  }

  const updateSemesterLabel = (id: string, label: string) => {
    setSemestersDraft((rows) => rows.map((r) => (r.id === id ? { ...r, label } : r)))
  }

  const updateCourseCode = (semId: string, courseIndex: number, code: string) => {
    setSemestersDraft((rows) =>
      rows.map((r) => {
        if (r.id !== semId) return r
        const courses = [...r.courses]
        courses[courseIndex] = code.trim().toUpperCase()
        return { ...r, courses }
      }),
    )
  }

  const addProgramRow = () => {
    setProgramRows((r) => [
      ...r,
      {
        id: `manual-${Date.now()}`,
        name: '',
        type: 'Master',
        status: 'In Progress',
      },
    ])
  }

  const updateProgramRow = (id: string, patch: Partial<ProgramRow>) => {
    setProgramRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const courseTitles = parsed?.courseTitles ?? {}

  const panelCardClass =
    'w-full max-w-xl rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-2xl'

  const widePanelClass =
    'relative w-full max-w-2xl rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-2xl'

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden text-[color:var(--text)]"
      style={{ backgroundColor: ONBOARDING_BG }}
    >
      {step === 'landing' && <CometAnimation />}

      <div className="relative z-10 flex min-h-screen flex-col">
        {step === 'landing' && (
          <div
            className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-16"
            style={{ background: '#FAF7F2' }}
          >
            <div
              style={{
                position: 'absolute',
                bottom: '-80px',
                left: '-60px',
                width: '420px',
                height: '380px',
                background:
                  'radial-gradient(ellipse, rgba(255,180,120,0.45) 0%, rgba(255,160,100,0.15) 50%, transparent 70%)',
                borderRadius: '60% 40% 70% 30% / 50% 60% 40% 50%',
                filter: 'blur(40px)',
                zIndex: 0,
                pointerEvents: 'none',
              }}
              aria-hidden
            />
            {[
              { top: '15%', right: '8%', size: 12, opacity: 0.4 },
              { top: '25%', right: '12%', size: 8, opacity: 0.3 },
              { top: '10%', right: '18%', size: 18, opacity: 0.25 },
            ].map((dot, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: dot.top,
                  right: dot.right,
                  width: dot.size,
                  height: dot.size,
                  background: '#A8C5A0',
                  borderRadius: '50%',
                  opacity: dot.opacity,
                  zIndex: 0,
                  pointerEvents: 'none',
                }}
                aria-hidden
              />
            ))}
            {[
              { top: '30%', left: '15%' },
              { top: '20%', right: '30%' },
              { bottom: '35%', right: '20%' },
            ].map((pos, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  ...pos,
                  color: '#E8C84A',
                  fontSize: '20px',
                  opacity: 0.65,
                  zIndex: 0,
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
                aria-hidden
              >
                ✦
              </div>
            ))}
            <div className="relative z-10 flex flex-col items-center">
              <AnimatedText
                text="CometBot"
                gradientColors="linear-gradient(90deg, #ffd3a1 0%, #e87500 35%, #f5b56d 60%, #159647 100%)"
                gradientAnimationDuration={2.2}
                textClassName="font-bold tracking-tight text-5xl sm:text-6xl md:text-7xl"
                className="py-4"
              />
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.45 }}
                className="mt-2 max-w-lg text-center text-base text-[color:var(--text-muted)] sm:text-lg"
              >
                UTD&apos;s AI-powered academic and career advisor
              </motion.p>
              <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:gap-6">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="rounded-full border-2 border-[#ff7a1a] px-10 py-3 text-sm font-semibold text-[#ff7a1a] transition-colors hover:bg-[#ff7a1a] hover:text-white"
                  onClick={() => {
                    setStudentType('new')
                    setStep('program')
                  }}
                >
                  New Student
                </motion.button>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="rounded-full bg-[#0f6b44] px-10 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#13724f]"
                  onClick={() => {
                    setStudentType('current')
                    setStep('upload')
                  }}
                >
                  Current Student
                </motion.button>
              </div>
            </div>
          </div>
        )}

        {step === 'program' && (
          <div className="flex flex-1 flex-col items-center px-4 py-14">
            <h2 className="text-center text-2xl font-bold tracking-tight text-[color:var(--text)] sm:text-3xl">
              What are you studying?
            </h2>
            <div className="mt-10 grid w-full max-w-3xl gap-4 sm:grid-cols-2">
              {PROGRAM_OPTIONS.map((opt) => {
                const selected = programId === opt.id
                return (
                  <motion.button
                    key={opt.id}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setProgramId(opt.id)}
                    className={`rounded-2xl border-2 p-6 text-left transition-all ${
                      selected
                        ? 'border-[#0f6b44] bg-[color-mix(in_oklab,#0f6b44_18%,var(--surface)_82%)] ring-2 ring-[#0f6b44]/40'
                        : 'border-[color:var(--border)] bg-[color:var(--surface)] hover:border-[#13724f]/50'
                    }`}
                  >
                    <div className="font-bold text-[color:var(--text)]">{opt.name}</div>
                    <p className="mt-2 text-sm text-[color:var(--text-muted)]">{opt.description}</p>
                  </motion.button>
                )
              })}
            </div>
            <motion.button
              type="button"
              disabled={!programId}
              whileHover={programId ? { scale: 1.03 } : {}}
              whileTap={programId ? { scale: 0.97 } : {}}
              className="mt-10 rounded-full bg-[#0f6b44] px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#13724f] disabled:cursor-not-allowed disabled:opacity-40"
              onClick={handleNewStudentContinue}
            >
              Continue →
            </motion.button>
          </div>
        )}

        {step === 'upload' && (
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
            <div className={panelCardClass}>
              <h2 className="text-2xl font-bold text-[color:var(--text)]">Let&apos;s get started!</h2>
              <p className="mt-2 font-medium text-[color:var(--text)]">Upload your unofficial transcript</p>
              <p className="mt-2 text-sm leading-relaxed text-[color:var(--text-muted)]">
                This will allow us to automatically fill in your past classes. The file is likely named
                SSR_TSRPT.pdf
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={handleFilePick}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const f = e.dataTransfer.files?.[0]
                  if (f && (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))) {
                    selectFile(f)
                  }
                }}
                className="mt-8 flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[color:var(--border)] bg-[color-mix(in_oklab,var(--surface)_92%,#0f6b44_8%)] py-12 transition-colors hover:border-[#0f6b44]"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0f6b44] text-white">
                  <Upload className="h-7 w-7" aria-hidden />
                </span>
                <span className="mt-4 text-sm font-medium text-[color:var(--text)]">
                  Click here to upload or drag and drop
                </span>
                {selectedFile && (
                  <span className="mt-2 text-xs text-[color:var(--text-muted)]">{selectedFile.name}</span>
                )}
              </button>
              <div className="mt-6 flex justify-end">
                <motion.button
                  type="button"
                  disabled={!selectedFile || parsing || isUploading}
                  whileHover={selectedFile && !parsing && !isUploading ? { scale: 1.03 } : {}}
                  whileTap={selectedFile && !parsing && !isUploading ? { scale: 0.97 } : {}}
                  className="inline-flex items-center gap-2 rounded-full bg-[#0f6b44] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#13724f] disabled:opacity-40"
                  onClick={() => void handleUploadSubmit()}
                >
                  {(parsing || isUploading) && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  Upload
                </motion.button>
              </div>
            </div>
          </div>
        )}

        {step === 'confirm-programs' && (
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
            <div className={panelCardClass}>
              <h2 className="text-2xl font-bold text-[color:var(--text)]">Are these programs right?</h2>
              <p className="mt-2 text-sm text-[color:var(--text-muted)]">
                We detected these programs on your transcript — let us know which ones you&apos;re still working
                on.
              </p>
              <ul className="mt-6 space-y-3">
                {programRows.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-col gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface2)] p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      {!row.name.trim() ? (
                        <input
                          value={row.name}
                          onChange={(e) => updateProgramRow(row.id, { name: e.target.value })}
                          placeholder="Program name"
                          className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm font-bold text-[color:var(--text)]"
                        />
                      ) : (
                        <div className="font-bold text-[color:var(--text)]">{row.name}</div>
                      )}
                      <div className="text-xs text-[color:var(--text-muted)]">{row.type}</div>
                    </div>
                    <select
                      value={row.status}
                      onChange={(e) =>
                        updateProgramRow(row.id, {
                          status: e.target.value as ProgramRow['status'],
                        })
                      }
                      className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--text)]"
                    >
                      <option>In Progress</option>
                      <option>Completed</option>
                      <option>Not Mine</option>
                    </select>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={addProgramRow}
                className="mt-4 rounded-full border border-[#ff7a1a] px-4 py-1.5 text-xs font-semibold text-[#ff7a1a] hover:bg-[#ff7a1a]/10"
              >
                + Add program
              </button>
              <div className="mt-8 flex justify-end">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="rounded-full bg-[#0f6b44] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#13724f]"
                  onClick={handleConfirmProgramsNext}
                >
                  Next →
                </motion.button>
              </div>
            </div>
          </div>
        )}

        {step === 'confirm-classes' && (
          <div className="flex min-h-0 flex-1 flex-col items-center px-4 py-10">
            <div
              className={`${widePanelClass} flex min-h-0 w-full max-w-2xl max-h-[min(92vh,900px)] flex-col overflow-hidden`}
            >
              <h2 className="shrink-0 text-2xl font-bold text-[color:var(--text)]">
                Are these classes right?
              </h2>
              <p className="mt-2 shrink-0 text-sm text-[color:var(--text-muted)]">
                We detected these classes on your transcript — do these look right?
              </p>
              <div className="relative mt-6 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
                <div className="space-y-8 pb-4">
                  {semestersDraft.map((sem) => (
                    <div key={sem.id} className="rounded-2xl border border-[color:var(--border)] p-4">
                      <div className="flex items-start justify-between gap-2">
                        {editingSemesterId === sem.id ? (
                          <input
                            value={sem.label}
                            onChange={(e) => updateSemesterLabel(sem.id, e.target.value)}
                            className="flex-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1 text-sm font-bold text-[color:var(--text)]"
                          />
                        ) : (
                          <h3 className="text-sm font-bold text-[color:var(--text)]">{sem.label}</h3>
                        )}
                        <button
                          type="button"
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#0f6b44] hover:bg-[#0f6b44]/10"
                          onClick={() =>
                            setEditingSemesterId((id) => (id === sem.id ? null : sem.id))
                          }
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                          Edit
                        </button>
                      </div>
                      <ul className="mt-3 space-y-2">
                        {sem.courses.map((code, idx) => (
                          <li
                            key={`${sem.id}-${idx}`}
                            className="flex flex-col gap-1 border-b border-[color:var(--border)] py-2 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                          >
                            {editingSemesterId === sem.id ? (
                              <input
                                value={code}
                                onChange={(e) => updateCourseCode(sem.id, idx, e.target.value)}
                                className="w-full rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1 font-mono text-sm text-[color:var(--text)] sm:w-40"
                              />
                            ) : (
                              <span className="font-mono text-sm font-semibold text-[color:var(--text)]">
                                {code}
                              </span>
                            )}
                            <span className="text-right text-sm text-[color:var(--text-muted)]">
                              {courseTitles[code] || '—'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-6 flex shrink-0 justify-end border-t border-[color:var(--border)] pt-4">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="rounded-full bg-[#0f6b44] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#13724f]"
                  onClick={handleClassesDone}
                >
                  Looks good! →
                </motion.button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
