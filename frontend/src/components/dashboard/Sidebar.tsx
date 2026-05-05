import {
  GraduationCap,
  Briefcase,
  MessageSquarePlus,
  Lightbulb,
  User,
} from 'lucide-react'
import { useState, type CSSProperties } from 'react'
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
  const isDarkMode =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')
  const [isNewChatHovered, setIsNewChatHovered] = useState(false)

  const profileActive = activeView === 'profile'

  const profileAvatarStyle: CSSProperties = profileActive
    ? {
        backgroundColor: 'var(--surface)',
        color: 'var(--text)',
        border: '1px solid var(--border)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
      }
    : {
        backgroundColor: 'color-mix(in oklab, var(--surface) 88%, transparent)',
        color: 'var(--text-muted)',
        border: '1px solid var(--border)',
      }

  return (
    <aside
      className="relative flex h-full min-h-0 w-full flex-col overflow-hidden p-3"
      style={{ borderRight: '1px solid var(--border)', backgroundColor: 'var(--bg)' }}
    >
      <div className={`mb-2 flex shrink-0 items-center px-2 ${collapsed ? 'justify-center' : 'justify-between'}`}>
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
        onMouseEnter={() => setIsNewChatHovered(true)}
        onMouseLeave={() => setIsNewChatHovered(false)}
        className={[
          'mb-3 inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold tracking-tight shadow-sm transition-all',
          isNewChatHovered ? '-translate-y-[1px] shadow-md' : '',
          collapsed ? 'px-0' : '',
        ].join(' ')}
        style={{
          backgroundColor: isDarkMode
            ? (isNewChatHovered ? '#3b3b3b' : '#303030')
            : (isNewChatHovered ? '#f1f1f1' : 'var(--surface)'),
          color: 'var(--text-muted)',
          border: '1px solid var(--border)',
        }}
        title="New chat"
      >
        <MessageSquarePlus size={16} />
        {!collapsed && '+ New Chat'}
      </button>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {!collapsed && (
          <ChatHistoryList
            threads={threads}
            activeId={activeThreadId}
            onSelect={onSelectThread}
          />
        )}

        <div className="my-3 h-px shrink-0" style={{ backgroundColor: 'var(--border)' }} />

        {!collapsed && (
          <div
            className="shrink-0 px-2 text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: 'var(--text-muted)' }}
          >
            Modes
          </div>
        )}
        <div className="mt-2 shrink-0 space-y-1">
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
                  active ? 'shadow-sm' : '',
                ].join(' ')}
                style={
                  active
                    ? {
                        backgroundColor: 'var(--surface)',
                        color: 'var(--text)',
                        border: '1px solid var(--border)',
                      }
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
      </div>

      <div
        className={`mt-auto shrink-0 border-t pt-3 ${collapsed ? 'flex justify-start' : ''}`}
        style={{ borderColor: 'var(--border)' }}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={onSelectProfile}
            title="Profile"
            aria-label="Profile"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors"
            style={profileAvatarStyle}
          >
            <User size={18} strokeWidth={2} aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSelectProfile}
            title="Profile"
            className={[
              'flex w-full items-center gap-3 rounded-xl px-2 py-2 text-sm font-extrabold tracking-tight transition-colors',
              profileActive ? 'shadow-sm' : '',
            ].join(' ')}
            style={
              profileActive
                ? {
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                  }
                : { color: 'var(--text-muted)' }
            }
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={profileAvatarStyle}
            >
              <User size={18} strokeWidth={2} aria-hidden />
            </span>
            <span>Profile</span>
          </button>
        )}
      </div>
    </aside>
  )
}
