import { ExternalLink } from 'lucide-react'
import type { ReactNode } from 'react'

export function ResourceCard({
  title,
  description,
  href,
  icon,
  imageSrc,
  imageOnly,
}: {
  title: string
  description: string
  href: string
  icon: ReactNode
  imageSrc?: string
  imageOnly?: boolean
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group block overflow-hidden rounded-2xl shadow-sm transition-all hover:-translate-y-[1px] hover:shadow-md"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {imageOnly ? (
        <div className="relative h-44 w-full" style={{ backgroundColor: 'var(--surface2)' }}>
          {imageSrc && (
            <img
              src={imageSrc}
              alt={title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-black/0" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-3">
            <div className="truncate text-sm font-extrabold tracking-tight text-white drop-shadow">
              {title}
            </div>
            <ExternalLink size={16} className="text-white/90 drop-shadow" />
          </div>
        </div>
      ) : (
        <>
          {imageSrc && (
            <div className="h-24 w-full overflow-hidden" style={{ backgroundColor: 'var(--surface2)' }}>
              <img
                src={imageSrc}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          )}
          <div className="flex items-start gap-3 p-4">
            <div
              className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl"
              style={{
                backgroundColor: 'var(--surface2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }}
            >
              {icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="truncate text-sm font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
                  {title}
                </div>
                <ExternalLink
                  size={14}
                  className="shrink-0 transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                />
              </div>
              <div className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {description}
              </div>
            </div>
          </div>
        </>
      )}
    </a>
  )
}

