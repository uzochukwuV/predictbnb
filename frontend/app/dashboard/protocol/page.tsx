"use client"

import { useState } from "react"
import { AnimatedNoise } from "@/components/animated-noise"
import { HighlightText } from "@/components/highlight-text"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrambleTextOnHover } from "@/components/scramble-text"

// Mock data - in production this would come from your smart contracts
const protocolData = {
  totalValueLocked: 12500,
  protocolRevenue: 450000,
  totalQueries: 2500000,
  activeConsumers: 89,
  totalGames: 247,
  disputeResolutionRate: 98.5,
}

const revenueBreakdown = [
  { label: "Query Fees", amount: 360000, percentage: 80 },
  { label: "Volume Bonuses", amount: 54000, percentage: 12 },
  { label: "Premium Features", amount: 36000, percentage: 8 },
]

const networkStats = [
  { label: "Average Query Time", value: "0.3s", change: "-12%" },
  { label: "Dispute Rate", value: "1.5%", change: "-0.3%" },
  { label: "Finalization Rate", value: "98.5%", change: "+0.5%" },
  { label: "Uptime", value: "99.97%", change: "0%" },
]

const topConsumers = [
  {
    name: "BetChain Markets",
    queries: 850000,
    spent: 1530000,
    volumeBonus: "15%",
  },
  {
    name: "PredictPro Platform",
    queries: 620000,
    spent: 1116000,
    volumeBonus: "15%",
  },
  {
    name: "GameBet Exchange",
    queries: 420000,
    spent: 756000,
    volumeBonus: "10%",
  },
  {
    name: "QuickPredict",
    queries: 180000,
    spent: 324000,
    volumeBonus: "5%",
  },
]

export default function ProtocolDashboard() {
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d" | "all">("30d")

  return (
    <main className="relative min-h-screen pl-6 md:pl-28 pr-6 md:pr-12 py-12">
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />
      <AnimatedNoise opacity={0.02} />

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <HighlightText className="font-mono text-xs uppercase tracking-widest text-accent">
            Protocol Analytics
          </HighlightText>
          <h1 className="font-[var(--font-bebas)] text-[clamp(2rem,5vw,4rem)] text-foreground mt-4 leading-none">
            Network Overview
          </h1>
          <p className="font-mono text-sm text-muted-foreground mt-4">
            Monitor protocol health, revenue distribution, and network performance
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

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
              Total Value Locked
            </div>
            <div className="font-[var(--font-bebas)] text-4xl text-accent">{protocolData.totalValueLocked} BNB</div>
            <div className="font-mono text-xs text-muted-foreground mt-2">Developer stakes + prepaid balances</div>
          </Card>

          <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
              Protocol Revenue
            </div>
            <div className="font-[var(--font-bebas)] text-4xl text-accent">
              ${(protocolData.protocolRevenue / 1000).toFixed(0)}K
            </div>
            <div className="font-mono text-xs text-muted-foreground mt-2">20% of total fees collected</div>
          </Card>

          <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">Total Queries</div>
            <div className="font-[var(--font-bebas)] text-4xl text-accent">
              {(protocolData.totalQueries / 1000000).toFixed(1)}M
            </div>
            <div className="font-mono text-xs text-muted-foreground mt-2">+24% vs last month</div>
          </Card>

          <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
              Active Consumers
            </div>
            <div className="font-[var(--font-bebas)] text-4xl text-accent">{protocolData.activeConsumers}</div>
            <div className="font-mono text-xs text-muted-foreground mt-2">Prediction markets & platforms</div>
          </Card>

          <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
              Registered Games
            </div>
            <div className="font-[var(--font-bebas)] text-4xl text-accent">{protocolData.totalGames}</div>
            <div className="font-mono text-xs text-muted-foreground mt-2">Across all tiers</div>
          </Card>

          <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
              Resolution Rate
            </div>
            <div className="font-[var(--font-bebas)] text-4xl text-accent">{protocolData.disputeResolutionRate}%</div>
            <div className="font-mono text-xs text-muted-foreground mt-2">Successfully finalized</div>
          </Card>
        </div>

        {/* Revenue Breakdown */}
        <div className="mb-12">
          <h2 className="font-mono text-lg font-medium text-foreground mb-6">Revenue Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {revenueBreakdown.map((item, index) => (
              <Card key={index} className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">
                  {item.label}
                </div>
                <div className="font-[var(--font-bebas)] text-3xl text-foreground mb-2">
                  ${(item.amount / 1000).toFixed(0)}K
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-border/30 h-2 rounded-full overflow-hidden">
                    <div className="bg-accent h-full" style={{ width: `${item.percentage}%` }} />
                  </div>
                  <div className="font-mono text-xs text-accent">{item.percentage}%</div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Network Stats */}
        <div className="mb-12">
          <h2 className="font-mono text-lg font-medium text-foreground mb-6">Network Performance</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {networkStats.map((stat, index) => (
              <div key={index} className="border border-border/30 p-6 bg-card/30 backdrop-blur-sm">
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">
                  {stat.label}
                </div>
                <div className="flex items-end justify-between">
                  <div className="font-[var(--font-bebas)] text-3xl text-foreground">{stat.value}</div>
                  <div
                    className={`font-mono text-xs ${stat.change.startsWith("-") ? "text-accent" : stat.change === "0%" ? "text-muted-foreground" : "text-accent"}`}
                  >
                    {stat.change}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Consumers */}
        <div>
          <h2 className="font-mono text-lg font-medium text-foreground mb-6">Top Data Consumers</h2>
          <div className="border border-border/30 overflow-hidden">
            <div className="grid grid-cols-4 gap-px bg-border/30">
              <div className="bg-background p-4">
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Platform</div>
              </div>
              <div className="bg-background p-4">
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Total Queries</div>
              </div>
              <div className="bg-background p-4">
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Total Spent</div>
              </div>
              <div className="bg-background p-4">
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Volume Bonus</div>
              </div>
            </div>

            {topConsumers.map((consumer, index) => (
              <div
                key={index}
                className="grid grid-cols-4 gap-px bg-border/30 hover:bg-accent/10 transition-colors duration-200"
              >
                <div className="bg-background p-4">
                  <div className="font-mono text-sm text-foreground">{consumer.name}</div>
                </div>
                <div className="bg-background p-4">
                  <div className="font-mono text-sm text-muted-foreground">{(consumer.queries / 1000).toFixed(0)}K</div>
                </div>
                <div className="bg-background p-4">
                  <div className="font-mono text-sm text-accent font-medium">
                    ${(consumer.spent / 1000).toFixed(0)}K
                  </div>
                </div>
                <div className="bg-background p-4">
                  <div className="font-mono text-sm text-accent">{consumer.volumeBonus}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
