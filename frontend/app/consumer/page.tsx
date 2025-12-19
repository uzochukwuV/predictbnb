"use client"

import { useEffect, useRef, useState } from "react"
import { SideNav } from "@/components/side-nav"
import { AnimatedNoise } from "@/components/animated-noise"
import { HighlightText } from "@/components/highlight-text"
import { ScrambleTextOnHover } from "@/components/scramble-text"
import { BitmapChevron } from "@/components/bitmap-chevron"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

// Mock data - replace with actual API calls
const subscriptionData = [
  { game: "League of Legends", tier: "Premium", queries: 12450, limit: 50000, cost: "$360", status: "Active" },
  { game: "Dota 2", tier: "Standard", queries: 3200, limit: 10000, cost: "$72", status: "Active" },
  { game: "CS:GO", tier: "Starter", queries: 850, limit: 5000, cost: "$36", status: "Active" },
]

const recentQueries = [
  { game: "League of Legends", query: "Match Result #45321", time: "2 min ago", cost: "$1.44" },
  { game: "League of Legends", query: "Match Result #45320", time: "5 min ago", cost: "$1.44" },
  { game: "Dota 2", query: "Match Result #89012", time: "12 min ago", cost: "$1.44" },
  { game: "CS:GO", query: "Match Result #12345", time: "18 min ago", cost: "$1.44" },
  { game: "League of Legends", query: "Match Result #45319", time: "23 min ago", cost: "$1.44" },
]

export default function ConsumerDashboard() {
  const [balance, setBalance] = useState(2456.8)
  const [totalQueries, setTotalQueries] = useState(16500)
  const headerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!headerRef.current) return

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".stat-card",
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.1,
          duration: 0.6,
          ease: "power2.out",
        },
      )
    }, headerRef)

    return () => ctx.revert()
  }, [])

  return (
    <main className="relative min-h-screen">
      <SideNav />
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />

      <div className="relative z-10 pl-6 md:pl-28 pr-6 md:pr-12 py-16">
        <AnimatedNoise opacity={0.02} />

        {/* Header */}
        <div ref={headerRef} className="mb-16">
          <HighlightText className="font-mono text-xs uppercase tracking-widest text-accent">
            Consumer Dashboard
          </HighlightText>
          <h1 className="font-[var(--font-bebas)] text-[clamp(2rem,5vw,4rem)] text-foreground mt-4 leading-none">
            Your Data Subscriptions
          </h1>
          <p className="font-mono text-sm text-muted-foreground mt-6 max-w-2xl leading-relaxed">
            Track your subscriptions, query usage, and balance across all games.
          </p>
        </div>

        {/* Balance & Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="stat-card border border-border/30 p-6 relative">
            <AnimatedNoise opacity={0.01} />
            <div className="relative">
              <div className="font-mono text-[10px] uppercase tracking-widest text-accent mb-2">Account Balance</div>
              <div className="font-[var(--font-bebas)] text-[clamp(2rem,4vw,3rem)] text-foreground">
                ${balance.toFixed(2)}
              </div>
              <button className="mt-4 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors border border-border/30 px-4 py-2 hover:border-accent/50">
                <ScrambleTextOnHover text="Add Funds" as="span" duration={0.4} />
              </button>
            </div>
          </div>

          <div className="stat-card border border-border/30 p-6 relative">
            <AnimatedNoise opacity={0.01} />
            <div className="relative">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                Total Queries
              </div>
              <div className="font-[var(--font-bebas)] text-[clamp(2rem,4vw,3rem)] text-foreground">
                {totalQueries.toLocaleString()}
              </div>
              <div className="mt-4 font-mono text-xs text-muted-foreground">This Month</div>
            </div>
          </div>

          <div className="stat-card border border-border/30 p-6 relative">
            <AnimatedNoise opacity={0.01} />
            <div className="relative">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                Active Subscriptions
              </div>
              <div className="font-[var(--font-bebas)] text-[clamp(2rem,4vw,3rem)] text-foreground">
                {subscriptionData.length}
              </div>
              <div className="mt-4 font-mono text-xs text-muted-foreground">Games</div>
            </div>
          </div>
        </div>

        {/* Subscriptions Table */}
        <div className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-[var(--font-bebas)] text-[clamp(1.5rem,3vw,2.5rem)] text-foreground">
              Your Subscriptions
            </h2>
            <a
              href="/marketplace"
              className="group inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors"
            >
              <ScrambleTextOnHover text="Browse Games" as="span" duration={0.4} />
              <BitmapChevron className="transition-transform duration-[400ms] ease-in-out group-hover:rotate-45" />
            </a>
          </div>

          <div className="border border-border/30 overflow-hidden">
            <table className="w-full">
              <thead className="border-b border-border/30 bg-muted/5">
                <tr>
                  <th className="text-left px-6 py-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Game
                  </th>
                  <th className="text-left px-6 py-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Tier
                  </th>
                  <th className="text-left px-6 py-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Queries Used
                  </th>
                  <th className="text-left px-6 py-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Monthly Cost
                  </th>
                  <th className="text-left px-6 py-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {subscriptionData.map((sub, index) => (
                  <tr key={index} className="border-b border-border/20 hover:bg-muted/5 transition-colors">
                    <td className="px-6 py-4 font-mono text-sm text-foreground">{sub.game}</td>
                    <td className="px-6 py-4 font-mono text-sm text-muted-foreground">{sub.tier}</td>
                    <td className="px-6 py-4 font-mono text-sm text-muted-foreground">
                      {sub.queries.toLocaleString()} / {sub.limit.toLocaleString()}
                      <div className="mt-1 w-full h-1 bg-border/30 rounded-full overflow-hidden">
                        <div className="h-full bg-accent" style={{ width: `${(sub.queries / sub.limit) * 100}%` }} />
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-foreground">{sub.cost}</td>
                    <td className="px-6 py-4">
                      <span className="inline-block px-3 py-1 font-mono text-[10px] uppercase tracking-widest bg-accent/10 text-accent border border-accent/30">
                        {sub.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Queries */}
        <div>
          <h2 className="font-[var(--font-bebas)] text-[clamp(1.5rem,3vw,2.5rem)] text-foreground mb-6">
            Recent Queries
          </h2>

          <div className="space-y-3">
            {recentQueries.map((query, index) => (
              <div
                key={index}
                className="border border-border/30 p-4 flex items-center justify-between hover:border-accent/30 transition-colors"
              >
                <div className="flex-1">
                  <div className="font-mono text-sm text-foreground">{query.query}</div>
                  <div className="font-mono text-xs text-muted-foreground mt-1">{query.game}</div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="font-mono text-xs text-muted-foreground">{query.time}</div>
                  <div className="font-mono text-sm text-accent">{query.cost}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
