"use client"

import { motion, type HTMLMotionProps, type Variants } from "framer-motion"
import { cn } from "@/lib/utils"

// Fade variants
export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5, ease: "easeOut" } },
}

// Slide up variants
export const slideUpVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } 
  },
}

// Slide in from left
export const slideLeftVariants: Variants = {
  hidden: { opacity: 0, x: -30 },
  visible: { 
    opacity: 1, 
    x: 0, 
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } 
  },
}

// Slide in from right
export const slideRightVariants: Variants = {
  hidden: { opacity: 0, x: 30 },
  visible: { 
    opacity: 1, 
    x: 0, 
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } 
  },
}

// Scale variants
export const scaleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } 
  },
}

// Stagger container
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
}

// Stagger item
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
}

// Motion components
interface MotionDivProps extends HTMLMotionProps<"div"> {
  className?: string
}

export function FadeIn({ children, className, ...props }: MotionDivProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeVariants}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export function SlideUp({ children, className, delay = 0, ...props }: MotionDivProps & { delay?: number }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0, y: 30 },
        visible: { 
          opacity: 1, 
          y: 0, 
          transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1], delay } 
        },
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export function SlideIn({ 
  children, 
  className, 
  direction = "left",
  delay = 0,
  ...props 
}: MotionDivProps & { direction?: "left" | "right"; delay?: number }) {
  const x = direction === "left" ? -30 : 30
  return (
    <motion.div
      initial={{ opacity: 0, x }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export function ScaleIn({ children, className, delay = 0, ...props }: MotionDivProps & { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export function StaggerContainer({ children, className, ...props }: MotionDivProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className, ...props }: MotionDivProps) {
  return (
    <motion.div
      variants={staggerItem}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}

// Hover animations
export function HoverScale({ children, className, scale = 1.02, ...props }: MotionDivProps & { scale?: number }) {
  return (
    <motion.div
      whileHover={{ scale }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={cn("cursor-pointer", className)}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export function HoverGlow({ children, className, ...props }: MotionDivProps) {
  return (
    <motion.div
      whileHover={{ 
        boxShadow: "0 0 30px rgba(var(--accent), 0.3)",
        borderColor: "rgba(var(--accent), 0.5)"
      }}
      transition={{ duration: 0.3 }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}
