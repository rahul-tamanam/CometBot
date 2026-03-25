import { useState, useEffect, type ReactNode } from "react"
import { Input } from "@/components/ui/input"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Send } from "lucide-react"

function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

export interface Action {
  id: string
  label: string
  icon: ReactNode
  description?: string
  short?: string
  end?: string
}

interface SearchResult {
  actions: Action[]
}

interface ActionSearchBarProps {
  actions: Action[]
  onSelect?: (action: Action) => void
  inputId?: string
  label?: string
  placeholder?: string
}

export function ActionSearchBar({
  actions,
  onSelect,
  inputId = "comet-command-search",
  label = "Select Component",
  placeholder = "Search components or ask a question...",
}: ActionSearchBarProps) {
  const [query, setQuery] = useState("")
  const [result, setResult] = useState<SearchResult | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const debouncedQuery = useDebounce(query, 200)

  useEffect(() => {
    if (!isFocused) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFocused(false)
        setResult(null)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isFocused])

  useEffect(() => {
    if (!isFocused) {
      setResult(null)
      return
    }

    if (!debouncedQuery.trim()) {
      setResult({ actions })
      return
    }

    const normalizedQuery = debouncedQuery.toLowerCase().trim()
    const filteredActions = actions.filter((action) => {
      const haystack = `${action.label} ${action.description ?? ""}`.toLowerCase()
      return haystack.includes(normalizedQuery)
    })
    setResult({ actions: filteredActions })
  }, [debouncedQuery, isFocused, actions])

  const handleFocus = () => setIsFocused(true)

  const pickAction = (action: Action) => {
    onSelect?.(action)
    setQuery("")
    setIsFocused(false)
    setResult(null)
  }

  const container = {
    hidden: { opacity: 0, y: -8 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.2,
        staggerChildren: 0.06,
      },
    },
    exit: {
      opacity: 0,
      y: -8,
      transition: {
        duration: 0.15,
      },
    },
  }

  const item = {
    hidden: { opacity: 0, y: 16 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.28 },
    },
    exit: {
      opacity: 0,
      y: -8,
      transition: { duration: 0.2 },
    },
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="relative flex flex-col justify-start items-stretch min-h-0">
        <div className="w-full z-10 pb-1">
          <label
            className="text-xs font-medium text-neutral-400 mb-1.5 block"
            htmlFor={inputId}
          >
            {label}
          </label>
          <div className="relative">
            <Input
              id={inputId}
              type="text"
              autoComplete="off"
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={handleFocus}
              onBlur={() => setTimeout(() => setIsFocused(false), 200)}
              className="h-10 pl-3 pr-10 py-2 text-sm rounded-lg border-neutral-600 bg-black/40 text-white placeholder:text-neutral-500 focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-0 focus-visible:border-neutral-500"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none">
              <AnimatePresence mode="popLayout">
                {query.length > 0 ? (
                  <motion.div
                    key="send"
                    initial={{ y: -12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 12, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Send className="w-4 h-4 text-neutral-400" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="search"
                    initial={{ y: -12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 12, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Search className="w-4 h-4 text-neutral-400" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="absolute left-0 right-0 top-full z-20 mt-2 w-full">
          <AnimatePresence>
            {isFocused && result && (
              <motion.div
                className="w-full overflow-hidden rounded-xl border border-neutral-700/80 bg-black/55 shadow-2xl shadow-violet-950/40 backdrop-blur-xl"
                variants={container}
                initial="hidden"
                animate="show"
                exit="exit"
              >
                <motion.ul className="py-1">
                  {result.actions.length === 0 ? (
                    <li className="px-3 py-3 text-sm text-neutral-500 text-center">
                      No matching components
                    </li>
                  ) : (
                    result.actions.map((action) => (
                      <motion.li
                        key={action.id}
                        className="mx-1 px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-neutral-800/90 cursor-pointer rounded-lg"
                        variants={item}
                        layout
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickAction(action)}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-neutral-400 shrink-0">
                            {action.icon}
                          </span>
                          <span className="text-sm font-medium text-neutral-100 truncate">
                            {action.label}
                          </span>
                          {action.description ? (
                            <span className="text-xs text-neutral-500 truncate hidden sm:inline">
                              {action.description}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 text-xs text-neutral-500">
                          {action.short ? <span>{action.short}</span> : null}
                          {action.end ? (
                            <span className="text-right">{action.end}</span>
                          ) : null}
                        </div>
                      </motion.li>
                    ))
                  )}
                </motion.ul>
                <div className="px-3 py-2 border-t border-neutral-800">
                  <div className="flex items-center justify-between text-xs text-neutral-600">
                    <span></span>
                    <span>ESC to cancel</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
