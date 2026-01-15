"use client"

import { useState } from "react"
import { useAccount } from "wagmi"
import { motion, AnimatePresence } from "framer-motion"
import { PageHeader, Card, SectionHeader, EmptyState, CardGrid } from "@/components/dashboard/layout-components"
import { StatCard, MiniStatCard } from "@/components/dashboard/stat-card"
import { ScrollReveal, ScrollRevealStagger, ScrollRevealItem } from "@/components/animations/scroll-reveal"
import { ProgressBar, CircularProgress } from "@/components/animations/progress-bar"
import { PulsingDot, FloatingOrb } from "@/components/animations/floating-elements"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ScrambleTextOnHover } from "@/components/scramble-text"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useContractsDeployed } from "@/lib/hooks/useContractData"
import { DEMO_MARKETS, type Market } from "@/lib/data/demo-data"
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  Wallet,
  Target,
  Users,
  DollarSign,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Timer,
  Award,
  AlertTriangle,
} from "lucide-react"

export default function MarketsPage() {
  const { address, isConnected } = useAccount()
  const deployed = useContractsDeployed()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null)
  const [betAmount, setBetAmount] = useState("")
  const [selectedOption, setSelectedOption] = useState<"A" | "B" | null>(null)

  // Use demo markets data
  const markets = DEMO_MARKETS

  const filteredMarkets = markets.filter((market) =>
    market.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    market.game.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const activeMarkets = markets.filter((m) => m.status === "active").length
  const totalVolume = markets.reduce((sum, m) => sum + parseFloat(m.totalPool), 0)
  const totalParticipants = markets.reduce((sum, m) => sum + m.participants, 0)

  const getStatusColor = (status: Market["status"]) => {
    switch (status) {
      case "active":
        return "accent"
      case "resolved":
        return "success"
      case "pending":
        return "warning"
      case "disputed":
        return "destructive"
      default:
        return "secondary"
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Demo Mode Banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 border border-yellow-500/30 bg-yellow-500/5 flex items-center gap-3"
      >
        <AlertTriangle className="w-5 h-5 text-yellow-400" />
        <div className="flex-1">
          <span className="font-mono text-xs text-yellow-400 uppercase tracking-widest">Demo Mode</span>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            Prediction markets use demonstration data. Deploy VirtualFootballMarket contract for live betting.
          </p>
        </div>
        <Badge variant="warning">Demo Data</Badge>
      </motion.div>

      {/* Page Header */}
      <PageHeader
        badge="Markets"
        title="Prediction Markets"
        description="Browse active markets, place predictions, and track your positions on oracle-verified outcomes."
      >
        <div className="flex items-center gap-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button className="font-mono text-xs uppercase tracking-widest">
                <Plus className="w-4 h-4 mr-2" />
                <ScrambleTextOnHover text="Create Market" duration={0.4} />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-[var(--font-bebas)] text-2xl">Create Prediction Market</DialogTitle>
                <DialogDescription className="font-mono text-xs text-muted-foreground">
                  Create a market for an upcoming match from a registered game.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-2">
                    Select Game
                  </label>
                  <Input placeholder="Choose a game..." />
                </div>
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-2">
                    Match ID
                  </label>
                  <Input placeholder="Enter match ID" />
                </div>
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-2">
                    Market Title
                  </label>
                  <Input placeholder="Who will win?" />
                </div>
                <div className="p-3 border border-yellow-500/30 bg-yellow-500/5">
                  <span className="font-mono text-xs text-yellow-400">
                    Contracts not deployed - market creation is disabled
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 font-mono text-xs uppercase tracking-widest">
                  Cancel
                </Button>
                <Button disabled className="flex-1 font-mono text-xs uppercase tracking-widest">
                  <Zap className="w-4 h-4 mr-2" />
                  Create
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      {/* Stats */}
      <ScrollRevealStagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <ScrollRevealItem>
          <StatCard
            title="Active Markets"
            value={activeMarkets}
            icon={Target}
            variant="accent"
          />
        </ScrollRevealItem>
        <ScrollRevealItem>
          <StatCard
            title="Total Volume"
            value={totalVolume}
            suffix=" BNB"
            change={24.5}
            changeLabel="this week"
            icon={DollarSign}
          />
        </ScrollRevealItem>
        <ScrollRevealItem>
          <StatCard
            title="Participants"
            value={totalParticipants}
            change={15.2}
            changeLabel="vs last week"
            icon={Users}
          />
        </ScrollRevealItem>
        <ScrollRevealItem>
          <StatCard
            title="Avg Pool Size"
            value={(totalVolume / markets.length)}
            suffix=" BNB"
            icon={TrendingUp}
          />
        </ScrollRevealItem>
      </ScrollRevealStagger>

      {/* Search & Filter */}
      <ScrollReveal>
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search markets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" className="font-mono text-xs uppercase tracking-widest">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
        </div>
      </ScrollReveal>

      {/* Markets List */}
      <ScrollReveal>
        <Card>
          <Tabs defaultValue="all" className="w-full">
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="all">All Markets</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="resolved">Resolved</TabsTrigger>
                <TabsTrigger value="my">My Positions</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="all" className="space-y-4">
              <AnimatePresence>
                {filteredMarkets.map((market, index) => (
                  <MarketCard 
                    key={market.id} 
                    market={market} 
                    index={index}
                    getStatusColor={getStatusColor}
                  />
                ))}
              </AnimatePresence>
            </TabsContent>

            <TabsContent value="active">
              {filteredMarkets.filter(m => m.status === "active").length > 0 ? (
                <div className="space-y-4">
                  {filteredMarkets.filter(m => m.status === "active").map((market, index) => (
                    <MarketCard 
                      key={market.id} 
                      market={market} 
                      index={index}
                      getStatusColor={getStatusColor}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState icon={Target} title="No Active Markets" description="Check back later for new markets." />
              )}
            </TabsContent>

            <TabsContent value="resolved">
              {filteredMarkets.filter(m => m.status === "resolved").length > 0 ? (
                <div className="space-y-4">
                  {filteredMarkets.filter(m => m.status === "resolved").map((market, index) => (
                    <MarketCard 
                      key={market.id} 
                      market={market} 
                      index={index}
                      getStatusColor={getStatusColor}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState icon={CheckCircle2} title="No Resolved Markets" description="Markets will appear here once resolved." />
              )}
            </TabsContent>

            <TabsContent value="my">
              <EmptyState
                icon={Wallet}
                title="No Positions Yet"
                description="Place predictions on active markets to see your positions here."
                action={
                  <Button variant="outline" className="font-mono text-xs uppercase tracking-widest">
                    Browse Markets
                  </Button>
                }
              />
            </TabsContent>
          </Tabs>
        </Card>
      </ScrollReveal>
    </div>
  )
}

// Market Card Component
function MarketCard({ 
  market, 
  index, 
  getStatusColor 
}: { 
  market: Market
  index: number
  getStatusColor: (status: Market["status"]) => string
}) {
  const [betAmount, setBetAmount] = useState("")
  const [selectedOption, setSelectedOption] = useState<"A" | "B" | null>(null)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ delay: index * 0.05 }}
    >
      <Sheet>
        <SheetTrigger asChild>
          <motion.div
            whileHover={{ x: 4 }}
            className="p-5 border border-border/30 hover:border-accent/50 transition-all cursor-pointer relative overflow-hidden"
          >
            {market.status === "active" && (
              <div className="absolute top-0 right-0 w-20 h-20">
                <FloatingOrb className="bg-accent" size={60} />
              </div>
            )}
            <div className="relative">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={getStatusColor(market.status) as any}>{market.status}</Badge>
                    <span className="font-mono text-[10px] text-muted-foreground">{market.game}</span>
                    {!market.isLive && <Badge variant="warning">Demo</Badge>}
                  </div>
                  <h3 className="font-mono text-sm text-foreground font-medium">{market.title}</h3>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Timer className="w-4 h-4" />
                  <span className="font-mono text-xs">{market.endsAt}</span>
                </div>
              </div>

              {/* Options */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className={`p-3 border transition-colors ${
                  market.winner === market.optionA.label 
                    ? "border-green-500/50 bg-green-500/10" 
                    : "border-border/30 hover:border-accent/30"
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs text-foreground">{market.optionA.label}</span>
                    {market.winner === market.optionA.label && (
                      <Award className="w-4 h-4 text-green-400" />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-[var(--font-bebas)] text-lg text-accent">{market.optionA.odds}x</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{market.optionA.pool} BNB</span>
                  </div>
                </div>
                <div className={`p-3 border transition-colors ${
                  market.winner === market.optionB.label 
                    ? "border-green-500/50 bg-green-500/10" 
                    : "border-border/30 hover:border-accent/30"
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs text-foreground">{market.optionB.label}</span>
                    {market.winner === market.optionB.label && (
                      <Award className="w-4 h-4 text-green-400" />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-[var(--font-bebas)] text-lg text-accent">{market.optionB.odds}x</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{market.optionB.pool} BNB</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    <Users className="w-3 h-3 inline mr-1" />
                    {market.participants} participants
                  </span>
                  <span className="font-mono text-[10px] text-accent">
                    Pool: {market.totalPool} BNB
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </motion.div>
        </SheetTrigger>
        <SheetContent side="right" className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle className="font-[var(--font-bebas)] text-2xl">{market.title}</SheetTitle>
            <SheetDescription className="font-mono text-xs">{market.game} • {market.matchId}</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {/* Market Stats */}
            <div className="grid grid-cols-2 gap-4">
              <MiniStatCard title="Total Pool" value={market.totalPool} suffix=" BNB" />
              <MiniStatCard title="Participants" value={market.participants} />
            </div>

            {/* Place Bet */}
            {market.status === "active" && (
              <div className="p-4 border border-accent/30 bg-accent/5">
                <div className="font-mono text-xs text-accent mb-4">Place Your Prediction</div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <Button
                    variant={selectedOption === "A" ? "default" : "outline"}
                    onClick={() => setSelectedOption("A")}
                    className="font-mono text-xs flex-col h-auto py-3"
                  >
                    <span>{market.optionA.label}</span>
                    <span className="text-accent text-lg font-bold">{market.optionA.odds}x</span>
                  </Button>
                  <Button
                    variant={selectedOption === "B" ? "default" : "outline"}
                    onClick={() => setSelectedOption("B")}
                    className="font-mono text-xs flex-col h-auto py-3"
                  >
                    <span>{market.optionB.label}</span>
                    <span className="text-accent text-lg font-bold">{market.optionB.odds}x</span>
                  </Button>
                </div>
                <div className="flex gap-3">
                  <Input
                    type="number"
                    placeholder="Amount in BNB"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                  />
                  <Button disabled={!selectedOption || !betAmount} className="font-mono text-xs uppercase">
                    Place Bet
                  </Button>
                </div>
                {selectedOption && betAmount && (
                  <div className="mt-3 p-2 border border-border/30">
                    <div className="font-mono text-[10px] text-muted-foreground">Potential Payout</div>
                    <div className="font-[var(--font-bebas)] text-xl text-accent">
                      {(parseFloat(betAmount) * (selectedOption === "A" ? market.optionA.odds : market.optionB.odds)).toFixed(4)} BNB
                    </div>
                  </div>
                )}
                <div className="mt-3 p-2 border border-yellow-500/30 bg-yellow-500/5">
                  <span className="font-mono text-[10px] text-yellow-400">
                    Demo mode - betting is disabled
                  </span>
                </div>
              </div>
            )}

            {/* Pool Distribution */}
            <div>
              <div className="font-mono text-xs text-muted-foreground mb-3">Pool Distribution</div>
              <ProgressBar
                value={parseFloat(market.optionA.pool)}
                max={parseFloat(market.totalPool)}
                label={`${market.optionA.label}: ${((parseFloat(market.optionA.pool) / parseFloat(market.totalPool)) * 100).toFixed(1)}%`}
                showLabel
              />
            </div>

            {/* Match Info */}
            <div className="p-4 border border-border/30">
              <div className="font-mono text-xs text-muted-foreground mb-2">Oracle Status</div>
              <div className="flex items-center gap-2">
                {market.status === "resolved" ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <span className="font-mono text-xs text-green-400">Result Verified</span>
                  </>
                ) : market.status === "pending" ? (
                  <>
                    <Clock className="w-4 h-4 text-yellow-400" />
                    <span className="font-mono text-xs text-yellow-400">Awaiting Result</span>
                  </>
                ) : (
                  <>
                    <PulsingDot />
                    <span className="font-mono text-xs text-accent">Live</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </motion.div>
  )
}
