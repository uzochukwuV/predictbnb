"use client"

import { useAccount, useReadContracts } from "wagmi"
import { motion } from "framer-motion"
import { formatEther } from "viem"
import { PageHeader, CardGrid, Card, SectionHeader, Divider, EmptyState } from "@/components/dashboard/layout-components"
import { StatCard, MiniStatCard } from "@/components/dashboard/stat-card"
import { GameListItem, DataTable } from "@/components/dashboard/data-table"
import { ScrollReveal, ScrollRevealStagger, ScrollRevealItem } from "@/components/animations/scroll-reveal"
import { ProgressBar, CircularProgress } from "@/components/animations/progress-bar"
import { FloatingOrb, PulsingDot } from "@/components/animations/floating-elements"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ScrambleTextOnHover } from "@/components/scramble-text"
import {
  GameRegistryContract,
  OracleCoreContract,
  FeeManagerV2Contract,
} from "@/lib/contracts"
import {
  Gamepad2,
  TrendingUp,
  Wallet,
  Activity,
  Zap,
  Users,
  BarChart3,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trophy,
} from "lucide-react"
import Link from "next/link"

export default function DashboardOverview() {
  const { address, isConnected } = useAccount()

  // Fetch protocol stats
  const { data: protocolStats } = useReadContracts({
    contracts: [
      { ...OracleCoreContract, functionName: "totalResults" },
      { ...OracleCoreContract, functionName: "totalFinalized" },
      { ...FeeManagerV2Contract, functionName: "totalQueries" },
      { ...FeeManagerV2Contract, functionName: "totalRevenue" },
      { ...GameRegistryContract, functionName: "totalGames" },
      { ...GameRegistryContract, functionName: "totalMatches" },
    ],
  })

  const totalResults = protocolStats?.[0]?.result ? Number(protocolStats[0].result) : 0
  const totalFinalized = protocolStats?.[1]?.result ? Number(protocolStats[1].result) : 0
  const totalQueries = protocolStats?.[2]?.result ? Number(protocolStats[2].result) : 0
  const totalRevenue = protocolStats?.[3]?.result 
    ? parseFloat(formatEther(protocolStats[3].result as bigint)) 
    : 0
  const totalGames = protocolStats?.[4]?.result ? Number(protocolStats[4].result) : 0
  const totalMatches = protocolStats?.[5]?.result ? Number(protocolStats[5].result) : 0

  // Demo data for recent activity
  const recentActivity = [
    { id: 1, type: "result", game: "Virtual Football", action: "Result submitted", time: "2 mins ago", status: "pending" },
    { id: 2, type: "market", game: "RPS Battle", action: "Market resolved", time: "5 mins ago", status: "success" },
    { id: 3, type: "query", game: "CS Tournament", action: "Query executed", time: "12 mins ago", status: "success" },
    { id: 4, type: "dispute", game: "League Match", action: "Dispute created", time: "1 hour ago", status: "warning" },
  ]

  const topGames = [
    { id: "1", name: "Virtual Football League", type: "Sports", queries: 12450, revenue: "2.45", status: "active" as const },
    { id: "2", name: "RPS Championship", type: "Casual", queries: 8932, revenue: "1.78", status: "active" as const },
    { id: "3", name: "CS2 Pro League", type: "Esports", queries: 6721, revenue: "1.34", status: "active" as const },
  ]

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <PageHeader
        badge="Dashboard"
        title="Protocol Overview"
        description="Monitor the PredictBNB oracle network, track game performance, and manage your activities."
      >
        <div className="flex items-center gap-4">
          <Link href="/dashboard/games">
            <Button variant="outline" className="font-mono text-xs uppercase tracking-widest">
              <Gamepad2 className="w-4 h-4 mr-2" />
              <ScrambleTextOnHover text="View Games" duration={0.4} />
            </Button>
          </Link>
          <Link href="/dashboard/markets">
            <Button className="font-mono text-xs uppercase tracking-widest">
              <TrendingUp className="w-4 h-4 mr-2" />
              <ScrambleTextOnHover text="View Markets" duration={0.4} />
            </Button>
          </Link>
        </div>
      </PageHeader>

      {/* Key Metrics */}
      <ScrollRevealStagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <ScrollRevealItem>
          <StatCard
            title="Total Games"
            value={totalGames}
            change={12.5}
            changeLabel="this month"
            icon={Gamepad2}
            variant="accent"
          />
        </ScrollRevealItem>
        <ScrollRevealItem>
          <StatCard
            title="Total Queries"
            value={totalQueries}
            change={28.3}
            changeLabel="this week"
            icon={Activity}
          />
        </ScrollRevealItem>
        <ScrollRevealItem>
          <StatCard
            title="Total Revenue"
            value={totalRevenue}
            suffix=" BNB"
            change={15.7}
            changeLabel="vs last month"
            icon={Wallet}
            variant="success"
          />
        </ScrollRevealItem>
        <ScrollRevealItem>
          <StatCard
            title="Finalization Rate"
            value={totalResults > 0 ? ((totalFinalized / totalResults) * 100) : 100}
            suffix="%"
            icon={CheckCircle2}
          />
        </ScrollRevealItem>
      </ScrollRevealStagger>

      {/* Network Status */}
      <ScrollReveal>
        <Card className="relative overflow-hidden">
          <FloatingOrb className="absolute -top-20 -right-20 bg-accent" size={150} delay={0} />
          <div className="relative">
            <div className="flex items-center gap-3 mb-6">
              <PulsingDot />
              <span className="font-mono text-sm text-accent">Network Active</span>
              <Badge variant="success">Healthy</Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Results Submitted</div>
                <div className="font-[var(--font-bebas)] text-3xl text-foreground">{totalResults.toLocaleString()}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Results Finalized</div>
                <div className="font-[var(--font-bebas)] text-3xl text-foreground">{totalFinalized.toLocaleString()}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Total Matches</div>
                <div className="font-[var(--font-bebas)] text-3xl text-foreground">{totalMatches.toLocaleString()}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Dispute Rate</div>
                <div className="font-[var(--font-bebas)] text-3xl text-foreground">0.02%</div>
              </div>
            </div>
          </div>
        </Card>
      </ScrollReveal>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Games */}
        <ScrollReveal className="lg:col-span-2">
          <Card>
            <SectionHeader
              title="Top Performing Games"
              badge="Games"
              action={
                <Link href="/dashboard/games">
                  <Button variant="ghost" size="sm" className="font-mono text-xs">
                    View All <ArrowUpRight className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              }
            />
            <div className="space-y-3">
              {topGames.map((game, index) => (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <GameListItem
                    name={game.name}
                    type={game.type}
                    queries={game.queries}
                    revenue={game.revenue}
                    status={game.status}
                  />
                </motion.div>
              ))}
            </div>
          </Card>
        </ScrollReveal>

        {/* Recent Activity */}
        <ScrollReveal delay={0.2}>
          <Card>
            <SectionHeader title="Recent Activity" badge="Live" />
            <div className="space-y-3">
              {recentActivity.map((activity, index) => (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start gap-3 p-3 border border-border/30 hover:border-accent/30 transition-colors"
                >
                  <div className={`w-8 h-8 flex items-center justify-center border ${
                    activity.status === "success" ? "border-green-500/50 text-green-400" :
                    activity.status === "warning" ? "border-yellow-500/50 text-yellow-400" :
                    "border-accent/50 text-accent"
                  }`}>
                    {activity.status === "success" && <CheckCircle2 className="w-4 h-4" />}
                    {activity.status === "warning" && <AlertCircle className="w-4 h-4" />}
                    {activity.status === "pending" && <Clock className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs text-foreground truncate">{activity.action}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{activity.game}</p>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                    {activity.time}
                  </span>
                </motion.div>
              ))}
            </div>
          </Card>
        </ScrollReveal>
      </div>

      {/* Quick Stats Row */}
      <ScrollReveal>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MiniStatCard title="Avg Query Fee" value="0.00416" suffix=" BNB" />
          <MiniStatCard title="Developer Share" value="80" suffix="%" />
          <MiniStatCard title="Dispute Window" value="15" suffix=" min" />
          <MiniStatCard title="Min Stake" value="0.1" suffix=" BNB" />
        </div>
      </ScrollReveal>

      {/* Revenue Distribution */}
      <ScrollReveal>
        <Card>
          <SectionHeader
            title="Revenue Distribution"
            badge="Economics"
            subtitle="How query fees are distributed across the protocol"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-4">
              <CircularProgress value={80} size={80} strokeWidth={6} />
              <div>
                <div className="font-mono text-xs text-muted-foreground">Developers</div>
                <div className="font-[var(--font-bebas)] text-2xl text-accent">80%</div>
                <div className="font-mono text-[10px] text-muted-foreground">~$1.44/query</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <CircularProgress value={15} size={80} strokeWidth={6} />
              <div>
                <div className="font-mono text-xs text-muted-foreground">Protocol</div>
                <div className="font-[var(--font-bebas)] text-2xl text-foreground">15%</div>
                <div className="font-mono text-[10px] text-muted-foreground">~$0.27/query</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <CircularProgress value={5} size={80} strokeWidth={6} />
              <div>
                <div className="font-mono text-xs text-muted-foreground">Disputers</div>
                <div className="font-[var(--font-bebas)] text-2xl text-foreground">5%</div>
                <div className="font-mono text-[10px] text-muted-foreground">~$0.09/query</div>
              </div>
            </div>
          </div>
        </Card>
      </ScrollReveal>
    </div>
  )
}
