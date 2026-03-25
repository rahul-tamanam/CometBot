import { motion } from "framer-motion"
import { BookOpen, Briefcase, BarChart2 } from "lucide-react"
import { ActionSearchBar, type Action } from "@/components/ui/action-search-bar"
import { AnimatedText } from "@/components/ui/animated-shiny-text"

export type CometComponentId =
  | "degree-planner"
  | "career-mentor"
  | "skills-gap"

const PALETTE_ACTIONS: Action[] = [
  {
    id: "degree-planner",
    label: "Plan My Degree",
    icon: <BookOpen className="h-4 w-4 text-[#f08a24]" />,
    description: "Map your course path to graduation",
    end: "Advisor",
  },
  {
    id: "career-mentor",
    label: "Explore Careers",
    icon: <Briefcase className="h-4 w-4 text-[#4caf82]" />,
    description: "Explore careers and required skills",
    end: "Advisor",
  },
  {
    id: "skills-gap",
    label: "Analyze Skills Gap",
    icon: <BarChart2 className="h-4 w-4 text-[#2775db]" />,
    description: "Find what skills you are missing",
    end: "Analyzer",
  },
]

interface CometLandingProps {
  onSelectComponent: (id: CometComponentId) => void
  compact?: boolean
  showSearch?: boolean
}

export function CometLanding({
  onSelectComponent,
  compact = false,
  showSearch = true,
}: CometLandingProps) {
  const wrapperClass = compact ? "min-h-[34vh]" : "min-h-screen"
  const headingClass = compact
    ? "text-3xl sm:text-4xl md:text-5xl"
    : "text-4xl sm:text-5xl md:text-6xl"

  return (
    <div className={`relative flex w-full flex-col items-center overflow-hidden font-sans text-neutral-100 ${wrapperClass}`}>
      <div className={`relative z-10 flex w-full flex-col items-center ${wrapperClass}`}>
        <div className={`flex w-full max-w-3xl flex-col items-center px-4 ${showSearch ? "justify-center flex-1 -translate-y-20" : "pt-8 pb-6"}`}>
          <div className="mb-5 max-w-2xl text-center">
            <AnimatedText
              text="CometBot"
              className="py-0"
              textClassName={`font-bold tracking-tight ${headingClass}`}
              gradientColors="linear-gradient(90deg, #ffd3a1 0%, #e87500 35%, #f5b56d 60%, #159647 100%)"
              gradientAnimationDuration={2.2}
            />
            <motion.p
              className="mt-3 bg-gradient-to-r from-neutral-500 via-neutral-300 to-neutral-500 bg-clip-text text-base text-transparent drop-shadow-sm sm:text-lg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.45, delay: 0.1 }}
            >
              UTD&apos;s very own AI powered academic and career advisor
            </motion.p>
          </div>

          {showSearch && (
            <motion.div
              className="relative w-full rounded-xl border border-neutral-700/80 bg-black/55 shadow-2xl shadow-violet-950/40 backdrop-blur-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              <div className="p-4">
                <ActionSearchBar
                  actions={PALETTE_ACTIONS}
                  onSelect={(a) => onSelectComponent(a.id as CometComponentId)}
                />
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
