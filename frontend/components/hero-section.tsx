"use client"

import { useEffect, useRef } from "react"
import { ScrambleTextOnHover } from "@/components/scramble-text"
import { SplitFlapText, SplitFlapMuteToggle, SplitFlapAudioProvider } from "@/components/split-flap-text"
import { AnimatedNoise } from "@/components/animated-noise"
import { BitmapChevron } from "@/components/bitmap-chevron"
import Link from "next/link"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { PredictBNBLogo } from "@/components/predictbnb"
gsap.registerPlugin(ScrollTrigger)

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sectionRef.current || !contentRef.current) return

    const ctx = gsap.context(() => {
      gsap.to(contentRef.current, {
        y: -100,
        opacity: 0,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom top",
          scrub: 1,
        },
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} id="hero" className="relative min-h-screen flex items-center pl-6 md:pl-28 pr-6 md:pr-12">
      <AnimatedNoise opacity={0.03} />
        <div className="absolute top-8 left-6 md:top-12 md:left-28 z-20">
        <PredictBNBLogo />
      </div>

      <div className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground -rotate-90 origin-left block whitespace-nowrap">
          PredictBNB
        </span>
      </div>

      <div className="absolute top-8 right-8 md:top-12 md:right-12 flex items-center gap-4 z-20">
        <Link
          href="/game/rps"
          className="group inline-flex items-center gap-2 border border-foreground/20 px-4 py-2 font-mono text-xs uppercase tracking-widest text-foreground hover:border-accent hover:text-accent transition-all duration-200"
        >
          <ScrambleTextOnHover text="Play Game" as="span" duration={0.5} />
          <BitmapChevron className="w-3 h-3 transition-transform duration-[400ms] ease-in-out group-hover:rotate-45" />
        </Link>
        <Link
          href="/prediction-market"
          className="group inline-flex items-center gap-2 border border-accent bg-accent/10 px-4 py-2 font-mono text-xs uppercase tracking-widest text-accent hover:bg-accent hover:text-background transition-all duration-200"
        >
          <ScrambleTextOnHover text="Bet Now" as="span" duration={0.5} />
          <BitmapChevron className="w-3 h-3 transition-transform duration-[400ms] ease-in-out group-hover:rotate-45" />
        </Link>
      </div>

      <div ref={contentRef} className="flex-1 w-full">
        <SplitFlapAudioProvider>
          <div className="relative">
            <SplitFlapText text="PREDICTBNB" speed={80} />
            <div className="mt-4">
              <SplitFlapMuteToggle />
            </div>
          </div>
        </SplitFlapAudioProvider>

        <h2 className="font-[var(--font-bebas)] text-accent text-[clamp(1rem,3vw,2rem)] mt-4 tracking-wide">
          The Data Monetization Layer for Gaming
        </h2>

        <p className="mt-12 max-w-2xl font-mono text-sm text-foreground leading-relaxed">
          Transform your game into a revenue-generating data API. Every match result you publish earns{" "}
          <span className="text-accent font-medium">$1.44 per query</span>. Built on BNB Chain, PredictBNB creates a
          self-sustaining ecosystem where games profit from data consumption.{" "}
          <span className="text-accent/80">
            Soon supporting real-world sports data including football, basketball, and more.
          </span>
        </p>

        <div className="mt-16 flex items-center gap-8 flex-wrap">
          <a
            href="#how-it-works"
            className="group inline-flex items-center gap-3 border border-foreground/20 px-6 py-3 font-mono text-xs uppercase tracking-widest text-foreground hover:border-accent hover:text-accent transition-all duration-200"
          >
            <ScrambleTextOnHover text="How It Works" as="span" duration={0.6} />
            <BitmapChevron className="transition-transform duration-[400ms] ease-in-out group-hover:rotate-45" />
          </a>
          <Link
            href="/marketplace"
            className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            Explore Games
          </Link>
        </div>
      </div>

      <div className="absolute bottom-8 right-8 md:bottom-12 md:right-12">
        <div className="border border-border px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          v3.0 / Oracle Core
        </div>
      </div>
    </section>
  )
}
