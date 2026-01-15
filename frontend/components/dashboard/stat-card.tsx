"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { AnimatedCounter } from "@/components/animations/animated-counter"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { LucideIcon } from "lucide-react"

interface StatCardProps {
  title: string
  value: number | string
  change?: number
  changeLabel?: string
  prefix?: string
  suffix?: string
  icon?: LucideIcon
  delay?: number
  className?: string
  variant?: "default" | "accent" | "success" | "warning"
}

export function StatCard({
  title,
  value,
  change,
  changeLabel,
  prefix = "",
  suffix = "",
  icon: Icon,
  delay = 0,
  className,
  variant = "default",
}: StatCardProps) {
  const isPositive = change && change > 0
  const isNegative = change && change < 0

  const variantStyles = {
    default: "border-border/30 hover:border-border/60",
    accent: "border-accent/30 hover:border-accent/60 bg-accent/5",
    success: "border-green-500/30 hover:border-green-500/60 bg-green-500/5",
    warning: "border-yellow-500/30 hover:border-yellow-500/60 bg-yellow-500/5",
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className={cn(
        "relative p-6 border bg-card/50 backdrop-blur-sm transition-all duration-300",
        variantStyles[variant],
        className
      )}
    >
      {/* Background glow on hover */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 transition-opacity"
        whileHover={{ opacity: 1 }}
      />

      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {title}
          </span>
          {Icon && (
            <div className="w-8 h-8 flex items-center justify-center border border-border/30 text-muted-foreground">
              <Icon className="w-4 h-4" />
            </div>
          )}
        </div>

        <div className="font-[var(--font-bebas)] text-4xl text-foreground mb-2">
          {typeof value === "number" ? (
            <>
              {prefix}
              <AnimatedCounter value={value} decimals={value < 1 ? 4 : value < 1000 ? 2 : 0} />
              {suffix}
            </>
          ) : (
            <>{prefix}{value}{suffix}</>
          )}
        </div>

        {(change !== undefined || changeLabel) && (
          <div className="flex items-center gap-2">
            {change !== undefined && (
              <span
                className={cn(
                  "flex items-center gap-1 font-mono text-xs",
                  isPositive && "text-green-400",
                  isNegative && "text-red-400",
                  !isPositive && !isNegative && "text-muted-foreground"
                )}
              >
                {isPositive && <TrendingUp className="w-3 h-3" />}
                {isNegative && <TrendingDown className="w-3 h-3" />}
                {!isPositive && !isNegative && <Minus className="w-3 h-3" />}
                {isPositive ? "+" : ""}
                {change}%
              </span>
            )}
            {changeLabel && (
              <span className="font-mono text-xs text-muted-foreground">
                {changeLabel}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

export function MiniStatCard({
  title,
  value,
  prefix = "",
  suffix = "",
  className,
}: {
  title: string
  value: number | string
  prefix?: string
  suffix?: string
  className?: string
}) {
  return (
    <div className={cn("p-4 border border-border/30 bg-card/30", className)}>
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
        {title}
      </div>
      <div className="font-[var(--font-bebas)] text-2xl text-accent">
        {prefix}{value}{suffix}
      </div>
    </div>
  )
}
