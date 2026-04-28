import Chat from './Chat'
import { careerMentorChat } from '../api'
import type { Message } from '../api'
import { useProfile } from '@/hooks/useProfile'

export default function CareerMentor() {
  const { profile, completedCourses, isNewStudent } = useProfile()
  const handleSend = async (message: string, history: Message[]) => {
    const bg = (profile.background || '').trim()
    const courseHistory = (profile.semesters || []).flatMap((sem) =>
      (sem.courses || [])
        .map((course) => ({ course, semester: sem.label }))
        .filter((row) => row.course.trim())
    )
    const res = await careerMentorChat({
      message: bg ? `Student background: ${bg}\n\n${message}` : message,
      conversation_history: history,
      completed_courses: completedCourses,
      student_type: isNewStudent() ? 'new' : 'current',
      course_history: courseHistory,
    })
    return res.response
  }

  return (
    <Chat
      title="Career Mentor"
      color="#4caf82"
      onSend={handleSend}
    />
  )
}