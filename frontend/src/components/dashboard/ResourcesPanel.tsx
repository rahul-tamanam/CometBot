import { BookOpen, GraduationCap, ListChecks } from 'lucide-react'
import { ResourceCard } from './ResourceCard'
import { CollapseToggleIcon } from './CollapseToggleIcon'

export function ResourcesPanel({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed: boolean
  onToggleCollapsed: () => void
}) {
  return (
    <aside
      className="relative h-full min-h-0 w-full p-4 overflow-hidden"
      style={{ borderLeft: '1px solid var(--border)', backgroundColor: 'var(--bg)' }}
    >
      <div className={`mb-3 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <div>
            <div className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>Resources</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}></div>
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
          title={collapsed ? 'Expand resources' : 'Collapse resources'}
        >
          <CollapseToggleIcon
            direction={collapsed ? 'left' : 'right'}
            variant={collapsed ? 'solid' : 'outline'}
          />
        </button>
      </div>

      {!collapsed && (
        <div className="space-y-3 overflow-y-auto pr-1">
          <ResourceCard
            title=""
            description="Explore official degree requirements and maps."
            href="https://academics.utdallas.edu/degrees/"
            icon={<GraduationCap size={18} />}
            imageSrc="/degree.png"
            imageOnly
          />
          <ResourceCard
            title=""
            description="Browse graduate JSOM programs and course catalog."
            href="https://catalog.utdallas.edu/2025/graduate/programs/jsom"
            icon={<BookOpen size={18} />}
            imageSrc="/catalog.png"
            imageOnly
          />
          <ResourceCard
            title=""
            description="Explore internships and career resources."
            href="https://jindal.utdallas.edu/career-management-center/"
            icon={<ListChecks size={18} />}
            imageSrc="/career.png"
            imageOnly
          />
        </div>
      )}
    </aside>
  )
}

