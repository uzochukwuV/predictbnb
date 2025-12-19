"use client"

import { useEffect, useRef } from "react"
import { AnimatedNoise } from "@/components/animated-noise"
import { HighlightText } from "@/components/highlight-text"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

const steps = [
  {
    number: "01",
    title: "Register Your Game",
    description: "Stake 0.1 BNB (~$60) once and receive your unique game ID. Takes 5 minutes.",
    code: "gameRegistry.registerGame()",
  },
  {
    number: "02",
    title: "Schedule Matches",
    description: "Post match details before each game. Get a unique match ID for result submission.",
    code: "gameRegistry.scheduleMatch()",
  },
  {
    number: "03",
    title: "Submit Results",
    description: "Encode data your way, include decode instructions, specify quick-access fields. One function call.",
    code: "oracleCore.submitResult()",
  },
  {
    number: "04",
    title: "Earn Revenue",
    description: "15-minute dispute window passes, result finalizes. Earn $1.44 per query forever.",
    code: "feeManager.withdraw()",
  },
]

export function HowItWorksSection() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!sectionRef.current) return

    const ctx = gsap.context(() => {
      const items = sectionRef.current?.querySelectorAll(".step-item")
      if (!items) return

      gsap.fromTo(
        items,
        { x: -50, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          stagger: 0.2,
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
      id="how-it-works"
      className="relative min-h-screen flex items-center pl-6 md:pl-28 pr-6 md:pr-12 py-24"
    >
      <AnimatedNoise opacity={0.02} />

      <div className="w-full">
        <div className="mb-16">
          <HighlightText className="font-mono text-xs uppercase tracking-widest text-accent">Process</HighlightText>
          <h2 className="font-[var(--font-bebas)] text-[clamp(2rem,5vw,4rem)] text-foreground mt-4 leading-none">
            Four Steps to Revenue
          </h2>
          <p className="font-mono text-sm text-muted-foreground mt-6 max-w-2xl leading-relaxed">
            From registration to passive income in minutes. No complex integration required.
          </p>
        </div>

        <div className="space-y-8">
          {steps.map((step, index) => (
            <div
              key={index}
              className="step-item border border-border/30 p-8 relative group hover:border-accent/50 transition-colors duration-300"
            >
              <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative flex flex-col md:flex-row gap-6 md:gap-12">
                <div className="flex-shrink-0">
                  <div className="font-[var(--font-bebas)] text-[clamp(3rem,6vw,5rem)] text-accent/30 leading-none">
                    {step.number}
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-mono text-lg font-medium text-foreground mb-3">{step.title}</h3>
                  <p className="font-mono text-sm text-muted-foreground leading-relaxed mb-4">{step.description}</p>
                  <div className="font-mono text-xs text-accent bg-accent/10 px-4 py-2 inline-block border border-accent/20">
                    {step.code}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
