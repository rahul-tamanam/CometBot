import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, ArrowLeft, Loader, Upload, X } from 'lucide-react'
import { skillsGapAnalyze, skillsGapAnalyzeResume } from '../api'
import type { Message } from '../api'
import './SkillsGap.css'

type InputMode = 'courses' | 'resume'


export default function SkillsGap() {
  const navigate = useNavigate()

  // Input state
  const [mode,             setMode]             = useState<InputMode>('courses')
  const [completedCourses, setCompletedCourses] = useState('')
  const [targetJob,        setTargetJob]        = useState('')
  const [jobDescription,   setJobDescription]   = useState('')
  const [resumeFile,       setResumeFile]       = useState<File | null>(null)

  // Chat state
  const [messages,  setMessages]  = useState<Message[]>([])
  const [input,     setInput]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [analyzed,  setAnalyzed]  = useState(false)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const fileInput  = useRef<HTMLInputElement>(null)

  const scrollDown = () =>
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)

  // ── Run initial analysis ──────────────────────────────────────────────────

  const runAnalysis = async () => {
    if (loading) return
    if (mode === 'resume' && !resumeFile) {
      alert('Please upload a resume PDF first.')
      return
    }
    if (!targetJob.trim() && !jobDescription.trim()) {
      alert('Please provide a target job title or paste a job description.')
      return
    }

    setLoading(true)
    setAnalyzed(true)

    try {
      let response: string

      if (mode === 'resume' && resumeFile) {
        const res = await skillsGapAnalyzeResume(
          resumeFile,
          targetJob,
          jobDescription
        )
        response = res.response
      } else {
        const courses = completedCourses
          .split(',')
          .map(c => c.trim().toUpperCase())
          .filter(Boolean)

        const res = await skillsGapAnalyze({
          completed_courses:    courses,
          target_job:           targetJob,
          job_description:      jobDescription,
          conversation_history: [],
          message:              'Please perform a skills gap analysis.'
        })
        response = res.response
      }

      const assistantMsg: Message = { role: 'assistant', content: response }
      setMessages([assistantMsg])
      scrollDown()

    } catch (err) {
      setMessages([{
        role:    'assistant',
        content: 'Something went wrong. Please make sure the backend is running.'
      }])
    } finally {
      setLoading(false)
    }
  }

  // ── Follow-up chat ────────────────────────────────────────────────────────

  const sendFollowUp = async () => {
    if (!input.trim() || loading) return

    const userMsg: Message    = { role: 'user', content: input.trim() }
    const newHistory          = [...messages, userMsg]
    setMessages(newHistory)
    setInput('')
    setLoading(true)

    try {
      const courses = completedCourses
        .split(',')
        .map(c => c.trim().toUpperCase())
        .filter(Boolean)

      const res = await skillsGapAnalyze({
        completed_courses:    courses,
        target_job:           targetJob,
        job_description:      jobDescription,
        conversation_history: newHistory,
        message:              input.trim()
      })

      setMessages([
        ...newHistory,
        { role: 'assistant', content: res.response }
      ])
      scrollDown()

    } catch {
      setMessages([
        ...newHistory,
        {
          role:    'assistant',
          content: 'Something went wrong. Please try again.'
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      analyzed ? sendFollowUp() : runAnalysis()
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="sg-page">

      {/* Topbar */}
      <div className="sg-topbar">
        <button className="back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={18} /> Back
        </button>
        <h2 style={{ color: '#f7a84f' }}>Skills Gap Analyzer</h2>
      </div>

      {/* Input panel */}
      <div className="sg-inputs">

        {/* Mode toggle */}
        <div className="sg-mode-toggle">
          <button
            className={mode === 'courses' ? 'active' : ''}
            onClick={() => setMode('courses')}
          >
            Completed Courses
          </button>
          <button
            className={mode === 'resume' ? 'active' : ''}
            onClick={() => setMode('resume')}
          >
            Upload Resume
          </button>
        </div>

        {/* Course input */}
        {mode === 'courses' && (
          <div className="sg-field">
            <label>Completed courses (comma separated)</label>
            <input
              value={completedCourses}
              onChange={e => setCompletedCourses(e.target.value)}
              placeholder="e.g. BUAN 6333, BUAN 6340, BUAN 6341"
            />
          </div>
        )}

        {/* Resume upload */}
        {mode === 'resume' && (
          <div className="sg-field">
            <label>Resume PDF</label>
            <div
              className="sg-upload-zone"
              onClick={() => fileInput.current?.click()}
            >
              {resumeFile ? (
                <div className="sg-file-selected">
                  <span>{resumeFile.name}</span>
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      setResumeFile(null)
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <Upload size={20} />
                  <span>Click to upload PDF</span>
                </>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={e => setResumeFile(e.target.files?.[0] || null)}
            />
          </div>
        )}

        {/* Job role OR job description */}
        <div className="sg-field">
          <label>Target job title</label>
          <input
            value={targetJob}
            onChange={e => setTargetJob(e.target.value)}
            placeholder="e.g. Data Scientist"
          />
        </div>

        <div className="sg-field">
          <label>Or paste a job description</label>
          <textarea
            value={jobDescription}
            onChange={e => setJobDescription(e.target.value)}
            placeholder="Paste a job description from LinkedIn, Indeed, etc..."
            rows={4}
          />
        </div>

        <button
          className="sg-analyze-btn"
          onClick={runAnalysis}
          disabled={loading}
        >
          {loading ? <Loader size={16} className="spin" /> : null}
          {loading ? 'Analyzing...' : 'Analyze My Skills Gap'}
        </button>

      </div>

      {/* Chat area */}
      {analyzed && (
        <div className="sg-chat">
          <div className="sg-messages">
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  className={`message ${msg.role}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="message-bubble">
                    {msg.content}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && messages.length > 0 && (
              <motion.div
                className="message assistant"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="message-bubble loading">
                  <Loader size={16} className="spin" />
                  Thinking...
                </div>
              </motion.div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Follow-up input */}
          <div className="chat-input-row">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask a follow-up question..."
              rows={1}
              disabled={loading}
            />
            <button
              onClick={sendFollowUp}
              disabled={loading || !input.trim()}
              style={{ background: '#f7a84f' }}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}

    </div>
  )
}