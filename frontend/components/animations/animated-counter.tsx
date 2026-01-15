"use client"

import { useEffect, useRef, useState } from "react"
import { useInView, motion, useSpring, useTransform } from "framer-motion"

interface AnimatedCounterProps {
  value: number
  duration?: number
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
}

export function AnimatedCounter({
  value,
  duration = 2,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-50px" })
  
  const spring = useSpring(0, { 
    duration: duration * 1000,
    bounce: 0,
  })
  
  const display = useTransform(spring, (current) => {
    return `${prefix}${current.toFixed(decimals)}${suffix}`
  })

  useEffect(() => {
    if (isInView) {
      spring.set(value)
    }
  }, [isInView, spring, value])

  return (
    <motion.span ref={ref} className={className}>
      {display}
    </motion.span>
  )
}

export function AnimatedNumber({
  value,
  duration = 1.5,
  className,
}: {
  value: number
  duration?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    if (isInView) {
      const startTime = Date.now()
      const startValue = 0
      const endValue = value

      const animate = () => {
        const now = Date.now()
        const elapsed = (now - startTime) / 1000
        const progress = Math.min(elapsed / duration, 1)
        
        // Easing function
        const eased = 1 - Math.pow(1 - progress, 3)
        const current = startValue + (endValue - startValue) * eased
        
        setDisplayValue(current)

        if (progress < 1) {
          requestAnimationFrame(animate)
        }
      }

      requestAnimationFrame(animate)
    }
  }, [isInView, value, duration])

  return (
    <span ref={ref} className={className}>
      {displayValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
    </span>
  )
}
