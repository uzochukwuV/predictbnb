"use client"

import Link from "next/link"
import { useState } from "react"

export function PredictBNBLogo() {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <Link
      href="/"
      className="group flex items-center gap-3"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="transition-transform duration-300 group-hover:scale-110"
      >
        {/* Outer frame */}
        <rect x="2" y="2" width="36" height="36" stroke="currentColor" strokeWidth="1" className="text-foreground/20" />

        {/* Inner geometric pattern - abstract prediction symbol */}
        <path
          d="M20 8 L32 20 L20 32 L8 20 Z"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          className={`text-foreground transition-all duration-300 ${isHovered ? "fill-accent/10" : ""}`}
        />

        {/* Central triangle - data point */}
        <path
          d="M20 14 L26 20 L20 26 L14 20 Z"
          fill="currentColor"
          className={`transition-all duration-300 ${isHovered ? "text-accent" : "text-foreground"}`}
        />

        {/* Top accent line */}
        <line x1="20" y1="8" x2="20" y2="14" stroke="currentColor" strokeWidth="2" className="text-accent" />
      </svg>

      <div className="flex flex-col">
        <span className="font-[var(--font-bebas)] text-xl leading-none tracking-wide text-foreground transition-colors duration-200 group-hover:text-accent">
          PredictBNB
        </span>
        <span className="font-[var(--font-bebas)] text-sm leading-none tracking-wide text-foreground transition-colors duration-200 group-hover:text-accent mb-3">
          
          Testnet
        </span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Oracle Protocol</span>
      </div>
    </Link>
  )
}
