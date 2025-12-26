"use client"

import { useEffect, useRef } from "react"
import { SideNav } from "@/components/side-nav"
import { AnimatedNoise } from "@/components/animated-noise"
import { HighlightText } from "@/components/highlight-text"
import { ScrambleTextOnHover } from "@/components/scramble-text"
import { BitmapChevron } from "@/components/bitmap-chevron"
import Link from "next/link"
import gsap from "gsap"

export default function ConsolePage() {
  const headerRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!headerRef.current || !cardsRef.current) return

    const ctx = gsap.context(() => {
      // Animate header
      gsap.fromTo(
        headerRef.current,
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power2.out",
        },
      )

      // Animate cards with stagger
      gsap.fromTo(
        ".role-card",
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.2,
          duration: 0.8,
          delay: 0.3,
          ease: "power2.out",
        },
      )
    })

    return () => ctx.revert()
  }, [])

  return (
    <main className="relative min-h-screen">
      <SideNav />
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />

      <div className="relative z-10 pl-6 md:pl-28 pr-6 md:pr-12 py-16">
        <AnimatedNoise opacity={0.02} />

        {/* Header */}
        <div ref={headerRef} className="mb-20 text-center max-w-4xl mx-auto">
          <HighlightText className="font-mono text-xs uppercase tracking-widest text-accent">
            Welcome to PredictBNB Console
          </HighlightText>
          <h1 className="font-[var(--font-bebas)] text-[clamp(3rem,6vw,5rem)] text-foreground mt-6 leading-none">
            Choose Your Role
          </h1>
          <p className="font-mono text-sm text-muted-foreground mt-6 max-w-2xl mx-auto leading-relaxed">
            Select how you want to interact with the PredictBNB protocol
          </p>
        </div>

        {/* Role Selection Cards */}
        <div ref={cardsRef} className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Game Provider Card */}
          <Link href="/console/game" className="role-card group">
            <div className="border border-border/30 p-12 relative hover:border-accent/50 transition-all duration-500 h-full flex flex-col">
              <AnimatedNoise opacity={0.01} />

              <div className="relative flex-1">
                {/* Icon */}
                <div className="w-16 h-16 border border-accent/30 flex items-center justify-center mb-8 group-hover:border-accent transition-colors duration-500">
                  <svg
                    className="w-8 h-8 text-accent"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z"
                    />
                  </svg>
                </div>

                {/* Title */}
                <h2 className="font-[var(--font-bebas)] text-[clamp(2rem,4vw,3rem)] text-foreground mb-4 leading-none">
                  Game Provider
                </h2>

                {/* Description */}
                <p className="font-mono text-sm text-muted-foreground leading-relaxed mb-8">
                  Build games and submit match results to the oracle. Earn 80% of query fees when prediction
                  markets consume your data. Track your games, earnings, and submissions.
                </p>

                {/* Features List */}
                <ul className="space-y-3 mb-8">
                  <li className="font-mono text-xs text-muted-foreground flex items-start gap-3">
                    <span className="text-accent mt-1">→</span>
                    <span>Register and manage your games</span>
                  </li>
                  <li className="font-mono text-xs text-muted-foreground flex items-start gap-3">
                    <span className="text-accent mt-1">→</span>
                    <span>Submit match results to oracle</span>
                  </li>
                  <li className="font-mono text-xs text-muted-foreground flex items-start gap-3">
                    <span className="text-accent mt-1">→</span>
                    <span>Track revenue and query stats</span>
                  </li>
                  <li className="font-mono text-xs text-muted-foreground flex items-start gap-3">
                    <span className="text-accent mt-1">→</span>
                    <span>Withdraw earnings anytime</span>
                  </li>
                </ul>
              </div>

              {/* CTA */}
              <div className="relative mt-auto pt-8 border-t border-border/30">
                <div className="flex items-center justify-between group-hover:translate-x-2 transition-transform duration-500">
                  <span className="font-mono text-sm uppercase tracking-widest text-foreground group-hover:text-accent transition-colors duration-500">
                    <ScrambleTextOnHover text="Launch Dashboard" as="span" duration={0.4} />
                  </span>
                  <BitmapChevron className="transition-transform duration-500 group-hover:rotate-45" />
                </div>
              </div>
            </div>
          </Link>

          {/* Market Consumer Card */}
          <Link href="/console/market" className="role-card group">
            <div className="border border-border/30 p-12 relative hover:border-accent/50 transition-all duration-500 h-full flex flex-col">
              <AnimatedNoise opacity={0.01} />

              <div className="relative flex-1">
                {/* Icon */}
                <div className="w-16 h-16 border border-accent/30 flex items-center justify-center mb-8 group-hover:border-accent transition-colors duration-500">
                  <svg
                    className="w-8 h-8 text-accent"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                    />
                  </svg>
                </div>

                {/* Title */}
                <h2 className="font-[var(--font-bebas)] text-[clamp(2rem,4vw,3rem)] text-foreground mb-4 leading-none">
                  Market Consumer
                </h2>

                {/* Description */}
                <p className="font-mono text-sm text-muted-foreground leading-relaxed mb-8">
                  Query match results from the oracle to power prediction markets and betting platforms.
                  Enjoy volume bonuses, referral rewards, and streak incentives.
                </p>

                {/* Features List */}
                <ul className="space-y-3 mb-8">
                  <li className="font-mono text-xs text-muted-foreground flex items-start gap-3">
                    <span className="text-accent mt-1">→</span>
                    <span>Query finalized match results</span>
                  </li>
                  <li className="font-mono text-xs text-muted-foreground flex items-start gap-3">
                    <span className="text-accent mt-1">→</span>
                    <span>Earn volume-based discounts (up to 15%)</span>
                  </li>
                  <li className="font-mono text-xs text-muted-foreground flex items-start gap-3">
                    <span className="text-accent mt-1">→</span>
                    <span>Get streak rewards and referral bonuses</span>
                  </li>
                  <li className="font-mono text-xs text-muted-foreground flex items-start gap-3">
                    <span className="text-accent mt-1">→</span>
                    <span>Track queries and balance</span>
                  </li>
                </ul>
              </div>

              {/* CTA */}
              <div className="relative mt-auto pt-8 border-t border-border/30">
                <div className="flex items-center justify-between group-hover:translate-x-2 transition-transform duration-500">
                  <span className="font-mono text-sm uppercase tracking-widest text-foreground group-hover:text-accent transition-colors duration-500">
                    <ScrambleTextOnHover text="Launch Dashboard" as="span" duration={0.4} />
                  </span>
                  <BitmapChevron className="transition-transform duration-500 group-hover:rotate-45" />
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Bottom Info */}
        <div className="mt-20 text-center max-w-2xl mx-auto">
          <p className="font-mono text-xs text-muted-foreground leading-relaxed">
            Not sure which role to choose? You can always switch between dashboards. Connect your wallet to get started.
          </p>
        </div>
      </div>
    </main>
  )
}
