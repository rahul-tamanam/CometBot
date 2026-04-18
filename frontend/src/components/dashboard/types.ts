export type ModeId = 'academic' | 'career' | 'course'

export type ChatRole = 'user' | 'assistant'

export type ChatMessage = {
  role: ChatRole
  content: string
  tag?: string
  ts: number
}

export type ChatThread = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  mode: ModeId
  messages: ChatMessage[]
}

export const MODES: Array<{
  id: ModeId
  label: string
  description: string
}> = [
  { id: 'academic', label: 'Academic Planning', description: 'Degree planning and sequencing' },
  { id: 'career', label: 'Career Insights', description: 'Roles, skills, trajectories' },
  { id: 'course', label: 'Course Info', description: 'Catalog and prerequisites' },
]

