import type { ChatMessage } from './types'

type HighlightCatalog = {
  courseIds: string[]
  courseTitles: string[]
  certTitles: string[]
}

type MatchRange = { start: number; end: number }

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildRanges(content: string, catalog: HighlightCatalog): MatchRange[] {
  const ranges: MatchRange[] = []

  for (const courseId of catalog.courseIds) {
    const normalized = courseId.trim().toUpperCase()
    if (!normalized) continue
    const idPattern = `\\b${escapeRegex(normalized).replace('\\ ', '\\s+')}\\b`
    const rx = new RegExp(idPattern, 'g')
    let m: RegExpExecArray | null
    while ((m = rx.exec(content)) !== null) {
      ranges.push({ start: m.index, end: m.index + m[0].length })
    }
  }

  const phrases = [...catalog.certTitles, ...catalog.courseTitles]
    .map((p) => p.trim())
    .filter((p) => p.length >= 4)

  for (const phrase of phrases) {
    const rx = new RegExp(escapeRegex(phrase), 'gi')
    let m: RegExpExecArray | null
    while ((m = rx.exec(content)) !== null) {
      ranges.push({ start: m.index, end: m.index + m[0].length })
    }
  }

  ranges.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start
    return (b.end - b.start) - (a.end - a.start)
  })

  const merged: MatchRange[] = []
  for (const r of ranges) {
    const prev = merged[merged.length - 1]
    if (!prev || r.start >= prev.end) {
      merged.push(r)
    }
  }
  return merged
}

function renderWithHighlights(content: string, catalog: HighlightCatalog) {
  const ranges = buildRanges(content, catalog)
  const out: Array<string | JSX.Element> = []
  let last = 0

  for (const { start, end } of ranges) {
    if (start > last) out.push(content.slice(last, start))
    out.push(<strong key={`${start}-${end}`}>{content.slice(start, end)}</strong>)
    last = end
  }

  if (last < content.length) out.push(content.slice(last))
  return out
}

export function ChatBubble({
  message,
  accentClass,
  highlightCatalog,
}: {
  message: ChatMessage
  accentClass: string
  highlightCatalog: HighlightCatalog
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
        <div className="whitespace-pre-wrap break-words">
          {renderWithHighlights(message.content, highlightCatalog)}
        </div>
      </div>
    </div>
  )
}

