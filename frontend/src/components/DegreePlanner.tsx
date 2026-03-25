import { useState } from 'react'
import Chat from './Chat'
import { degreePlannerChat } from '../api'
import type { Message } from '../api'

export default function DegreePlanner() {
  const [completedCourses, setCompletedCourses] = useState('')

  const handleSend = async (message: string, history: Message[]) => {
    const courses = completedCourses
      .split(',')
      .map(c => c.trim().toUpperCase())
      .filter(Boolean)

    const res = await degreePlannerChat({
      message,
      completed_courses:    courses,
      conversation_history: history
    })
    return res.response
  }

  const header = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        Completed courses (comma separated, leave blank if new student)
      </label>
      <input
        value={completedCourses}
        onChange={e => setCompletedCourses(e.target.value)}
        placeholder="e.g. BUAN 6333, BUAN 6340, BUAN 6312"
        style={{
          background:   'var(--surface)',
          border:       '1px solid var(--border)',
          borderRadius: '8px',
          color:        'var(--text)',
          padding:      '0.6rem 0.9rem',
          fontSize:     '0.9rem',
          outline:      'none',
          width:        '100%'
        }}
      />
    </div>
  )

  return (
    <Chat
      title="Degree Planner"
      color="#4f6ef7"
      onSend={handleSend}
      header={header}
    />
  )
}