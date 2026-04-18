import Chat from './Chat'
import { careerMentorChat } from '../api'
import type { Message } from '../api'
import { useProfile } from '@/hooks/useProfile'

export default function CareerMentor() {
  const { profile } = useProfile()
  const handleSend = async (message: string, history: Message[]) => {
    const bg = (profile.background || '').trim()
    const res = await careerMentorChat({
      message: bg ? `Student background: ${bg}\n\n${message}` : message,
      conversation_history: history
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