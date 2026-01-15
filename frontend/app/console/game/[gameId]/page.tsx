"use client"

import { useParams, useRouter } from "next/navigation"
import { useAccount, useReadContract } from "wagmi"
import { formatEther } from "viem"
import { SideNav } from "@/components/side-nav"
import { AnimatedNoise } from "@/components/animated-noise"
import { HighlightText } from "@/components/highlight-text"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrambleTextOnHover } from "@/components/scramble-text"
import { WalletWidget } from "@/components/wallet-widget"
import {
  GameRegistryContract,
  OracleCoreContract,
  type GameData,
} from "@/lib/contracts"
import { useGameStats } from "@/lib/hooks/useOracleCore"
import { useDeveloperEarnings } from "@/lib/hooks/useFeeManager"
import { ArrowLeft, Activity, TrendingUp, Shield, Calendar, Zap } from "lucide-react"

export default function GameDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const gameId = params.gameId as `0x${string}`

  // Fetch game data
  const { data: gameData, isLoading: isLoadingGame } = useReadContract({
    ...GameRegistryContract,
    functionName: "getGame",
    args: [gameId],
  })

  // Fetch matches for this game
  const { data: matches, isLoading: isLoadingMatches } = useReadContract({
    ...GameRegistryContract,
    functionName: "getGameMatches",
    args: [gameId],
  })

  // Fetch oracle stats
  const { data: oracleStats } = useGameStats(gameId)

  // Fetch earnings
  const { data: earningsData } = useDeveloperEarnings(gameId)

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
              Game Details
            </HighlightText>
            <h1 className="font-[var(--font-bebas)] text-[clamp(2rem,5vw,4rem)] text-foreground mt-4 leading-none">
              Connect Your Wallet
            </h1>
            <p className="font-mono text-sm text-muted-foreground mt-4">
              Please connect your wallet to view game details
            </p>
          </div>
        </div>
      </main>
    )
  }

  if (isLoadingGame) {
    return (
      <main className="relative min-h-screen pl-6 md:pl-28 pr-6 md:pr-12 py-12">
        <SideNav />
        <WalletWidget />
        <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />
        <AnimatedNoise opacity={0.02} />

        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="font-mono text-sm text-muted-foreground">Loading game details...</div>
        </div>
      </main>
    )
  }

  const game = gameData as unknown as GameData
  const matchList = (matches as `0x${string}`[]) || []
  const earnings = earningsData || [0n, 0n, 0n, 0n]

  const totalResults = oracleStats ? Number(oracleStats[0]) : 0
  const finalizedResults = oracleStats ? Number(oracleStats[1]) : 0
  const disputedResults = oracleStats ? Number(oracleStats[2]) : 0
  const finalizationRate = totalResults > 0 ? ((finalizedResults / totalResults) * 100).toFixed(1) : "0"
  const disputeRate = totalResults > 0 ? ((disputedResults / totalResults) * 100).toFixed(1) : "0"

  return (
    <main className="relative min-h-screen pl-6 md:pl-28 pr-6 md:pr-12 py-12">
      <SideNav />
      <WalletWidget />
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />
      <AnimatedNoise opacity={0.02} />

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Back Button */}
        <Button
          onClick={() => router.back()}
          variant="ghost"
          className="mb-6 font-mono text-xs uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          <ScrambleTextOnHover text="Back to Dashboard" duration={0.3} />
        </Button>

        {/* Header */}
        <div className="mb-12">
          <HighlightText className="font-mono text-xs uppercase tracking-widest text-accent">
            Game Details
          </HighlightText>
          <h1 className="font-[var(--font-bebas)] text-[clamp(2rem,5vw,4rem)] text-foreground mt-4 leading-none">
            {game.name || "Unnamed Game"}
          </h1>
          <div className="flex items-center gap-4 mt-4">
            <div className="font-mono text-sm text-muted-foreground">
              Game ID: {gameId.substring(0, 10)}...{gameId.substring(gameId.length - 8)}
            </div>
            <div className={`font-mono text-xs uppercase tracking-widest px-3 py-1 rounded ${game.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {game.isActive ? "Active" : "Inactive"}
            </div>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-3">
              <Activity className="w-5 h-5 text-accent" />
              <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Total Matches
              </div>
            </div>
            <div className="font-[var(--font-bebas)] text-4xl text-accent">
              {game.totalMatches}
            </div>
            <div className="font-mono text-xs text-muted-foreground mt-2">
              {matchList.length} tracked on-chain
            </div>
          </Card>

          <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-3">
              <TrendingUp className="w-5 h-5 text-accent" />
              <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Total Earned
              </div>
            </div>
            <div className="font-[var(--font-bebas)] text-4xl text-accent">
              {parseFloat(formatEther(earnings[0])).toFixed(4)}
            </div>
            <div className="font-mono text-xs text-muted-foreground mt-2">
              BNB (80% share)
            </div>
          </Card>

          <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-3">
              <Shield className="w-5 h-5 text-accent" />
              <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Reputation
              </div>
            </div>
            <div className="font-[var(--font-bebas)] text-4xl text-accent">
              {game.reputation}
            </div>
            <div className="font-mono text-xs text-muted-foreground mt-2">
              out of 1000
            </div>
          </Card>

          <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-3">
              <Calendar className="w-5 h-5 text-accent" />
              <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Registered
              </div>
            </div>
            <div className="font-[var(--font-bebas)] text-2xl text-accent">
              {new Date(Number(game.registeredAt) * 1000).toLocaleDateString()}
            </div>
            <div className="font-mono text-xs text-muted-foreground mt-2">
              {new Date(Number(game.registeredAt) * 1000).toLocaleTimeString()}
            </div>
          </Card>
        </div>

        {/* Developer & Contract Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
            <h3 className="font-mono text-sm font-medium text-foreground mb-4">Developer Information</h3>
            <div className="space-y-3">
              <div>
                <div className="font-mono text-xs text-muted-foreground mb-1">Developer Address</div>
                <div className="font-mono text-sm text-foreground break-all">{game.developer}</div>
              </div>
              {game.gameContract && game.gameContract !== "0x0000000000000000000000000000000000000000" && (
                <div>
                  <div className="font-mono text-xs text-muted-foreground mb-1">Game Contract</div>
                  <div className="font-mono text-sm text-foreground break-all">{game.gameContract}</div>
                </div>
              )}
              <div>
                <div className="font-mono text-xs text-muted-foreground mb-1">Staked Amount</div>
                <div className="font-mono text-sm text-accent">{formatEther(game.stakedAmount)} BNB</div>
              </div>
            </div>
          </Card>

          <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
            <h3 className="font-mono text-sm font-medium text-foreground mb-4">Oracle Statistics</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="font-mono text-xs text-muted-foreground">Total Results</div>
                <div className="font-mono text-sm text-foreground">{totalResults}</div>
              </div>
              <div className="flex justify-between items-center">
                <div className="font-mono text-xs text-muted-foreground">Finalized</div>
                <div className="font-mono text-sm text-accent">
                  {finalizedResults} ({finalizationRate}%)
                </div>
              </div>
              <div className="flex justify-between items-center">
                <div className="font-mono text-xs text-muted-foreground">Disputed</div>
                <div className="font-mono text-sm text-red-400">
                  {disputedResults} ({disputeRate}%)
                </div>
              </div>
              <div className="flex justify-between items-center">
                <div className="font-mono text-xs text-muted-foreground">Total Queries</div>
                <div className="font-mono text-sm text-foreground">{Number(earnings[3])}</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Revenue Details */}
        <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm mb-12">
          <h3 className="font-mono text-sm font-medium text-foreground mb-6">Revenue Breakdown</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                Total Earned
              </div>
              <div className="font-[var(--font-bebas)] text-3xl text-accent">
                {parseFloat(formatEther(earnings[0])).toFixed(6)} BNB
              </div>
              <div className="font-mono text-xs text-muted-foreground mt-1">
                Cumulative earnings
              </div>
            </div>
            <div>
              <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                Pending
              </div>
              <div className="font-[var(--font-bebas)] text-3xl text-green-400">
                {parseFloat(formatEther(earnings[1])).toFixed(6)} BNB
              </div>
              <div className="font-mono text-xs text-muted-foreground mt-1">
                Available to withdraw
              </div>
            </div>
            <div>
              <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                Avg per Query
              </div>
              <div className="font-[var(--font-bebas)] text-3xl text-foreground">
                {Number(earnings[3]) > 0
                  ? (parseFloat(formatEther(earnings[0])) / Number(earnings[3])).toFixed(8)
                  : "0.00000000"} BNB
              </div>
              <div className="font-mono text-xs text-muted-foreground mt-1">
                Per successful query
              </div>
            </div>
          </div>
        </Card>

        {/* Match History */}
        <div className="mb-12">
          <h2 className="font-mono text-lg font-medium text-foreground mb-6 flex items-center gap-2">
            <Zap className="w-5 h-5 text-accent" />
            Recent Matches
          </h2>

          {isLoadingMatches ? (
            <div className="font-mono text-sm text-muted-foreground">Loading matches...</div>
          ) : matchList.length > 0 ? (
            <div className="border border-border/30 overflow-hidden">
              <div className="grid grid-cols-3 gap-px bg-border/30">
                <div className="bg-background p-4">
                  <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    Match ID
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

              {matchList.slice(0, 10).map((matchId) => (
                <MatchRow key={matchId} matchId={matchId} gameId={gameId} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 border border-border/30">
              <div className="font-mono text-sm text-muted-foreground">No matches found for this game</div>
            </div>
          )}
        </div>

        {/* Metadata */}
        {game.metadata && (
          <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
            <h3 className="font-mono text-sm font-medium text-foreground mb-4">Game Metadata</h3>
            <pre className="font-mono text-xs text-muted-foreground overflow-x-auto">
              {game.metadata}
            </pre>
          </Card>
        )}
      </div>
    </main>
  )
}

// Component to render individual match rows
function MatchRow({ matchId, gameId }: { matchId: `0x${string}`; gameId: `0x${string}` }) {
  const { data: matchData } = useReadContract({
    ...GameRegistryContract,
    functionName: "getMatch",
    args: [matchId],
  })

  // Convert matchId for oracle query
  const oracleMatchId = matchId // In production, you'd convert this properly

  const { data: resultData } = useReadContract({
    ...OracleCoreContract,
    functionName: "getResult",
    args: [oracleMatchId],
  })

  if (!matchData) {
    return (
      <div className="grid grid-cols-3 gap-px bg-border/30">
        <div className="bg-background p-4 col-span-3">
          <div className="font-mono text-xs text-muted-foreground">Loading...</div>
        </div>
      </div>
    )
  }

  const match = matchData as any
  const hasResult = match.hasResult || false

  return (
    <div className="grid grid-cols-3 gap-px bg-border/30 hover:bg-accent/10 transition-colors duration-200">
      <div className="bg-background p-4">
        <div className="font-mono text-sm text-foreground">
          {matchId.substring(0, 8)}...{matchId.substring(matchId.length - 6)}
        </div>
      </div>
      <div className="bg-background p-4">
        <div className={`font-mono text-xs uppercase tracking-widest ${hasResult ? 'text-green-400' : 'text-yellow-400'}`}>
          {hasResult ? "Completed" : "Pending"}
        </div>
      </div>
      <div className="bg-background p-4">
        <button className="font-mono text-xs uppercase tracking-widest text-foreground hover:text-accent transition-colors duration-200">
          View Details
        </button>
      </div>
    </div>
  )
}
