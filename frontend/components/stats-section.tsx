"use client"

import { useEffect, useRef } from "react"
import { AnimatedNoise } from "@/components/animated-noise"
import { HighlightText } from "@/components/highlight-text"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

const stats = [
  {
    value: "$1.44",
    label: "Per Query Revenue",
    description: "Developers earn 80% of every query fee",
  },
  {
    value: "15min",
    label: "Dispute Window",
    description: "96x faster than UMA's 24-48 hour window",
  },
  {
    value: "$14B+",
    label: "Esports Betting Market",
    description: "Growing 15% YoY with limited data infrastructure",
  },
  {
    value: "0.1 BNB",
    label: "Registration Stake",
    description: "One-time cost to start earning forever",
  },
]

export function StatsSection() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!sectionRef.current) return

    const ctx = gsap.context(() => {
      const items = sectionRef.current?.querySelectorAll(".stat-item")
      if (!items) return

      gsap.fromTo(
        items,
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.1,
          duration: 0.8,
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
      id="stats"
      className="relative min-h-screen flex items-center pl-6 md:pl-28 pr-6 md:pr-12 py-24"
    >
      <AnimatedNoise opacity={0.02} />

      <div className="w-full">
        <div className="mb-16">
          <HighlightText className="font-mono text-xs uppercase tracking-widest text-accent">Key Metrics</HighlightText>
          <h2 className="font-[var(--font-bebas)] text-[clamp(2rem,5vw,4rem)] text-foreground mt-4 leading-none">
            Built for Performance
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="stat-item border border-border/30 p-6 relative group">
              <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative">
                <div className="font-[var(--font-bebas)] text-[clamp(2rem,4vw,3rem)] text-accent leading-none">
                  {stat.value}
                </div>
                <div className="font-mono text-xs uppercase tracking-widest text-foreground mt-3">{stat.label}</div>
                <div className="font-mono text-xs text-muted-foreground mt-4 leading-relaxed">{stat.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
