import Chat from './Chat'
import { careerMentorChat } from '../api'
import type { Message } from '../api'

export default function CareerMentor() {
  const handleSend = async (message: string, history: Message[]) => {
    const res = await careerMentorChat({
      message,
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