import {
  GraduationCap,
  Briefcase,
  MessageSquarePlus,
  Lightbulb,
  User,
} from 'lucide-react'
import type { ModeId } from './types'
import { ChatHistoryList } from './ChatHistoryList'
import type { ChatThread } from './types'
import { CollapseToggleIcon } from './CollapseToggleIcon'

const MODE_ITEMS: Array<{
  id: ModeId
  label: string
  icon: typeof GraduationCap
}> = [
  { id: 'academic', label: 'Degree Planner', icon: GraduationCap },
  { id: 'career', label: 'Career Mentor', icon: Briefcase },
  { id: 'course', label: 'Skills Gap Analyzer', icon: Lightbulb },
]

export function Sidebar({
  threads,
  activeThreadId,
  mode,
  onNewChat,
  onSelectThread,
  onSelectMode,
  activeView,
  onSelectProfile,
  collapsed,
  onToggleCollapsed,
}: {
  threads: ChatThread[]
  activeThreadId: string
  mode: ModeId
  onNewChat: () => void
  onSelectThread: (id: string) => void
  onSelectMode: (m: ModeId) => void
  activeView: 'chat' | 'profile'
  onSelectProfile: () => void
  collapsed: boolean
  onToggleCollapsed: () => void
}) {
  return (
    <aside
      className="relative flex h-full min-h-0 w-full flex-col p-3 overflow-hidden"
      style={{ borderRight: '1px solid var(--border)', backgroundColor: 'var(--bg)' }}
    >
      <div className={`mb-2 flex items-center px-2 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <div className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
            Chat History
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl shadow-sm"
          style={{
          backgroundColor: 'var(--surface)',
            color: 'var(--text-muted)',
            border: '1px solid var(--border)',
          }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <CollapseToggleIcon
            direction={collapsed ? 'right' : 'left'}
            variant={collapsed ? 'solid' : 'outline'}
          />
        </button>
      </div>

      <button
        type="button"
        onClick={onNewChat}
        className={[
          'mb-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold tracking-tight text-white shadow-sm',
          collapsed ? 'px-0' : '',
        ].join(' ')}
        style={{
          background:
            'linear-gradient(90deg, #ff4d4d 0%, #ff7a1a 55%, #ff9a33 100%)',
        }}
        title="New chat"
      >
        <MessageSquarePlus size={16} />
        {!collapsed && '+ New Chat'}
      </button>

      {!collapsed && (
        <ChatHistoryList
          threads={threads}
          activeId={activeThreadId}
          onSelect={onSelectThread}
        />
      )}

      <div className="my-3 h-px" style={{ backgroundColor: 'var(--border)' }} />

      {!collapsed && (
        <div className="px-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Modes
        </div>
      )}
      <div className="mt-2 space-y-1">
        {MODE_ITEMS.map((m) => {
          const Icon = m.icon
          const active = activeView === 'chat' && m.id === mode
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelectMode(m.id)}
              className={[
                'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-extrabold tracking-tight transition-colors',
                active
                  ? 'shadow-sm'
                  : '',
              ].join(' ')}
              style={
                active
                  ? { backgroundColor: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }
                  : { color: 'var(--text-muted)' }
              }
              title={m.label}
            >
              <Icon size={16} style={{ color: 'var(--text-muted)' }} />
              {!collapsed && m.label}
            </button>
          )
        })}
      </div>

      <div className="my-3 h-px" style={{ backgroundColor: 'var(--border)' }} />

      <div className="mt-2 space-y-1">
        <button
          type="button"
          onClick={onSelectProfile}
          className={[
            'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-extrabold tracking-tight transition-colors',
            activeView === 'profile'
              ? 'shadow-sm'
              : '',
          ].join(' ')}
          style={
            activeView === 'profile'
              ? { backgroundColor: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }
              : { color: 'var(--text-muted)' }
          }
          title="Profile"
        >
          <User size={16} style={{ color: 'var(--text-muted)' }} />
          {!collapsed && 'Profile'}
        </button>
      </div>
    </aside>
  )
}

