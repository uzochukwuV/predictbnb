"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { ScrollReveal, ScrollRevealStagger, ScrollRevealItem } from "@/components/animations/scroll-reveal"

interface SectionHeaderProps {
  title: string
  subtitle?: string
  badge?: string
  action?: React.ReactNode
  className?: string
}

export function SectionHeader({
  title,
  subtitle,
  badge,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between mb-6", className)}>
      <div>
        {badge && (
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block font-mono text-[10px] uppercase tracking-widest text-accent mb-2"
          >
            {badge}
          </motion.span>
        )}
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="font-[var(--font-bebas)] text-3xl text-foreground"
        >
          {title}
        </motion.h2>
        {subtitle && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="font-mono text-sm text-muted-foreground mt-1"
          >
            {subtitle}
          </motion.p>
        )}
      </div>
      {action && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          {action}
        </motion.div>
      )}
    </div>
  )
}

export function PageHeader({
  title,
  description,
  badge,
  children,
  className,
}: {
  title: string
  description?: string
  badge?: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("mb-8", className)}>
      <ScrollReveal>
        {badge && (
          <span className="inline-block font-mono text-[10px] uppercase tracking-widest text-accent mb-2">
            {badge}
          </span>
        )}
        <h1 className="font-[var(--font-bebas)] text-[clamp(2rem,5vw,4rem)] text-foreground leading-none">
          {title}
        </h1>
        {description && (
          <p className="font-mono text-sm text-muted-foreground mt-4 max-w-2xl">
            {description}
          </p>
        )}
      </ScrollReveal>
      {children && (
        <ScrollReveal delay={0.2}>
          <div className="mt-6">{children}</div>
        </ScrollReveal>
      )}
    </div>
  )
}

export function Card({
  children,
  className,
  hover = true,
}: {
  children: React.ReactNode
  className?: string
  hover?: boolean
}) {
  return (
    <motion.div
      whileHover={hover ? { y: -2 } : {}}
      transition={{ duration: 0.2 }}
      className={cn(
        "border border-border/30 bg-card/50 backdrop-blur-sm p-6 transition-colors",
        hover && "hover:border-accent/30",
        className
      )}
    >
      {children}
    </motion.div>
  )
}

export function CardGrid({
  children,
  columns = 4,
  className,
}: {
  children: React.ReactNode
  columns?: 2 | 3 | 4
  className?: string
}) {
  const colClasses = {
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  }

  return (
    <div className={cn("grid gap-6", colClasses[columns], className)}>
      {children}
    </div>
  )
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px bg-border/30 my-8", className)} />
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("text-center py-16 px-4 border border-border/30", className)}>
      {Icon && (
        <div className="w-16 h-16 mx-auto mb-4 border border-border/30 flex items-center justify-center text-muted-foreground">
          <Icon className="w-8 h-8" />
        </div>
      )}
      <h3 className="font-mono text-sm text-foreground mb-2">{title}</h3>
      {description && (
        <p className="font-mono text-xs text-muted-foreground mb-4 max-w-sm mx-auto">
          {description}
        </p>
      )}
      {action}
    </div>
  )
}
