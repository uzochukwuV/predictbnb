"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

export function FloatingOrb({
  className,
  delay = 0,
  duration = 20,
  size = 200,
}: {
  className?: string
  delay?: number
  duration?: number
  size?: number
}) {
  return (
    <motion.div
      className={cn(
        "absolute rounded-full blur-3xl opacity-20",
        className
      )}
      style={{ width: size, height: size }}
      animate={{
        x: [0, 50, -30, 0],
        y: [0, -40, 30, 0],
        scale: [1, 1.1, 0.9, 1],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  )
}

export function FloatingParticles({
  count = 20,
  className,
}: {
  count?: number
  className?: string
}) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      {[...Array(count)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-accent/30 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [-20, 20, -20],
            opacity: [0.2, 0.8, 0.2],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            delay: Math.random() * 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  )
}

export function GlowingGrid({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      <div 
        className="absolute inset-0 bg-grid-pattern opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(to right, oklch(0.7 0.2 45 / 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, oklch(0.7 0.2 45 / 0.1) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />
      <motion.div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(circle at 50% 50%, oklch(0.7 0.2 45 / 0.15), transparent 50%)",
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  )
}

export function PulsingDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex h-3 w-3", className)}>
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
      <span className="relative inline-flex rounded-full h-3 w-3 bg-accent" />
    </span>
  )
}

export function GradientBlob({ className }: { className?: string }) {
  return (
    <motion.div
      className={cn(
        "absolute w-[500px] h-[500px] rounded-full blur-3xl opacity-20",
        "bg-gradient-to-r from-accent via-purple-500 to-blue-500",
        className
      )}
      animate={{
        scale: [1, 1.2, 1],
        rotate: [0, 180, 360],
      }}
      transition={{
        duration: 20,
        repeat: Infinity,
        ease: "linear",
      }}
    />
  )
}
