import Chat from './Chat'
import { degreePlannerChat } from '../api'
import type { Message } from '../api'
import { useProfile } from '@/hooks/useProfile'

export default function DegreePlanner() {
  const { completedCourses, isNewStudent } = useProfile()

  const handleSend = async (message: string, history: Message[]) => {
    const res = await degreePlannerChat({
      message,
      completed_courses:    completedCourses,
      conversation_history: history
    })
    return res.response
  }

  const header = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div
        style={{
          background: 'rgba(255,255,255,0.6)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '0.6rem 0.9rem',
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
        }}
      >
        {isNewStudent()
          ? 'No courses in profile · Treating you as a new student'
          : `Advising based on your profile · ${completedCourses.length} courses completed`}
      </div>
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