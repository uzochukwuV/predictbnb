"use client"

import { useEffect, useRef } from "react"
import { AnimatedNoise } from "@/components/animated-noise"
import { HighlightText } from "@/components/highlight-text"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

const features = [
  {
    title: "Two-Tier Architecture",
    description:
      "Fully onchain games get instant resolution with zero trust assumptions. Traditional games use our 15-minute optimistic dispute window.",
    tag: "Tier 1 & 2",
  },
  {
    title: "Self-Describing Results",
    description:
      "Results include raw data, decode instructions, and quick-access fields. No manual decoding required for common queries.",
    tag: "Patent-Pending",
  },
  {
    title: "Usage-Based Revenue",
    description:
      "Earn based on actual data consumption. Popular games earn millions per month. New games earn fairly from day one.",
    tag: "Fair Economics",
  },
  {
    title: "Encoding Flexibility",
    description:
      "Encode data any way you want. Simple, complex, packed, or custom formats all work. No template lock-in.",
    tag: "Your Format",
  },
  {
    title: "Prepaid Balance System",
    description:
      "Deposit once, query thousands of times with zero gas per query. Volume bonuses up to 15% reduce costs further.",
    tag: "Capital Efficient",
  },
  {
    title: "Free Tier",
    description: "Every consumer gets 50 free queries per day. Perfect for testing and small prediction markets.",
    tag: "50/Day Free",
  },
  {
    title: "Real-World Data (Coming Soon)",
    description:
      "Expanding beyond gaming to include football, basketball, and other sports data. Same monetization model, broader markets.",
    tag: "Sports & More",
  },
]

export function FeaturesSection() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!sectionRef.current) return

    const ctx = gsap.context(() => {
      const items = sectionRef.current?.querySelectorAll(".feature-item")
      if (!items) return

      gsap.fromTo(
        items,
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.15,
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
      id="features"
      className="relative min-h-screen flex items-center pl-6 md:pl-28 pr-6 md:pr-12 py-24"
    >
      <AnimatedNoise opacity={0.02} />

      <div className="w-full">
        <div className="mb-16">
          <HighlightText className="font-mono text-xs uppercase tracking-widest text-accent">
            Key Features
          </HighlightText>
          <h2 className="font-[var(--font-bebas)] text-[clamp(2rem,5vw,4rem)] text-foreground mt-4 leading-none">
            Domain-Specific Oracle
          </h2>
          <p className="font-mono text-sm text-muted-foreground mt-6 max-w-2xl leading-relaxed">
            The first oracle built specifically for gaming. Fast, flexible, and fair.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div key={index} className="feature-item border border-border/30 p-6 relative group">
              <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative">
                <div className="font-mono text-[10px] uppercase tracking-widest text-accent mb-4">{feature.tag}</div>
                <h3 className="font-mono text-base font-medium text-foreground mb-3">{feature.title}</h3>
                <p className="font-mono text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
