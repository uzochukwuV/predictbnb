"use client"

import { useState } from "react"
import { AnimatedNoise } from "@/components/animated-noise"
import { HighlightText } from "@/components/highlight-text"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrambleTextOnHover } from "@/components/scramble-text"

// Mock data - in production this would come from your smart contracts
const gameData = {
  totalGames: 247,
  totalQueries: 1250000,
  totalRevenue: 1800000,
  averageRevenuePerGame: 7287,
}

const topGames = [
  {
    id: 1,
    name: "Cyber Chess Arena",
    type: "Onchain",
    queries: 450000,
    revenue: 648000,
    disputeRate: 0.2,
    status: "Active",
  },
  {
    id: 2,
    name: "Battle Royale Elite",
    type: "Traditional",
    queries: 320000,
    revenue: 460800,
    disputeRate: 1.5,
    status: "Active",
  },
  {
    id: 3,
    name: "Card Masters",
    type: "Onchain",
    queries: 180000,
    revenue: 259200,
    disputeRate: 0.1,
    status: "Active",
  },
  {
    id: 4,
    name: "FPS Legends",
    type: "Traditional",
    queries: 150000,
    revenue: 216000,
    disputeRate: 2.3,
    status: "Active",
  },
  {
    id: 5,
    name: "Strategy Empire",
    type: "Hybrid",
    queries: 85000,
    revenue: 122400,
    disputeRate: 0.8,
    status: "Active",
  },
]

const recentActivity = [
  {
    game: "Cyber Chess Arena",
    action: "Result Submitted",
    matchId: "0x7a8b...92c3",
    time: "2 min ago",
  },
  {
    game: "Battle Royale Elite",
    action: "Query Executed",
    matchId: "0x4d2e...81f5",
    time: "5 min ago",
  },
  {
    game: "Card Masters",
    action: "Revenue Withdrawn",
    matchId: "0x9c1f...43a7",
    time: "12 min ago",
  },
  {
    game: "FPS Legends",
    action: "Result Finalized",
    matchId: "0x2b6a...15d9",
    time: "18 min ago",
  },
]

export default function GamesDashboard() {
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d" | "all">("30d")

  return (
    <main className="relative min-h-screen pl-6 md:pl-28 pr-6 md:pr-12 py-12">
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />
      <AnimatedNoise opacity={0.02} />

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <HighlightText className="font-mono text-xs uppercase tracking-widest text-accent">
            Game Analytics
          </HighlightText>
          <h1 className="font-[var(--font-bebas)] text-[clamp(2rem,5vw,4rem)] text-foreground mt-4 leading-none">
            Performance Dashboard
          </h1>
          <p className="font-mono text-sm text-muted-foreground mt-4">
            Track game registrations, query volume, and revenue distribution
          </p>
        </div>

        {/* Time Range Selector */}
        <div className="flex gap-2 mb-8">
          {(["24h", "7d", "30d", "all"] as const).map((range) => (
            <Button
              key={range}
              onClick={() => setTimeRange(range)}
              variant={timeRange === range ? "default" : "outline"}
              className="font-mono text-xs uppercase tracking-widest"
            >
              <ScrambleTextOnHover text={range} duration={0.3} />
            </Button>
          ))}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">Total Games</div>
            <div className="font-[var(--font-bebas)] text-4xl text-accent">{gameData.totalGames}</div>
            <div className="font-mono text-xs text-muted-foreground mt-2">+12 this month</div>
          </Card>

          <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">Total Queries</div>
            <div className="font-[var(--font-bebas)] text-4xl text-accent">
              {(gameData.totalQueries / 1000000).toFixed(2)}M
            </div>
            <div className="font-mono text-xs text-muted-foreground mt-2">+18% vs last month</div>
          </Card>

          <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">Total Revenue</div>
            <div className="font-[var(--font-bebas)] text-4xl text-accent">
              ${(gameData.totalRevenue / 1000000).toFixed(2)}M
            </div>
            <div className="font-mono text-xs text-muted-foreground mt-2">Developer earnings (80%)</div>
          </Card>

          <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">Avg Revenue</div>
            <div className="font-[var(--font-bebas)] text-4xl text-accent">${gameData.averageRevenuePerGame}</div>
            <div className="font-mono text-xs text-muted-foreground mt-2">Per game per month</div>
          </Card>
        </div>

        {/* Top Games Table */}
        <div className="mb-12">
          <h2 className="font-mono text-lg font-medium text-foreground mb-6">Top Performing Games</h2>
          <div className="border border-border/30 overflow-hidden">
            <div className="grid grid-cols-7 gap-px bg-border/30">
              <div className="bg-background p-4">
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Game Name</div>
              </div>
              <div className="bg-background p-4">
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Type</div>
              </div>
              <div className="bg-background p-4">
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Queries</div>
              </div>
              <div className="bg-background p-4">
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Revenue</div>
              </div>
              <div className="bg-background p-4">
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Dispute Rate</div>
              </div>
              <div className="bg-background p-4">
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Status</div>
              </div>
              <div className="bg-background p-4">
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Action</div>
              </div>
            </div>

            {topGames.map((game) => (
              <div
                key={game.id}
                className="grid grid-cols-7 gap-px bg-border/30 hover:bg-accent/10 transition-colors duration-200"
              >
                <div className="bg-background p-4">
                  <div className="font-mono text-sm text-foreground">{game.name}</div>
                </div>
                <div className="bg-background p-4">
                  <div className="font-mono text-sm text-muted-foreground">{game.type}</div>
                </div>
                <div className="bg-background p-4">
                  <div className="font-mono text-sm text-muted-foreground">{(game.queries / 1000).toFixed(0)}K</div>
                </div>
                <div className="bg-background p-4">
                  <div className="font-mono text-sm text-accent font-medium">${(game.revenue / 1000).toFixed(0)}K</div>
                </div>
                <div className="bg-background p-4">
                  <div className="font-mono text-sm text-muted-foreground">{game.disputeRate}%</div>
                </div>
                <div className="bg-background p-4">
                  <div className="font-mono text-xs uppercase tracking-widest text-accent">{game.status}</div>
                </div>
                <div className="bg-background p-4">
                  <button className="font-mono text-xs uppercase tracking-widest text-foreground hover:text-accent transition-colors duration-200">
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="font-mono text-lg font-medium text-foreground mb-6">Recent Activity</h2>
          <div className="space-y-3">
            {recentActivity.map((activity, index) => (
              <div
                key={index}
                className="border border-border/30 p-4 bg-card/30 backdrop-blur-sm hover:border-accent/50 transition-colors duration-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-mono text-sm text-foreground mb-1">{activity.game}</div>
                    <div className="font-mono text-xs text-muted-foreground">{activity.action}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs text-accent mb-1">{activity.matchId}</div>
                    <div className="font-mono text-xs text-muted-foreground">{activity.time}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
