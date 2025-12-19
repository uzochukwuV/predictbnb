"use client"

import { useEffect, useRef } from "react"
import { AnimatedNoise } from "@/components/animated-noise"
import { HighlightText } from "@/components/highlight-text"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

const revenueData = [
  {
    type: "Niche Indie Game",
    queries: "10,000",
    monthly: "$14,400",
    annual: "$173K",
  },
  {
    type: "Growing Game",
    queries: "100,000",
    monthly: "$144,000",
    annual: "$1.7M",
  },
  {
    type: "Popular Game",
    queries: "1,000,000",
    monthly: "$1,440,000",
    annual: "$17.3M",
  },
  {
    type: "Major Esports",
    queries: "10,000,000",
    monthly: "$14,400,000",
    annual: "$173M",
  },
]

export function RevenueSection() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!sectionRef.current) return

    const ctx = gsap.context(() => {
      const rows = sectionRef.current?.querySelectorAll(".revenue-row")
      if (!rows) return

      gsap.fromTo(
        rows,
        { x: -30, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          stagger: 0.1,
          duration: 0.6,
          ease: "power2.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 70%",
          },
        },
      )
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section
      ref={sectionRef}
      id="revenue"
      className="relative min-h-screen flex items-center pl-6 md:pl-28 pr-6 md:pr-12 py-24"
    >
      <AnimatedNoise opacity={0.02} />

      <div className="w-full">
        <div className="mb-16">
          <HighlightText className="font-mono text-xs uppercase tracking-widest text-accent">
            Revenue Model
          </HighlightText>
          <h2 className="font-[var(--font-bebas)] text-[clamp(2rem,5vw,4rem)] text-foreground mt-4 leading-none">
            Real-World Developer Earnings
          </h2>
          <p className="font-mono text-sm text-muted-foreground mt-6 max-w-2xl leading-relaxed">
            Usage-based model ensures fair compensation. The more valuable your data, the more you earn.
          </p>
        </div>

        <div className="border border-border/30 overflow-hidden">
          <div className="grid grid-cols-4 gap-px bg-border/30">
            <div className="bg-background p-4">
              <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Game Type</div>
            </div>
            <div className="bg-background p-4">
              <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Monthly Queries</div>
            </div>
            <div className="bg-background p-4">
              <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Monthly Revenue</div>
            </div>
            <div className="bg-background p-4">
              <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Annual Revenue</div>
            </div>
          </div>

          {revenueData.map((row, index) => (
            <div
              key={index}
              className="revenue-row grid grid-cols-4 gap-px bg-border/30 hover:bg-accent/20 transition-colors duration-200"
            >
              <div className="bg-background p-4">
                <div className="font-mono text-sm text-foreground">{row.type}</div>
              </div>
              <div className="bg-background p-4">
                <div className="font-mono text-sm text-muted-foreground">{row.queries}</div>
              </div>
              <div className="bg-background p-4">
                <div className="font-mono text-sm text-accent font-medium">{row.monthly}</div>
              </div>
              <div className="bg-background p-4">
                <div className="font-mono text-sm text-accent font-medium">{row.annual}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 border border-accent/30 bg-accent/5 p-6">
          <div className="font-mono text-xs uppercase tracking-widest text-accent mb-3">Revenue Distribution</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="font-[var(--font-bebas)] text-3xl text-foreground">80%</div>
              <div className="font-mono text-xs text-muted-foreground mt-1">To Developers</div>
            </div>
            <div>
              <div className="font-[var(--font-bebas)] text-3xl text-foreground">15%</div>
              <div className="font-mono text-xs text-muted-foreground mt-1">Protocol Treasury</div>
            </div>
            <div>
              <div className="font-[var(--font-bebas)] text-3xl text-foreground">5%</div>
              <div className="font-mono text-xs text-muted-foreground mt-1">Disputer Pool</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
