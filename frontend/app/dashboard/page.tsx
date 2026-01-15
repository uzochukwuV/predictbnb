"use client"

import { useAccount } from "wagmi"
import { motion } from "framer-motion"
import Link from "next/link"
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
  useProtocolStats,
  useAllGames,
  useContractsDeployed,
} from "@/lib/hooks/useContractData"
import { DEMO_RECENT_ACTIVITY } from "@/lib/data/demo-data"
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
  AlertTriangle,
} from "lucide-react"

export default function DashboardOverview() {
  const { address, isConnected } = useAccount()
  const deployed = useContractsDeployed()
  
  // Fetch protocol stats using custom hook
  const { data: protocolStats, isLoading: statsLoading } = useProtocolStats()
  
  // Fetch all games
  const { data: games, isLoading: gamesLoading } = useAllGames()

  // Get top 3 games by queries
  const topGames = [...games]
    .sort((a, b) => b.queries - a.queries)
    .slice(0, 3)
    .map(game => ({
      id: game.id,
      name: game.name,
      type: game.type,
      queries: game.queries,
      revenue: game.revenue,
      status: game.status,
    }))

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Demo Mode Banner */}
      {!protocolStats.isLive && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 border border-yellow-500/30 bg-yellow-500/5 flex items-center gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-yellow-400" />
          <div className="flex-1">
            <span className="font-mono text-xs text-yellow-400 uppercase tracking-widest">Demo Mode</span>
            <p className="font-mono text-xs text-muted-foreground mt-1">
              Contracts not deployed. Showing demonstration data. Deploy contracts to see live blockchain data.
            </p>
          </div>
          <Badge variant="warning">Demo Data</Badge>
        </motion.div>
      )}

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
            value={protocolStats.totalGames}
            change={12.5}
            changeLabel="this month"
            icon={Gamepad2}
            variant="accent"
          />
        </ScrollRevealItem>
        <ScrollRevealItem>
          <StatCard
            title="Total Queries"
            value={protocolStats.totalQueries}
            change={28.3}
            changeLabel="this week"
            icon={Activity}
          />
        </ScrollRevealItem>
        <ScrollRevealItem>
          <StatCard
            title="Total Revenue"
            value={protocolStats.totalRevenue}
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
            value={protocolStats.finalizationRate}
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
              <span className="font-mono text-sm text-accent">
                {protocolStats.isLive ? "Network Active" : "Demo Mode"}
              </span>
              <Badge variant={protocolStats.isLive ? "success" : "warning"}>
                {protocolStats.isLive ? "Live" : "Demo"}
              </Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Results Submitted</div>
                <div className="font-[var(--font-bebas)] text-3xl text-foreground">{protocolStats.totalResults.toLocaleString()}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Results Finalized</div>
                <div className="font-[var(--font-bebas)] text-3xl text-foreground">{protocolStats.totalFinalized.toLocaleString()}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Total Matches</div>
                <div className="font-[var(--font-bebas)] text-3xl text-foreground">{protocolStats.totalMatches.toLocaleString()}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Dispute Rate</div>
                <div className="font-[var(--font-bebas)] text-3xl text-foreground">{protocolStats.disputeRate.toFixed(2)}%</div>
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
              {DEMO_RECENT_ACTIVITY.slice(0, 4).map((activity, index) => (
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
          <MiniStatCard title="Avg Query Fee" value={protocolStats.queryFee.toFixed(5)} suffix=" BNB" />
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
                <div className="font-mono text-[10px] text-muted-foreground">~${(protocolStats.queryFee * 600 * 0.8).toFixed(2)}/query</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <CircularProgress value={15} size={80} strokeWidth={6} />
              <div>
                <div className="font-mono text-xs text-muted-foreground">Protocol</div>
                <div className="font-[var(--font-bebas)] text-2xl text-foreground">15%</div>
                <div className="font-mono text-[10px] text-muted-foreground">~${(protocolStats.queryFee * 600 * 0.15).toFixed(2)}/query</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <CircularProgress value={5} size={80} strokeWidth={6} />
              <div>
                <div className="font-mono text-xs text-muted-foreground">Disputers</div>
                <div className="font-[var(--font-bebas)] text-2xl text-foreground">5%</div>
                <div className="font-mono text-[10px] text-muted-foreground">~${(protocolStats.queryFee * 600 * 0.05).toFixed(2)}/query</div>
              </div>
            </div>
          </div>
        </Card>
      </ScrollReveal>
    </div>
  )
}
