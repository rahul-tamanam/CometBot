import { useMemo, useRef, useState } from 'react'
import { Menu, Moon, Sun, X } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { ResourcesPanel } from './ResourcesPanel'
import { PromptCard } from './PromptCard'
import { ChatBubble } from './ChatBubble'
import { InputBar } from './InputBar'
import type { ChatMessage, ChatThread, ModeId } from './types'
import {
  careerMentorChat,
  degreePlannerChat,
  type Message as ApiMessage,
} from '@/api'
import { useProfile } from '@/hooks/useProfile'
import { ProfilePage } from '@/components/profile/ProfilePage'

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16)
}

function modeToTag(mode: ModeId) {
  if (mode === 'academic') return 'Academic Planning Engine'
  if (mode === 'career') return 'Career Insights Engine'
  return 'Course Info Engine'
}

function modeAccent(mode: ModeId) {
  if (mode === 'academic') return 'bg-gradient-to-r from-[#ff4d4d] via-[#ff7a1a] to-[#ff9a33]'
  if (mode === 'career') return 'bg-gradient-to-r from-[#f97316] via-[#fb923c] to-[#f59e0b]'
  return 'bg-gradient-to-r from-[#ff7a1a] via-[#ff9a33] to-[#f97316]'
}

function threadTitleFrom(text: string) {
  const t = text.trim().replace(/\s+/g, ' ')
  if (!t) return 'New chat'
  return t.length > 34 ? t.slice(0, 34) + '…' : t
}

const SUGGESTED: Record<ModeId, string[]> = {
  academic: [
    'What courses should I take next semester?',
    'What are the core courses for Business Analytics?',
    'What careers align with my degree?',
    'Show prerequisites for BUAN 6382',
  ],
  career: [
    'What does a Data Analyst do day-to-day?',
    'What skills do I need for Data Scientist roles?',
    'What roles fit someone who likes AI/ML?',
    'Which courses help with analytics interviews?',
  ],
  course: [
    'Tell me about BUAN 6320',
    'What are the prerequisites for BUAN 6398?',
    'Which electives cover machine learning?',
    'What is the difference between core and electives?',
  ],
}

export function CometDashboard() {
  const { profile, saveProfile, resetProfile, completedCourses } = useProfile()
  const [threads, setThreads] = useState<ChatThread[]>(() => {
    const now = Date.now()
    return [
      {
        id: uid(),
        title: 'New chat',
        createdAt: now,
        updatedAt: now,
        mode: 'academic',
        messages: [],
      },
    ]
  })
  const [activeId, setActiveId] = useState(threads[0].id)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const [mobileLeftOpen, setMobileLeftOpen] = useState(false)
  const [mobileRightOpen, setMobileRightOpen] = useState(false)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [logoOk, setLogoOk] = useState(true)
  const [leftWidth, setLeftWidth] = useState(300)
  const [rightWidth, setRightWidth] = useState(300)
  const [activeView, setActiveView] = useState<'chat' | 'profile'>('chat')
  const [profileOpen, setProfileOpen] = useState(false)
  const [userContext, setUserContext] = useState<'new' | 'current' | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const v = localStorage.getItem('cometbot_theme')
      return v === 'dark' ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })

  const activeThread = threads.find((t) => t.id === activeId) ?? threads[0]
  const mode = activeThread.mode
  const accentClass = modeAccent(mode)
  const profileBannerText = useMemo(() => {
    if (mode !== 'academic') return null
    if (completedCourses.length === 0) return 'No courses in profile · Treating you as a new student'
    return `Advising based on your profile · ${completedCourses.length} courses completed`
  }, [completedCourses.length, mode])

  const applyTheme = (t: 'light' | 'dark') => {
    setTheme(t)
    try {
      localStorage.setItem('cometbot_theme', t)
    } catch {
      // ignore
    }
    document.documentElement.classList.toggle('dark', t === 'dark')
  }

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollToBottom = () =>
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 30)

  const setThread = (id: string, patch: (t: ChatThread) => ChatThread) => {
    setThreads((prev) => prev.map((t) => (t.id === id ? patch(t) : t)))
  }

  const newChat = () => {
    const now = Date.now()
    const t: ChatThread = {
      id: uid(),
      title: 'New chat',
      createdAt: now,
      updatedAt: now,
      mode,
      messages: [],
    }
    setThreads((p) => [t, ...p])
    setActiveId(t.id)
    setInput('')
    setMobileLeftOpen(false)
    setActiveView('chat')
    setProfileOpen(false)
    setUserContext(null)
  }

  const setMode = (m: ModeId) => {
    setThread(activeId, (t) => ({ ...t, mode: m, updatedAt: Date.now() }))
    setMobileLeftOpen(false)
    setActiveView('chat')
    setProfileOpen(false)
  }

  const startContextIfMissing = () => {
    if (userContext) return userContext
    const ctx: 'new' | 'current' = completedCourses.length === 0 ? 'new' : 'current'
    setUserContext(ctx)
    return ctx
  }

  const handleFaqClick = (prompt: string) => {
    // User-driven only: set context and send once.
    startContextIfMissing()
    void send(prompt)
  }

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim()
    if (!text || loading) return

    setLoading(true)
    setInput('')

    const now = Date.now()
    const userMsg: ChatMessage = { role: 'user', content: text, ts: now }

    setThread(activeId, (t) => {
      const title = t.messages.length === 0 ? threadTitleFrom(text) : t.title
      return { ...t, title, updatedAt: now, messages: [...t.messages, userMsg] }
    })
    scrollToBottom()

    const historyForApi: ApiMessage[] = (activeThread.messages ?? []).map((m) => ({
      role: m.role,
      content: m.content,
    }))

    try {
      let botText = ''
      if (mode === 'career') {
        const bg = (profile.background || '').trim()
        const res = await careerMentorChat({
          message: bg ? `Student background: ${bg}\n\n${text}` : text,
          conversation_history: historyForApi,
        })
        botText = res.response
      } else {
        const ctx = startContextIfMissing()
        // academic + course info route through  -planner for catalog/prereq/eligibility logic
        const res = await degreePlannerChat({
          message: text,
          completed_courses: completedCourses,
          conversation_history: historyForApi,
          student_type: ctx,
          interests: undefined,
          course_history: [],
        })
        botText = res.response
      }

      const botMsg: ChatMessage = {
        role: 'assistant',
        content: botText,
        tag: modeToTag(mode),
        ts: Date.now(),
      }
      setThread(activeId, (t) => ({
        ...t,
        updatedAt: Date.now(),
        messages: [...t.messages, botMsg],
      }))
      scrollToBottom()
    } catch {
      const botMsg: ChatMessage = {
        role: 'assistant',
        content:
          'Something went wrong. Please make sure the backend (port 8000) and LM Studio are running.',
        tag: modeToTag(mode),
        ts: Date.now(),
      }
      setThread(activeId, (t) => ({ ...t, messages: [...t.messages, botMsg] }))
      scrollToBottom()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="h-screen w-full overflow-hidden text-[color:var(--text)]"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      {/* Global header (matches reference) */}
      <header
        className="flex h-14 items-center justify-between px-4"
        style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-50 lg:hidden"
            onClick={() => setMobileLeftOpen(true)}
            title="Open navigation"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 overflow-hidden rounded-full ring-1 bg-white" style={{ borderColor: 'var(--border)' }}>
              {logoOk ? (
                <img
                  src="/jsom.jpeg"
                  alt="JSOM"
                  className="h-8 w-8 object-cover"
                  onError={() => setLogoOk(false)}
                />
              ) : (
                <div
                  className="h-8 w-8"
                  aria-hidden
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(255,77,77,1) 0%, rgba(255,122,26,1) 55%, rgba(255,154,51,1) 100%)',
                  }}
                />
              )}
            </div>
            <div className="leading-tight">
              <div className="flex items-baseline gap-2">
                <button
                  type="button"
                  className="bg-gradient-to-r from-[#ff4d4d] via-[#ff7a1a] to-[#ff9a33] bg-[length:200%_200%] bg-clip-text text-2xl font-extrabold tracking-tight text-transparent"
                  style={{ animation: 'comet-shimmer 2s ease-in-out infinite alternate' }}
                  onClick={() => window.location.reload()}
                  title="Refresh"
                >
                  CometBot
                </button>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-4 text-sm font-extrabold tracking-tight text-[color:var(--text-muted)]">
          <a
            className="hidden rounded-lg px-2 py-1 md:inline-flex"
            style={{ color: 'var(--text-muted)' }}
            href="https://www.utdallas.edu/academics/calendar/"
            target="_blank"
            rel="noreferrer"
          >
            Academic Calendar
          </a>
          <a
            className="hidden rounded-lg px-2 py-1 md:inline-flex"
            style={{ color: 'var(--text-muted)' }}
            href="https://map.utdallas.edu/"
            target="_blank"
            rel="noreferrer"
          >
            Campus Map
          </a>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}
            onClick={() => applyTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center rounded-xl px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 xl:hidden"
            onClick={() => setMobileRightOpen(true)}
          >
            Resources
          </button>
        </nav>
      </header>

      <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
        {/* Left sidebar (desktop) */}
        <div
          className="relative hidden h-full min-h-0 lg:block transition-[width] duration-200 ease-in-out"
          style={{
            width: leftCollapsed ? 72 : leftWidth,
            borderRight: '1px solid var(--border)',
            backgroundColor: 'var(--bg)',
          }}
        >
          <Sidebar
            threads={threads}
            activeThreadId={activeId}
            mode={mode}
            onNewChat={newChat}
            onSelectThread={(id) => setActiveId(id)}
            onSelectMode={setMode}
            activeView={activeView}
            onSelectProfile={() => {
              setActiveView('profile')
              setProfileOpen(true)
              setMobileLeftOpen(false)
            }}
            collapsed={leftCollapsed}
            onToggleCollapsed={() => setLeftCollapsed((v) => !v)}
          />
          {!leftCollapsed && (
            <div
              role="separator"
              aria-orientation="vertical"
              title="Drag to resize"
              className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent"
              onMouseDown={(e) => {
                e.preventDefault()
                const startX = e.clientX
                const startW = leftWidth
                const onMove = (ev: MouseEvent) => {
                  const next = Math.max(260, Math.min(420, startW + (ev.clientX - startX)))
                  setLeftWidth(next)
                }
                const onUp = () => {
                  window.removeEventListener('mousemove', onMove)
                  window.removeEventListener('mouseup', onUp)
                }
                window.addEventListener('mousemove', onMove)
                window.addEventListener('mouseup', onUp)
              }}
            />
          )}
        </div>

        {/* Center */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-4 py-4">
            <div
              className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl shadow-sm"
              style={{
                backgroundImage: "url('/bg.png')",
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                border: '1px solid var(--border)',
              }}
            >
              <div
                className="absolute inset-0"
                aria-hidden
                style={{
                  backgroundColor:
                    'color-mix(in oklab, var(--panel, var(--surface)) 88%, transparent 12%)',
                }}
              />
              <div className="relative flex min-h-0 min-w-0 flex-1 flex-col px-4 overflow-hidden">
                {activeThread.messages.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center py-10">
                    <div className="w-full max-w-3xl text-center">
                      <div className="mx-auto mb-2 max-w-2xl text-2xl tracking-tight" style={{ color: 'var(--text)' }}>
                        <span className="font-extrabold">CometBot — Plan your degree. Shape your career.</span>

                      </div>
                      <div className="mx-auto mb-6 max-w-2xl text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                        AI-powered tool that helps you track requirements, explore courses, and align your skills with real career paths
                      </div>
                      <div className="mx-auto grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
                        {SUGGESTED[mode].map((p) => (
                          <PromptCard key={p} text={`“${p}”`} onClick={() => handleFaqClick(p)} />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="min-h-0 min-w-0 flex-1 overflow-y-auto py-6">
                    <div className="space-y-4 px-1">
                      {profileBannerText && (
                        <div
                          className="rounded-2xl px-3 py-2 text-xs font-semibold backdrop-blur"
                          style={{
                            backgroundColor: 'color-mix(in oklab, var(--surface) 70%, transparent 30%)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {profileBannerText}
                        </div>
                      )}
                      {activeThread.messages.map((m, idx) => (
                        <ChatBubble key={idx} message={m} accentClass={accentClass} />
                      ))}
                      {loading && (
                        <div className="flex justify-start">
                          <div
                            className="rounded-2xl px-4 py-3 text-sm shadow-sm"
                            style={{ backgroundColor: 'var(--surface2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                          >
                            Thinking…
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>
                )}

                {activeView === 'chat' && (
                  <InputBar
                    value={input}
                    onChange={setInput}
                    onSend={() => send()}
                    disabled={loading}
                    placeholder="Start researching..."
                  />
                )}
              </div>
            </div>
          </div>
        </main>

        {/* Right sidebar (desktop) */}
        <div
          className="relative hidden h-full min-h-0 xl:block transition-[width] duration-200 ease-in-out"
          style={{
            width: rightCollapsed ? 72 : rightWidth,
            borderLeft: '1px solid var(--border)',
            backgroundColor: 'var(--bg)',
          }}
        >
          <ResourcesPanel
            collapsed={rightCollapsed}
            onToggleCollapsed={() => setRightCollapsed((v) => !v)}
          />
          {!rightCollapsed && (
            <div
              role="separator"
              aria-orientation="vertical"
              title="Drag to resize"
              className="absolute left-0 top-0 h-full w-1 cursor-col-resize bg-transparent"
              onMouseDown={(e) => {
                e.preventDefault()
                const startX = e.clientX
                const startW = rightWidth
                const onMove = (ev: MouseEvent) => {
                  const next = Math.max(280, Math.min(460, startW - (ev.clientX - startX)))
                  setRightWidth(next)
                }
                const onUp = () => {
                  window.removeEventListener('mousemove', onMove)
                  window.removeEventListener('mouseup', onUp)
                }
                window.addEventListener('mousemove', onMove)
                window.addEventListener('mouseup', onUp)
              }}
            />
          )}
        </div>
      </div>

      {/* Mobile left drawer */}
      {mobileLeftOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileLeftOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-[320px] shadow-2xl">
            <div className="absolute right-2 top-2 z-10">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 ring-1 ring-slate-200"
                onClick={() => setMobileLeftOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <Sidebar
              threads={threads}
              activeThreadId={activeId}
              mode={mode}
              onNewChat={newChat}
              onSelectThread={(id) => {
                setActiveId(id)
                setMobileLeftOpen(false)
              }}
              onSelectMode={setMode}
              activeView={activeView}
              onSelectProfile={() => {
                setActiveView('profile')
                setProfileOpen(true)
                setMobileLeftOpen(false)
              }}
              collapsed={false}
              onToggleCollapsed={() => {}}
            />
          </div>
        </div>
      )}

      {/* Mobile right drawer */}
      {mobileRightOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileRightOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-[340px] shadow-2xl">
            <div className="absolute left-2 top-2 z-10">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 ring-1 ring-slate-200"
                onClick={() => setMobileRightOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <ResourcesPanel collapsed={false} onToggleCollapsed={() => {}} />
          </div>
        </div>
      )}

      {/* Profile modal (ChatGPT-style floating panel) */}
      {profileOpen && (
        <div className="fixed inset-0 z-[60]">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setProfileOpen(false)
              setActiveView('chat')
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div
              className="relative w-full max-w-4xl overflow-hidden rounded-3xl shadow-2xl"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <div className="text-sm font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
                  Profile
                </div>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                  onClick={() => {
                    setProfileOpen(false)
                    setActiveView('chat')
                  }}
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="h-[min(72vh,720px)] min-h-0">
                <ProfilePage profile={profile} saveProfile={saveProfile} resetProfile={resetProfile} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

