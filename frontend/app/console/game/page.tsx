"use client"

import { useEffect, useState } from "react"
import { useAccount, useReadContract, useReadContracts } from "wagmi"
import { formatEther, type Address } from "viem"
import { useRouter } from "next/navigation"
import { SideNav } from "@/components/side-nav"
import { AnimatedNoise } from "@/components/animated-noise"
import { HighlightText } from "@/components/highlight-text"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrambleTextOnHover } from "@/components/scramble-text"
import { WalletWidget } from "@/components/wallet-widget"
import {
  GameRegistryContract,
  FeeManagerV2Contract,
  OracleCoreContract,
  type GameData,
  type DeveloperEarnings,
} from "@/lib/contracts"
import { useDeveloperStats, useDeveloperGames } from "@/lib/hooks/useGameRegistry"
import { useGlobalStats, useGameStats } from "@/lib/hooks/useOracleCore"
import { useDeveloperEarnings } from "@/lib/hooks/useFeeManager"

export default function GameProviderDashboard() {
  const { address, isConnected } = useAccount()
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d" | "all">("30d")

  // Use new hooks for better data fetching
  const { data: gameIds } = useDeveloperGames(address)
  const { data: devStats } = useDeveloperStats(address)
  const { data: globalOracleStats } = useGlobalStats()

  if (!isConnected) {
    return (
      <main className="relative min-h-screen pl-6 md:pl-28 pr-6 md:pr-12 py-12">
        <SideNav />
        <WalletWidget />
        <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />
        <AnimatedNoise opacity={0.02} />

        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="mb-12 text-center">
            <HighlightText className="font-mono text-xs uppercase tracking-widest text-accent">
              Game Provider Dashboard
            </HighlightText>
            <h1 className="font-[var(--font-bebas)] text-[clamp(2rem,5vw,4rem)] text-foreground mt-4 leading-none">
              Connect Your Wallet
            </h1>
            <p className="font-mono text-sm text-muted-foreground mt-4">
              Please connect your wallet to view your game provider dashboard
            </p>
          </div>
        </div>
      </main>
    )
  }
  // Extract stats from hooks
  console.log(gameIds)
  const gameCount = (gameIds as any)?.length || 0
  const totalGames = devStats ? Number(devStats[0]) : 0
  const totalMatches = devStats ? Number(devStats[1]) : 0
  const totalDisputes = devStats ? Number(devStats[2]) : 0
  const avgReputation = devStats ? Number(devStats[3]) : 0

  const totalResultsCount = globalOracleStats ? Number(globalOracleStats[0]) : 0
  const totalFinalizedCount = globalOracleStats ? Number(globalOracleStats[1]) : 0
  const totalDisputedCount = globalOracleStats ? Number(globalOracleStats[2]) : 0

  return (
    <main className="relative min-h-screen pl-6 md:pl-28 pr-6 md:pr-12 py-12">
      <SideNav />
      <WalletWidget />
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />
      <AnimatedNoise opacity={0.02} />

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <HighlightText className="font-mono text-xs uppercase tracking-widest text-accent">
            Game Provider Dashboard
          </HighlightText>
          <h1 className="font-[var(--font-bebas)] text-[clamp(2rem,5vw,4rem)] text-foreground mt-4 leading-none">
            Your Games & Revenue
          </h1>
          <p className="font-mono text-sm text-muted-foreground mt-4">
            Track your registered games, query volume, and earnings from the PredictBNB oracle
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
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
              My Games
            </div>
            <div className="font-[var(--font-bebas)] text-4xl text-accent">{gameCount}</div>
            <div className="font-mono text-xs text-muted-foreground mt-2">Registered</div>
          </Card>

          <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
              Total Matches
            </div>
            <div className="font-[var(--font-bebas)] text-4xl text-accent">
              {totalMatches.toLocaleString()}
            </div>
            <div className="font-mono text-xs text-muted-foreground mt-2">Across all games</div>
          </Card>

          <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
              Total Disputes
            </div>
            <div className="font-[var(--font-bebas)] text-4xl text-accent">
              {totalDisputes.toLocaleString()}
            </div>
            <div className="font-mono text-xs text-muted-foreground mt-2">
              {totalMatches > 0 ? `${((totalDisputes / totalMatches) * 100).toFixed(1)}%` : "0%"} dispute rate
            </div>
          </Card>

          <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
              Reputation
            </div>
            <div className="font-[var(--font-bebas)] text-4xl text-accent">
              {avgReputation.toFixed(1)}%
            </div>
            <div className="font-mono text-xs text-muted-foreground mt-2">Average across games</div>
          </Card>
        </div>

        {/* My Games Table */}
        {gameCount > 0 ? (
          <div className="mb-12">
            <h2 className="font-mono text-lg font-medium text-foreground mb-6">My Registered Games</h2>
            <div className="border border-border/30 overflow-hidden">
              <div className="grid grid-cols-8 gap-px bg-border/30">
                <div className="bg-background p-4">
                  <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    Game Name
                  </div>
                </div>
                <div className="bg-background p-4">
                  <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Type</div>
                </div>
                <div className="bg-background p-4">
                  <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground"> TStake</div>
                </div>
                <div className="bg-background p-4">
                  <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    Matches
                  </div>
                </div>
                <div className="bg-background p-4">
                  <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    Results
                  </div>
                </div>
                <div className="bg-background p-4">
                  <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    Revenue
                  </div>
                </div>
                <div className="bg-background p-4">
                  <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    Status
                  </div>
                </div>
                <div className="bg-background p-4">
                  <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    Action
                  </div>
                </div>
              </div>

                {(gameIds as Address[])?.map((gameId) => (
                <GameRow key={gameId} gameId={gameId} />
                ))}
            </div>
          </div>
        ) : (
          <div className="mb-12 text-center py-16 border border-border/30">
            <div className="font-mono text-sm text-muted-foreground mb-4">No games registered yet</div>
            <Button variant="outline" className="font-mono text-xs uppercase tracking-widest">
              <ScrambleTextOnHover text="Register Your First Game" duration={0.4} />
            </Button>
          </div>
        )}

        {/* Oracle Network Stats */}
        <div className="mb-12">
          <h2 className="font-mono text-lg font-medium text-foreground mb-6">Oracle Network Stats</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
              <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                Total Results
              </div>
              <div className="font-[var(--font-bebas)] text-3xl text-foreground">
                {totalResultsCount.toLocaleString()}
              </div>
              <div className="font-mono text-xs text-muted-foreground mt-2">Submitted to oracle</div>
            </Card>

            <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
              <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                Finalized
              </div>
              <div className="font-[var(--font-bebas)] text-3xl text-foreground">
                {totalFinalizedCount.toLocaleString()}
              </div>
              <div className="font-mono text-xs text-muted-foreground mt-2">
                {totalResultsCount > 0
                  ? `${((totalFinalizedCount / totalResultsCount) * 100).toFixed(1)}%`
                  : "0%"}{" "}
                finalization rate
              </div>
            </Card>

            <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
              <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                Disputed
              </div>
              <div className="font-[var(--font-bebas)] text-3xl text-foreground">
                {totalDisputedCount.toLocaleString()}
              </div>
              <div className="font-mono text-xs text-muted-foreground mt-2">
                {totalResultsCount > 0
                  ? `${((totalDisputedCount / totalResultsCount) * 100).toFixed(1)}%`
                  : "0%"}{" "}
                dispute rate
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}

// Component to render individual game rows
function GameRow({ gameId }: { gameId: `0x${string}` }) {
  const router = useRouter()
  console.log("Rendering GameRow for:", gameId)
  // Fetch game data
  const { data: gameData } = useReadContract({
    ...GameRegistryContract,
    functionName: "getGame",
    args: [gameId],
  })

  // Fetch matches count
  const { data: matches } = useReadContract({
    ...GameRegistryContract,
    functionName: "getGameMatches",
    args: [gameId],
  })

  // Fetch game stats from OracleCore
  const { data: oracleStats } = useGameStats(gameId)

  // Fetch earnings data
  const { data: earningsData } = useDeveloperEarnings(gameId)

  if (!gameData || !earningsData) {
    console.log("Loading...", gameData, earningsData)
    return (
      <div className="grid grid-cols-8 gap-px bg-border/30">
        <div className="bg-background p-4 col-span-8">
          <div className="font-mono text-sm text-muted-foreground">Loading...</div>
        </div>
      </div>
    )
    
  }

  console.log(gameData)

  const game = gameData as unknown as GameData
  const earnings = earningsData as unknown as DeveloperEarnings
  const matchCount = (matches as any)?.length || 0

  const totalResults = oracleStats ? Number(oracleStats[0]) : 0
  const finalizedResults = oracleStats ? Number(oracleStats[1]) : 0
  const disputedResults = oracleStats ? Number(oracleStats[2]) : 0
  const finalizationRate = totalResults > 0 ? ((finalizedResults / totalResults) * 100).toFixed(0) : "0"

  return (
    <div className="grid grid-cols-8 gap-px bg-border/30 hover:bg-accent/10 transition-colors duration-200">
      <div className="bg-background p-4">
        <div className="font-mono text-sm text-foreground">{game.name || "Unnamed Game"}</div>
      </div>
      <div className="bg-background p-4">
        <div className="font-mono text-sm text-muted-foreground">
          {game.gameType === 0 ? "Onchain" : "Traditional"}
        </div>
      </div>
      <div className="bg-background p-4">
        <div className="font-mono text-sm text-muted-foreground">
          {parseFloat(formatEther(game.stakedAmount || BigInt(0))).toFixed(2)} BNB
        </div>
      </div>
      <div className="bg-background p-4">
        <div className="font-mono text-sm text-muted-foreground">{matchCount.toLocaleString()}</div>
      </div>
      <div className="bg-background p-4">
        <div className="font-mono text-sm text-muted-foreground">
          {totalResults.toLocaleString()}
          <span className="text-xs ml-1 text-accent">({finalizationRate}%)</span>
        </div>
      </div>
      <div className="bg-background p-4">
        <div className="font-mono text-sm text-accent font-medium">
          {parseFloat(formatEther(earnings[0])).toFixed(4)} BNB
        </div>
      </div>
      <div className="bg-background p-4">
        <div className="font-mono text-xs uppercase tracking-widest text-accent">
          {game.isActive ? "Active" : "Inactive"}
        </div>
      </div>
      <div className="bg-background p-4">
        <button
          onClick={() => router.push(`/console/game/${gameId}`)}
          className="font-mono text-xs uppercase tracking-widest text-foreground hover:text-accent transition-colors duration-200"
        >
          View
        </button>
      </div>
    </div>
  )
}
