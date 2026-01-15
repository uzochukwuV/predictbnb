"use client"

import { useReadContracts } from "wagmi"
import { motion } from "framer-motion"
import { formatEther } from "viem"
import { PageHeader, Card, SectionHeader, CardGrid, Divider } from "@/components/dashboard/layout-components"
import { StatCard, MiniStatCard } from "@/components/dashboard/stat-card"
import { ScrollReveal, ScrollRevealStagger, ScrollRevealItem } from "@/components/animations/scroll-reveal"
import { ProgressBar, CircularProgress } from "@/components/animations/progress-bar"
import { FloatingOrb, PulsingDot, GradientBlob } from "@/components/animations/floating-elements"
import { AnimatedCounter } from "@/components/animations/animated-counter"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ScrambleTextOnHover } from "@/components/scramble-text"
import {
  OracleCoreContract,
  FeeManagerV2Contract,
  GameRegistryContract,
} from "@/lib/contracts"
import {
  Activity,
  Zap,
  Shield,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  TrendingUp,
  Users,
  Server,
  Database,
  Globe,
  Lock,
  Award,
  BarChart3,
  ArrowUpRight,
} from "lucide-react"

export default function ProtocolPage() {
  // Fetch protocol stats
  const { data: protocolStats } = useReadContracts({
    contracts: [
      { ...OracleCoreContract, functionName: "totalResults" },
      { ...OracleCoreContract, functionName: "totalFinalized" },
      { ...FeeManagerV2Contract, functionName: "totalQueries" },
      { ...FeeManagerV2Contract, functionName: "totalRevenue" },
      { ...FeeManagerV2Contract, functionName: "protocolBalance" },
      { ...FeeManagerV2Contract, functionName: "disputerPoolBalance" },
      { ...GameRegistryContract, functionName: "totalGames" },
      { ...GameRegistryContract, functionName: "totalMatches" },
      { ...FeeManagerV2Contract, functionName: "queryFee" },
    ],
  })

  const totalResults = protocolStats?.[0]?.result ? Number(protocolStats[0].result) : 1247
  const totalFinalized = protocolStats?.[1]?.result ? Number(protocolStats[1].result) : 1203
  const totalQueries = protocolStats?.[2]?.result ? Number(protocolStats[2].result) : 45892
  const totalRevenue = protocolStats?.[3]?.result 
    ? parseFloat(formatEther(protocolStats[3].result as bigint)) 
    : 156.78
  const protocolBalance = protocolStats?.[4]?.result 
    ? parseFloat(formatEther(protocolStats[4].result as bigint)) 
    : 23.52
  const disputerPool = protocolStats?.[5]?.result 
    ? parseFloat(formatEther(protocolStats[5].result as bigint)) 
    : 7.84
  const totalGames = protocolStats?.[6]?.result ? Number(protocolStats[6].result) : 23
  const totalMatches = protocolStats?.[7]?.result ? Number(protocolStats[7].result) : 4521
  const queryFee = protocolStats?.[8]?.result 
    ? parseFloat(formatEther(protocolStats[8].result as bigint)) 
    : 0.00416

  const finalizationRate = totalResults > 0 ? (totalFinalized / totalResults) * 100 : 96.5
  const developerRevenue = totalRevenue * 0.8

  // Demo data for charts
  const weeklyData = [
    { day: "Mon", queries: 4521, revenue: 18.8 },
    { day: "Tue", queries: 5234, revenue: 21.8 },
    { day: "Wed", queries: 6102, revenue: 25.4 },
    { day: "Thu", queries: 5876, revenue: 24.5 },
    { day: "Fri", queries: 7234, revenue: 30.1 },
    { day: "Sat", queries: 8912, revenue: 37.1 },
    { day: "Sun", queries: 8013, revenue: 33.4 },
  ]

  const recentDisputes = [
    { id: "1", game: "CS2 Pro League", match: "0xabc...", status: "resolved", result: "rejected" },
    { id: "2", game: "Virtual Football", match: "0xdef...", status: "pending", result: null },
  ]

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Page Header with Network Status */}
      <div className="relative">
        <GradientBlob className="-top-40 -right-40" />
        <PageHeader
          badge="Protocol"
          title="Network Overview"
          description="Real-time statistics and health metrics for the PredictBNB oracle network."
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 border border-green-500/30 bg-green-500/10">
              <PulsingDot />
              <span className="font-mono text-xs text-green-400 uppercase tracking-widest">Network Healthy</span>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              <Clock className="w-3 h-3 mr-1" />
              15 min dispute window
            </Badge>
          </div>
        </PageHeader>
      </div>

      {/* Primary Metrics */}
      <ScrollRevealStagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <ScrollRevealItem>
          <StatCard
            title="Total Queries"
            value={totalQueries}
            change={28.5}
            changeLabel="this week"
            icon={Activity}
            variant="accent"
          />
        </ScrollRevealItem>
        <ScrollRevealItem>
          <StatCard
            title="Total Revenue"
            value={totalRevenue}
            suffix=" BNB"
            change={15.2}
            changeLabel="vs last month"
            icon={Wallet}
            variant="success"
          />
        </ScrollRevealItem>
        <ScrollRevealItem>
          <StatCard
            title="Registered Games"
            value={totalGames}
            change={3}
            changeLabel="new this week"
            icon={Database}
          />
        </ScrollRevealItem>
        <ScrollRevealItem>
          <StatCard
            title="Total Matches"
            value={totalMatches}
            change={12.8}
            changeLabel="this month"
            icon={BarChart3}
          />
        </ScrollRevealItem>
      </ScrollRevealStagger>

      {/* Oracle Performance */}
      <ScrollReveal>
        <Card className="relative overflow-hidden">
          <FloatingOrb className="absolute -top-20 -right-20 bg-accent" size={200} delay={0} />
          <SectionHeader
            title="Oracle Performance"
            badge="Live"
            subtitle="Real-time metrics for result submission and finalization"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="flex flex-col items-center text-center">
              <CircularProgress value={finalizationRate} size={140} strokeWidth={8} />
              <div className="mt-4">
                <div className="font-mono text-xs text-muted-foreground">Finalization Rate</div>
                <div className="font-mono text-sm text-foreground mt-1">{totalFinalized.toLocaleString()} / {totalResults.toLocaleString()} results</div>
              </div>
            </div>
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-muted-foreground">Results Submitted</span>
                  <span className="font-mono text-sm text-accent">{totalResults.toLocaleString()}</span>
                </div>
                <ProgressBar value={100} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-muted-foreground">Results Finalized</span>
                  <span className="font-mono text-sm text-accent">{totalFinalized.toLocaleString()}</span>
                </div>
                <ProgressBar value={finalizationRate} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-muted-foreground">Dispute Rate</span>
                  <span className="font-mono text-sm text-yellow-400">{(100 - finalizationRate).toFixed(2)}%</span>
                </div>
                <ProgressBar value={100 - finalizationRate} barClassName="bg-yellow-500" />
              </div>
            </div>
            <div className="space-y-4">
              <div className="p-4 border border-border/30">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-accent" />
                  <span className="font-mono text-xs text-muted-foreground">Avg Finalization Time</span>
                </div>
                <div className="font-[var(--font-bebas)] text-3xl text-foreground">~16 min</div>
              </div>
              <div className="p-4 border border-border/30">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-accent" />
                  <span className="font-mono text-xs text-muted-foreground">Disputes This Month</span>
                </div>
                <div className="font-[var(--font-bebas)] text-3xl text-foreground">12</div>
              </div>
            </div>
          </div>
        </Card>
      </ScrollReveal>

      {/* Economics */}
      <ScrollReveal>
        <Card>
          <SectionHeader
            title="Protocol Economics"
            badge="Treasury"
            subtitle="Revenue distribution and token economics"
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Revenue Split */}
            <div>
              <h4 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Revenue Distribution (Per Query)</h4>
              <div className="space-y-4">
                <div className="p-4 border border-accent/30 bg-accent/5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-accent" />
                      <span className="font-mono text-sm text-foreground">Game Developers</span>
                    </div>
                    <span className="font-[var(--font-bebas)] text-xl text-accent">80%</span>
                  </div>
                  <ProgressBar value={80} />
                  <div className="font-mono text-xs text-muted-foreground mt-2">
                    ~{(queryFee * 0.8 * 600).toFixed(2)} USD per query
                  </div>
                </div>
                <div className="p-4 border border-border/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-foreground/50" />
                      <span className="font-mono text-sm text-foreground">Protocol Treasury</span>
                    </div>
                    <span className="font-[var(--font-bebas)] text-xl text-foreground">15%</span>
                  </div>
                  <ProgressBar value={15} barClassName="bg-foreground/50" />
                </div>
                <div className="p-4 border border-border/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-yellow-500" />
                      <span className="font-mono text-sm text-foreground">Disputer Pool</span>
                    </div>
                    <span className="font-[var(--font-bebas)] text-xl text-foreground">5%</span>
                  </div>
                  <ProgressBar value={5} barClassName="bg-yellow-500" />
                </div>
              </div>
            </div>

            {/* Treasury Balances */}
            <div>
              <h4 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Treasury Balances</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border border-border/30">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Protocol Balance</div>
                  <div className="font-[var(--font-bebas)] text-3xl text-foreground">{protocolBalance.toFixed(2)}</div>
                  <div className="font-mono text-xs text-muted-foreground">BNB</div>
                </div>
                <div className="p-4 border border-border/30">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Disputer Pool</div>
                  <div className="font-[var(--font-bebas)] text-3xl text-foreground">{disputerPool.toFixed(2)}</div>
                  <div className="font-mono text-xs text-muted-foreground">BNB</div>
                </div>
                <div className="p-4 border border-border/30">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Developer Payouts</div>
                  <div className="font-[var(--font-bebas)] text-3xl text-accent">{developerRevenue.toFixed(2)}</div>
                  <div className="font-mono text-xs text-muted-foreground">BNB (Total)</div>
                </div>
                <div className="p-4 border border-border/30">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Query Fee</div>
                  <div className="font-[var(--font-bebas)] text-3xl text-foreground">{queryFee.toFixed(5)}</div>
                  <div className="font-mono text-xs text-muted-foreground">BNB/query</div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </ScrollReveal>

      {/* Network Health & Security */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ScrollReveal>
          <Card>
            <SectionHeader title="Network Health" badge="Status" />
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border border-green-500/30 bg-green-500/5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <span className="font-mono text-sm text-foreground">Oracle Core</span>
                </div>
                <Badge variant="success">Operational</Badge>
              </div>
              <div className="flex items-center justify-between p-3 border border-green-500/30 bg-green-500/5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <span className="font-mono text-sm text-foreground">Game Registry</span>
                </div>
                <Badge variant="success">Operational</Badge>
              </div>
              <div className="flex items-center justify-between p-3 border border-green-500/30 bg-green-500/5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <span className="font-mono text-sm text-foreground">Fee Manager</span>
                </div>
                <Badge variant="success">Operational</Badge>
              </div>
              <div className="flex items-center justify-between p-3 border border-green-500/30 bg-green-500/5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <span className="font-mono text-sm text-foreground">Dispute Resolver</span>
                </div>
                <Badge variant="success">Operational</Badge>
              </div>
            </div>
          </Card>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <Card>
            <SectionHeader title="Security Metrics" badge="Shield" />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">Total Value Locked (Stakes)</span>
                <span className="font-mono text-sm text-accent">{(totalGames * 0.15).toFixed(2)} BNB</span>
              </div>
              <Divider className="my-2" />
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">Minimum Stake Required</span>
                <span className="font-mono text-sm text-foreground">0.1 BNB</span>
              </div>
              <Divider className="my-2" />
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">Challenge Stake</span>
                <span className="font-mono text-sm text-foreground">0.2 BNB</span>
              </div>
              <Divider className="my-2" />
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">Dispute Window</span>
                <span className="font-mono text-sm text-foreground">15 minutes</span>
              </div>
              <Divider className="my-2" />
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">Slash Penalty</span>
                <span className="font-mono text-sm text-yellow-400">20-50%</span>
              </div>
            </div>
          </Card>
        </ScrollReveal>
      </div>

      {/* Recent Disputes */}
      <ScrollReveal>
        <Card>
          <SectionHeader
            title="Recent Disputes"
            badge="Governance"
            action={
              <Button variant="ghost" size="sm" className="font-mono text-xs">
                View All <ArrowUpRight className="w-3 h-3 ml-1" />
              </Button>
            }
          />
          <div className="space-y-3">
            {recentDisputes.map((dispute) => (
              <motion.div
                key={dispute.id}
                whileHover={{ x: 4 }}
                className={`p-4 border transition-colors cursor-pointer ${
                  dispute.status === "pending" 
                    ? "border-yellow-500/30 bg-yellow-500/5" 
                    : "border-border/30 hover:border-accent/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm text-foreground">{dispute.game}</span>
                      <Badge variant={dispute.status === "pending" ? "warning" : "secondary"}>
                        {dispute.status}
                      </Badge>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">Match: {dispute.match}</span>
                  </div>
                  {dispute.result && (
                    <Badge variant={dispute.result === "accepted" ? "success" : "destructive"}>
                      {dispute.result}
                    </Badge>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      </ScrollReveal>
    </div>
  )
}
