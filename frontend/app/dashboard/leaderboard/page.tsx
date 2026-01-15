"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { PageHeader, Card, SectionHeader, EmptyState } from "@/components/dashboard/layout-components"
import { ScrollReveal, ScrollRevealStagger, ScrollRevealItem } from "@/components/animations/scroll-reveal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Trophy,
  Medal,
  Crown,
  TrendingUp,
  Gamepad2,
  Users,
  Wallet,
  Star,
  Award,
  Target,
} from "lucide-react"

interface LeaderboardEntry {
  rank: number
  address: string
  name?: string
  value: string
  secondaryValue?: string
  change: number
}

export default function LeaderboardPage() {
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d" | "all">("30d")

  // Demo leaderboard data
  const topGamesByQueries: LeaderboardEntry[] = [
    { rank: 1, address: "0x123...", name: "Virtual Football League", value: "24,521", secondaryValue: "4.82 BNB", change: 15 },
    { rank: 2, address: "0x456...", name: "RPS Championship", value: "18,932", secondaryValue: "3.72 BNB", change: 8 },
    { rank: 3, address: "0x789...", name: "CS2 Pro League", value: "15,721", secondaryValue: "3.09 BNB", change: 12 },
    { rank: 4, address: "0xabc...", name: "League of Legends Esports", value: "12,450", secondaryValue: "2.45 BNB", change: -3 },
    { rank: 5, address: "0xdef...", name: "Dota 2 International", value: "9,876", secondaryValue: "1.94 BNB", change: 22 },
  ]

  const topDevelopers: LeaderboardEntry[] = [
    { rank: 1, address: "0xaaa...", name: "GameStudio Pro", value: "8.45 BNB", secondaryValue: "3 games", change: 18 },
    { rank: 2, address: "0xbbb...", name: "Esports Hub", value: "6.23 BNB", secondaryValue: "2 games", change: 12 },
    { rank: 3, address: "0xccc...", name: "Casual Games Inc", value: "4.87 BNB", secondaryValue: "5 games", change: 8 },
    { rank: 4, address: "0xddd...", name: "Tournament Masters", value: "3.56 BNB", secondaryValue: "1 game", change: 25 },
    { rank: 5, address: "0xeee...", name: "Indie Oracle", value: "2.12 BNB", secondaryValue: "2 games", change: -5 },
  ]

  const topBettors: LeaderboardEntry[] = [
    { rank: 1, address: "0x111...", value: "156 wins", secondaryValue: "78% win rate", change: 5 },
    { rank: 2, address: "0x222...", value: "134 wins", secondaryValue: "72% win rate", change: 8 },
    { rank: 3, address: "0x333...", value: "128 wins", secondaryValue: "65% win rate", change: -2 },
    { rank: 4, address: "0x444...", value: "98 wins", secondaryValue: "81% win rate", change: 15 },
    { rank: 5, address: "0x555...", value: "87 wins", secondaryValue: "59% win rate", change: 3 },
  ]

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-5 h-5 text-yellow-400" />
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />
      case 3:
        return <Medal className="w-5 h-5 text-amber-600" />
      default:
        return <span className="font-[var(--font-bebas)] text-lg text-muted-foreground">#{rank}</span>
    }
  }

  const LeaderboardTable = ({
    entries,
    valueLabel,
    secondaryLabel,
  }: {
    entries: LeaderboardEntry[]
    valueLabel: string
    secondaryLabel?: string
  }) => (
    <div className="space-y-2">
      {entries.map((entry, index) => (
        <motion.div
          key={entry.rank}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          whileHover={{ x: 4 }}
          className={`p-4 border transition-all cursor-pointer ${
            entry.rank <= 3 
              ? "border-accent/30 bg-accent/5 hover:border-accent/50" 
              : "border-border/30 hover:border-accent/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 flex items-center justify-center">
                {getRankIcon(entry.rank)}
              </div>
              <div>
                {entry.name && (
                  <div className="font-mono text-sm text-foreground font-medium">{entry.name}</div>
                )}
                <div className="font-mono text-xs text-muted-foreground">{entry.address}</div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{valueLabel}</div>
                <div className="font-[var(--font-bebas)] text-xl text-accent">{entry.value}</div>
              </div>
              {entry.secondaryValue && secondaryLabel && (
                <div className="text-right">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{secondaryLabel}</div>
                  <div className="font-mono text-sm text-foreground">{entry.secondaryValue}</div>
                </div>
              )}
              <div className={`flex items-center gap-1 ${
                entry.change >= 0 ? "text-green-400" : "text-red-400"
              }`}>
                <TrendingUp className={`w-4 h-4 ${entry.change < 0 ? "rotate-180" : ""}`} />
                <span className="font-mono text-xs">{entry.change >= 0 ? "+" : ""}{entry.change}%</span>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <PageHeader
        badge="Leaderboard"
        title="Top Performers"
        description="Rankings of the best games, developers, and bettors on the PredictBNB network."
      >
        <div className="flex items-center gap-2">
          {(["24h", "7d", "30d", "all"] as const).map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? "default" : "outline"}
              onClick={() => setTimeRange(range)}
              className="font-mono text-xs uppercase tracking-widest"
            >
              {range === "all" ? "All Time" : range}
            </Button>
          ))}
        </div>
      </PageHeader>

      {/* Top 3 Showcase */}
      <ScrollReveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {topGamesByQueries.slice(0, 3).map((game, index) => (
            <motion.div
              key={game.rank}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative p-6 border ${
                index === 0 
                  ? "border-yellow-500/50 bg-yellow-500/5 md:col-span-1 md:order-2" 
                  : index === 1 
                  ? "border-gray-400/50 bg-gray-400/5 md:order-1" 
                  : "border-amber-600/50 bg-amber-600/5 md:order-3"
              }`}
            >
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                {getRankIcon(game.rank)}
              </div>
              <div className="text-center pt-4">
                <div className="font-mono text-lg text-foreground font-medium mb-1">{game.name}</div>
                <div className="font-mono text-xs text-muted-foreground mb-4">{game.address}</div>
                <div className="font-[var(--font-bebas)] text-4xl text-accent mb-2">{game.value}</div>
                <div className="font-mono text-xs text-muted-foreground">Total Queries</div>
                <div className="mt-4 pt-4 border-t border-border/30">
                  <div className="font-mono text-sm text-accent">{game.secondaryValue}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">Revenue Earned</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </ScrollReveal>

      {/* Leaderboard Tabs */}
      <ScrollReveal>
        <Card>
          <Tabs defaultValue="games" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="games" className="gap-2">
                <Gamepad2 className="w-4 h-4" />
                Top Games
              </TabsTrigger>
              <TabsTrigger value="developers" className="gap-2">
                <Users className="w-4 h-4" />
                Top Developers
              </TabsTrigger>
              <TabsTrigger value="bettors" className="gap-2">
                <Target className="w-4 h-4" />
                Top Bettors
              </TabsTrigger>
            </TabsList>

            <TabsContent value="games">
              <SectionHeader
                title="Games by Query Volume"
                subtitle="Most queried games on the oracle network"
              />
              <LeaderboardTable
                entries={topGamesByQueries}
                valueLabel="Queries"
                secondaryLabel="Revenue"
              />
            </TabsContent>

            <TabsContent value="developers">
              <SectionHeader
                title="Developer Earnings"
                subtitle="Top earning game developers"
              />
              <LeaderboardTable
                entries={topDevelopers}
                valueLabel="Earned"
                secondaryLabel="Games"
              />
            </TabsContent>

            <TabsContent value="bettors">
              <SectionHeader
                title="Most Successful Bettors"
                subtitle="Users with the most winning predictions"
              />
              <LeaderboardTable
                entries={topBettors}
                valueLabel="Performance"
                secondaryLabel="Win Rate"
              />
            </TabsContent>
          </Tabs>
        </Card>
      </ScrollReveal>

      {/* Achievement Badges */}
      <ScrollReveal>
        <Card>
          <SectionHeader
            title="Achievement Badges"
            badge="Rewards"
            subtitle="Special recognition for outstanding performance"
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Crown, label: "Query King", desc: "10K+ queries", unlocked: true },
              { icon: Star, label: "Rising Star", desc: "1K queries in first week", unlocked: true },
              { icon: Award, label: "Trusted Oracle", desc: "99%+ finalization", unlocked: false },
              { icon: Trophy, label: "Champion", desc: "#1 in any category", unlocked: false },
            ].map((badge, index) => (
              <motion.div
                key={badge.label}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className={`p-4 border text-center transition-colors ${
                  badge.unlocked 
                    ? "border-accent/50 bg-accent/5" 
                    : "border-border/30 opacity-50"
                }`}
              >
                <badge.icon className={`w-8 h-8 mx-auto mb-2 ${
                  badge.unlocked ? "text-accent" : "text-muted-foreground"
                }`} />
                <div className="font-mono text-sm text-foreground mb-1">{badge.label}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{badge.desc}</div>
              </motion.div>
            ))}
          </div>
        </Card>
      </ScrollReveal>
    </div>
  )
}
