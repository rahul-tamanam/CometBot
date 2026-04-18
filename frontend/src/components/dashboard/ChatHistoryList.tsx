import { Clock } from 'lucide-react'
import type { ChatThread } from './types'

function formatTime(ts: number) {
  const d = new Date(ts)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ChatHistoryList({
  threads,
  activeId,
  onSelect,
}: {
  threads: ChatThread[]
  activeId: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-1">
        <div className="space-y-1">
          {threads.map((t) => {
            const active = t.id === activeId
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelect(t.id)}
                className={[
                  'w-full rounded-xl px-3 py-2 text-left transition-colors',
                  active ? 'shadow-sm' : '',
                ].join(' ')}
                style={
                  active
                    ? { backgroundColor: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }
                    : { color: 'var(--text-muted)' }
                }
              >
                <div className="truncate text-sm font-semibold">{t.title}</div>
                <div className="mt-1 flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  <Clock size={12} />
                  <span>{formatTime(t.updatedAt)}</span>
                </div>
              </button>
            )
          })}
          {threads.length === 0 && (
            <div
              className="rounded-xl p-3 text-xs"
              style={{
                backgroundColor: 'color-mix(in oklab, var(--surface) 70%, transparent 30%)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
              }}
            >
              No chats yet.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

