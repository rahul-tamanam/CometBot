import * as React from "react"
import { motion, type Variants } from "framer-motion"
import { cn } from "@/lib/utils"

type AnimatedTextAs = "h1" | "h2" | "span"

interface AnimatedTextProps extends React.HTMLAttributes<HTMLDivElement> {
  text: string
  /** When `span`, use inside a parent heading so only this fragment gets the gradient. */
  as?: AnimatedTextAs
  gradientColors?: string
  gradientAnimationDuration?: number
  hoverEffect?: boolean
  className?: string
  textClassName?: string
}

const AnimatedText = React.forwardRef<HTMLDivElement, AnimatedTextProps>(
  (
    {
      text,
      as = "h1",
      gradientColors = "linear-gradient(90deg, #000, #ffffff, #000)",
      gradientAnimationDuration = 1,
      hoverEffect = false,
      className,
      textClassName,
      ...props
    },
    ref
  ) => {
    const [isHovered, setIsHovered] = React.useState(false)

    const textVariants: Variants = {
      initial: {
        backgroundPosition: "0 0",
      },
      animate: {
        backgroundPosition: "100% 0",
        transition: {
          duration: gradientAnimationDuration,
          repeat: Infinity,
          repeatType: "reverse" as const,
        },
      },
    }

    const MotionText =
      as === "span" ? motion.span : as === "h2" ? motion.h2 : motion.h1

    return (
      <div
        ref={ref}
        className={cn(
          as === "span" ? "inline-flex items-baseline justify-center" : "flex items-center justify-center py-8",
          className
        )}
        {...props}
      >
        <MotionText
          className={cn(
            as === "span"
              ? ""
              : "text-[2.5rem] leading-normal sm:text-[3.5rem] md:text-[4rem] lg:text-[5rem] xl:text-[6rem]",
            textClassName
          )}
          style={{
            background: gradientColors,
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: isHovered ? "0 0 8px rgba(255,255,255,0.3)" : "none",
          }}
          variants={textVariants}
          initial="initial"
          animate="animate"
          onHoverStart={() => hoverEffect && setIsHovered(true)}
          onHoverEnd={() => hoverEffect && setIsHovered(false)}
        >
          {text}
        </MotionText>
      </div>
    )
  }
)

AnimatedText.displayName = "AnimatedText"

export { AnimatedText }
