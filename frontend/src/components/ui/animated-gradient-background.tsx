import { useEffect, useRef, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface AnimatedGradientBackgroundProps {
  startingGap?: number
  Breathing?: boolean
  gradientColors: string[]
  gradientStops: number[]
  animationSpeed?: number
  breathingRange?: readonly [number, number]
  containerStyle?: CSSProperties
  containerClassName?: string
  topOffset?: string | number
}

/**
 * Full-viewport radial gradient animated with requestAnimationFrame.
 * Breathing optionally modulates ellipse size for a subtle “alive” background.
 */
export function AnimatedGradientBackground({
  startingGap = 80,
  Breathing = false,
  gradientColors,
  gradientStops,
  animationSpeed = 1,
  breathingRange = [0.88, 1.12] as const,
  containerStyle,
  containerClassName,
  topOffset = 0,
}: AnimatedGradientBackgroundProps) {
  const elRef = useRef<HTMLDivElement>(null)
  const tRef = useRef(0)
  const rafRef = useRef(0)

  useEffect(() => {
    const el = elRef.current
    if (!el) return

    const colors = gradientColors
    const stops =
      gradientStops.length >= colors.length
        ? gradientStops
        : colors.map((_, i) => (100 * i) / Math.max(1, colors.length - 1))

    const [bMin, bMax] = breathingRange

    const buildGradient = (time: number) => {
      const breathe = Breathing ? 0.5 + 0.5 * Math.sin(time * 0.45) : 0.5
      const scale = bMin + (bMax - bMin) * breathe
      const radius = startingGap * scale * (1.05 + 0.06 * Math.sin(time * 0.28))
      const cx = 50 + 5 * Math.sin(time * 0.18)
      const cy = 44 + 4 * Math.cos(time * 0.14)
      const colorStops = colors.map((c, i) => `${c} ${stops[i] ?? 0}%`).join(', ')
      return `radial-gradient(ellipse ${radius}% ${Math.round(radius * 0.7)}% at ${cx}% ${cy}%, ${colorStops})`
    }

    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      tRef.current += dt * animationSpeed
      const node = elRef.current
      if (node) {
        node.style.background = buildGradient(tRef.current)
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [
    startingGap,
    Breathing,
    gradientColors,
    gradientStops,
    animationSpeed,
    breathingRange,
  ])

  const topValue = typeof topOffset === 'number' ? `${topOffset}px` : topOffset

  return (
    <motion.div
      ref={elRef}
      initial={{ opacity: 0, scale: 1.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'pointer-events-none fixed inset-0 -z-10 min-h-full overflow-hidden',
        containerClassName,
      )}
      style={{
        ...containerStyle,
        top: topValue,
        /* Matches app shell until RAF paints the radial gradient */
        background: '#f7f8fa',
      }}
    />
  )
}
