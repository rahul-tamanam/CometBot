import type { ChatMessage } from './types'

export function ChatBubble({
  message,
  accentClass,
}: {
  message: ChatMessage
  accentClass: string
}) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={[
          'max-w-[min(85%,100%)] rounded-2xl px-4 py-3 text-[15px] leading-[1.65] shadow-sm',
          isUser ? `${accentClass} text-white` : '',
        ].join(' ')}
        style={
          isUser
            ? undefined
            : {
                backgroundColor: 'var(--surface)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }
        }
      >
        {!isUser && message.tag && (
          <div className="mb-1 text-[11px] font-semibold tracking-wide" style={{ color: 'var(--text-muted)' }}>
            {message.tag}
          </div>
        )}
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
      </div>
    </div>
  )
}

