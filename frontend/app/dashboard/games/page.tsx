"use client"

import { useState } from "react"
import { useAccount } from "wagmi"
import { motion, AnimatePresence } from "framer-motion"
import { PageHeader, Card, SectionHeader, EmptyState, CardGrid } from "@/components/dashboard/layout-components"
import { StatCard, MiniStatCard } from "@/components/dashboard/stat-card"
import { ScrollReveal, ScrollRevealStagger, ScrollRevealItem } from "@/components/animations/scroll-reveal"
import { ProgressBar } from "@/components/animations/progress-bar"
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
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerTrigger,
  DrawerFooter,
} from "@/components/ui/drawer"
import {
  useDeveloperGames,
  useRegisterGame,
  useWithdrawEarnings,
  useContractsDeployed,
  type Game,
} from "@/lib/hooks/useContractData"
import {
  Gamepad2,
  Plus,
  Search,
  Filter,
  Wallet,
  TrendingUp,
  Clock,
  CheckCircle2,
  ChevronRight,
  Zap,
  RefreshCw,
  AlertTriangle,
} from "lucide-react"

export default function GamesPage() {
  const { address, isConnected } = useAccount()
  const deployed = useContractsDeployed()
  const [searchQuery, setSearchQuery] = useState("")
  const [registerOpen, setRegisterOpen] = useState(false)
  const [newGameName, setNewGameName] = useState("")
  const [newGameMetadata, setNewGameMetadata] = useState("")

  // Fetch developer's games using custom hook
  const { data: games, isLoading, refetch } = useDeveloperGames(address)

  // Register game hook
  const { 
    registerGame, 
    isPending: isRegistering, 
    isConfirming, 
    isSuccess: registerSuccess 
  } = useRegisterGame()

  // Withdraw earnings hook
  const { withdraw, isPending: isWithdrawing } = useWithdrawEarnings()

  const handleRegisterGame = () => {
    if (!newGameName) return
    registerGame(newGameName, newGameMetadata || "{}")
  }

  const filteredGames = games.filter((game) =>
    game.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalRevenue = games.reduce((sum, g) => sum + parseFloat(g.revenue), 0)
  const totalQueries = games.reduce((sum, g) => sum + g.queries, 0)
  const avgReputation = games.length > 0 
    ? Math.round(games.reduce((sum, g) => sum + g.reputation, 0) / games.length)
    : 0

  if (!isConnected) {
    return (
      <div className="max-w-7xl mx-auto">
        <PageHeader
          badge="Games"
          title="Your Games"
          description="Connect your wallet to view and manage your registered games."
        />
        <EmptyState
          icon={Wallet}
          title="Wallet Not Connected"
          description="Please connect your wallet to view your games and earnings."
          action={
            <Button className="font-mono text-xs uppercase tracking-widest">
              <Wallet className="w-4 h-4 mr-2" />
              Connect Wallet
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Demo Mode Banner */}
      {!games[0]?.isLive && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 border border-yellow-500/30 bg-yellow-500/5 flex items-center gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-yellow-400" />
          <div className="flex-1">
            <span className="font-mono text-xs text-yellow-400 uppercase tracking-widest">Demo Mode</span>
            <p className="font-mono text-xs text-muted-foreground mt-1">
              Showing demonstration data. Deploy contracts to interact with real blockchain.
            </p>
          </div>
        </motion.div>
      )}

      {/* Page Header */}
      <PageHeader
        badge="Games"
        title="Your Games"
        description="Register, manage, and track earnings from your games on the PredictBNB oracle."
      >
        <div className="flex items-center gap-4">
          <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
            <DialogTrigger asChild>
              <Button className="font-mono text-xs uppercase tracking-widest">
                <Plus className="w-4 h-4 mr-2" />
                <ScrambleTextOnHover text="Register Game" duration={0.4} />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-[var(--font-bebas)] text-2xl">Register New Game</DialogTitle>
                <DialogDescription className="font-mono text-xs text-muted-foreground">
                  Stake 0.1 BNB to register your game and start earning from queries.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-2">
                    Game Name
                  </label>
                  <Input
                    placeholder="Enter game name"
                    value={newGameName}
                    onChange={(e) => setNewGameName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-2">
                    Metadata (JSON)
                  </label>
                  <Input
                    placeholder='{"genre": "FPS", "website": "..."}'
                    value={newGameMetadata}
                    onChange={(e) => setNewGameMetadata(e.target.value)}
                  />
                </div>
                <div className="p-3 border border-accent/30 bg-accent/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="w-4 h-4 text-accent" />
                    <span className="font-mono text-xs text-accent">Required Stake</span>
                  </div>
                  <div className="font-[var(--font-bebas)] text-2xl text-accent">0.1 BNB</div>
                </div>
                {!deployed.gameRegistry && (
                  <div className="p-3 border border-yellow-500/30 bg-yellow-500/5">
                    <span className="font-mono text-xs text-yellow-400">
                      Contracts not deployed - this action will fail
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setRegisterOpen(false)}
                  className="flex-1 font-mono text-xs uppercase tracking-widest"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRegisterGame}
                  disabled={!newGameName || isRegistering || isConfirming || !deployed.gameRegistry}
                  className="flex-1 font-mono text-xs uppercase tracking-widest"
                >
                  {isRegistering || isConfirming ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  {isRegistering ? "Confirming..." : isConfirming ? "Processing..." : "Register"}
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
            title="Total Games"
            value={games.length}
            icon={Gamepad2}
            variant="accent"
          />
        </ScrollRevealItem>
        <ScrollRevealItem>
          <StatCard
            title="Total Queries"
            value={totalQueries}
            change={18.5}
            changeLabel="this week"
            icon={TrendingUp}
          />
        </ScrollRevealItem>
        <ScrollRevealItem>
          <StatCard
            title="Total Revenue"
            value={totalRevenue}
            suffix=" BNB"
            change={12.3}
            changeLabel="vs last month"
            icon={Wallet}
            variant="success"
          />
        </ScrollRevealItem>
        <ScrollRevealItem>
          <StatCard
            title="Avg Reputation"
            value={avgReputation}
            suffix="/1000"
            icon={CheckCircle2}
          />
        </ScrollRevealItem>
      </ScrollRevealStagger>

      {/* Search & Filter */}
      <ScrollReveal>
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search games..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" className="font-mono text-xs uppercase tracking-widest">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button 
            variant="outline" 
            onClick={() => refetch()}
            className="font-mono text-xs uppercase tracking-widest"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </ScrollReveal>

      {/* Games List */}
      <ScrollReveal>
        <Card>
          <SectionHeader title="Your Registered Games" badge="Active" />
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="all">All Games</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
            </TabsList>
            <TabsContent value="all">
              <div className="space-y-3">
                <AnimatePresence>
                  {filteredGames.map((game, index) => (
                    <GameCard 
                      key={game.id} 
                      game={game} 
                      index={index} 
                      onWithdraw={() => withdraw(game.id)}
                      isWithdrawing={isWithdrawing}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </TabsContent>
            <TabsContent value="active">
              <div className="space-y-3">
                {filteredGames.filter(g => g.status === "active").map((game, index) => (
                  <GameCard 
                    key={game.id} 
                    game={game} 
                    index={index}
                    onWithdraw={() => withdraw(game.id)}
                    isWithdrawing={isWithdrawing}
                  />
                ))}
              </div>
            </TabsContent>
            <TabsContent value="pending">
              <EmptyState
                icon={Clock}
                title="No Pending Games"
                description="All your games are currently active."
              />
            </TabsContent>
          </Tabs>
        </Card>
      </ScrollReveal>

      {/* Bottom Drawer for Mobile Actions */}
      <div className="md:hidden fixed bottom-4 right-4">
        <Drawer>
          <DrawerTrigger asChild>
            <Button size="icon" className="w-14 h-14 rounded-full shadow-lg">
              <Plus className="w-6 h-6" />
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle className="font-[var(--font-bebas)] text-2xl">Quick Actions</DrawerTitle>
              <DrawerDescription className="font-mono text-xs">Manage your games</DrawerDescription>
            </DrawerHeader>
            <div className="p-4 space-y-3">
              <Button 
                className="w-full font-mono text-xs uppercase tracking-widest"
                onClick={() => setRegisterOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Register New Game
              </Button>
              <Button variant="outline" className="w-full font-mono text-xs uppercase tracking-widest">
                <Wallet className="w-4 h-4 mr-2" />
                Withdraw All Earnings
              </Button>
            </div>
            <DrawerFooter>
              <Button variant="ghost" className="font-mono text-xs">
                Cancel
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    </div>
  )
}

// Game Card Component
function GameCard({ 
  game, 
  index, 
  onWithdraw,
  isWithdrawing 
}: { 
  game: Game
  index: number
  onWithdraw: () => void
  isWithdrawing: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ delay: index * 0.05 }}
    >
      <Sheet>
        <SheetTrigger asChild>
          <div className="cursor-pointer">
            <motion.div
              whileHover={{ x: 4 }}
              className="p-4 border border-border/30 hover:border-accent/50 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 border border-accent/30 flex items-center justify-center">
                    <Gamepad2 className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-mono text-sm text-foreground font-medium">{game.name}</h3>
                      <Badge variant="accent">{game.status}</Badge>
                      {!game.isLive && <Badge variant="warning">Demo</Badge>}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-xs text-muted-foreground">{game.type}</span>
                      <span className="font-mono text-xs text-muted-foreground">Stake: {game.stake} BNB</span>
                      <span className="font-mono text-xs text-muted-foreground">Rep: {game.reputation}/1000</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="font-mono text-xs text-muted-foreground">Queries</div>
                    <div className="font-[var(--font-bebas)] text-xl text-foreground">{game.queries.toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs text-muted-foreground">Revenue</div>
                    <div className="font-[var(--font-bebas)] text-xl text-accent">{game.revenue} BNB</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
            </motion.div>
          </div>
        </SheetTrigger>
        <SheetContent side="right" className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle className="font-[var(--font-bebas)] text-2xl">{game.name}</SheetTitle>
            <SheetDescription className="font-mono text-xs">Game ID: {game.id.slice(0, 10)}...</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {/* Game Stats */}
            <div className="grid grid-cols-2 gap-4">
              <MiniStatCard title="Total Queries" value={game.queries.toLocaleString()} />
              <MiniStatCard title="Revenue" value={game.revenue} suffix=" BNB" />
              <MiniStatCard title="Matches" value={game.matches} />
              <MiniStatCard title="Disputes" value={game.disputes} />
            </div>

            {/* Reputation */}
            <div className="p-4 border border-border/30">
              <div className="font-mono text-xs text-muted-foreground mb-3">Reputation Score</div>
              <ProgressBar
                value={game.reputation}
                max={1000}
                showLabel
                label={`${game.reputation}/1000`}
              />
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Button 
                className="w-full font-mono text-xs uppercase tracking-widest"
                onClick={onWithdraw}
                disabled={isWithdrawing || !game.isLive}
              >
                {isWithdrawing ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Wallet className="w-4 h-4 mr-2" />
                )}
                Withdraw Earnings
              </Button>
              <Button variant="outline" className="w-full font-mono text-xs uppercase tracking-widest">
                <Plus className="w-4 h-4 mr-2" />
                Schedule Match
              </Button>
              <Button variant="outline" className="w-full font-mono text-xs uppercase tracking-widest">
                <TrendingUp className="w-4 h-4 mr-2" />
                Increase Stake
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </motion.div>
  )
}
