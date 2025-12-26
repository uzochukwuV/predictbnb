"use client"

import { useState, useEffect } from "react"
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { formatEther, type Address } from "viem"
import { ScrambleTextOnHover } from "@/components/scramble-text"
import { AnimatedNoise } from "@/components/animated-noise"
import { BitmapChevron } from "@/components/bitmap-chevron"
import { SideNav } from "@/components/side-nav"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { VirtualFootballGameContract } from "@/lib/contracts"

// Enums matching the contract
enum SeasonStatus {
  UPCOMING = 0,
  ACTIVE = 1,
  COMPLETED = 2,
}

type Season = {
  seasonId: number
  startTime: bigint
  endTime: bigint
  status: SeasonStatus
  totalMatches: number
}

type Match = {
  matchId: bigint
  seasonId: number
  homeTeam: number
  awayTeam: number
  homeScore: number
  awayScore: number
  kickoffTime: bigint
  isFinalized: boolean
  oracleMatchId: string
}

type TeamStats = {
  matchesPlayed: number
  wins: number
  draws: number
  losses: number
  goalsScored: number
  goalsConceded: number
  points: number
}

export default function VirtualFootballGamePage() {
  const [activeTab, setActiveTab] = useState<"season" | "matches" | "table">("season")
  const [createSeasonTime, setCreateSeasonTime] = useState("")
  const { address, isConnected } = useAccount()

  // Fetch current season ID
  const { data: currentSeasonId, refetch: refetchSeasonId } = useReadContract({
    ...VirtualFootballGameContract,
    functionName: "currentSeasonId",
  })

  // Fetch season data
  const { data: seasonData, refetch: refetchSeason } = useReadContract({
    ...VirtualFootballGameContract,
    functionName: "getSeason",
    args: currentSeasonId ? [Number(currentSeasonId)] : undefined,
    query: {
      enabled: !!currentSeasonId && (currentSeasonId as any) > 0,
    },
  })

  // Fetch season matches
  const { data: seasonMatchIds, refetch: refetchMatches } = useReadContract({
    ...VirtualFootballGameContract,
    functionName: "getSeasonMatches",
    args: currentSeasonId ? [Number(currentSeasonId)] : undefined,
    query: {
      enabled: !!currentSeasonId && (currentSeasonId as any) > 0,
    },
  })

  // Fetch game owner
  const { data: gameOwner } = useReadContract({
    ...VirtualFootballGameContract,
    functionName: "owner",
  })

  // Write contract hooks
  const { data: createSeasonHash, writeContract: createSeason, isPending: isCreatingSeason } = useWriteContract()
  const { data: startSeasonHash, writeContract: startSeason, isPending: isStartingSeason } = useWriteContract()
  const { data: simulateMatchHash, writeContract: simulateMatch, isPending: isSimulatingMatch } = useWriteContract()
  const { data: endSeasonHash, writeContract: endSeason, isPending: isEndingSeason } = useWriteContract()

  // Wait for transaction confirmations
  const { isLoading: isConfirmingCreate, isSuccess: isCreateConfirmed } = useWaitForTransactionReceipt({
    hash: createSeasonHash,
  })
  const { isLoading: isConfirmingStart, isSuccess: isStartConfirmed } = useWaitForTransactionReceipt({
    hash: startSeasonHash,
  })
  const { isLoading: isConfirmingSimulate, isSuccess: isSimulateConfirmed } = useWaitForTransactionReceipt({
    hash: simulateMatchHash,
  })
  const { isLoading: isConfirmingEnd, isSuccess: isEndConfirmed } = useWaitForTransactionReceipt({
    hash: endSeasonHash,
  })

  // Refetch data when transactions are confirmed
  useEffect(() => {
    if (isCreateConfirmed || isStartConfirmed || isSimulateConfirmed || isEndConfirmed) {
      refetchSeasonId()
      refetchSeason()
      refetchMatches()
    }
  }, [isCreateConfirmed, isStartConfirmed, isSimulateConfirmed, isEndConfirmed, refetchSeasonId, refetchSeason, refetchMatches])

  const season = seasonData as unknown as Season | undefined
  const matchIds = (seasonMatchIds as bigint[]) || []
  const isOwner = address && gameOwner && address.toLowerCase() === (gameOwner as string).toLowerCase()

  const handleCreateSeason = () => {
    const timestamp = createSeasonTime ? new Date(createSeasonTime).getTime() / 1000 : Math.floor(Date.now() / 1000) + 3600
    createSeason({
      ...VirtualFootballGameContract,
      functionName: "createSeason",
      args: [BigInt(Math.floor(timestamp))],
    })
    setCreateSeasonTime("")
  }

  const handleStartSeason = () => {
    if (currentSeasonId) {
      startSeason({
        ...VirtualFootballGameContract,
        functionName: "startSeason",
        args: [Number(currentSeasonId)],
      })
    }
  }

  const handleEndSeason = () => {
    if (currentSeasonId) {
      endSeason({
        ...VirtualFootballGameContract,
        functionName: "endSeason",
        args: [Number(currentSeasonId)],
      })
    }
  }

  const getSeasonStatusName = (status: SeasonStatus): string => {
    switch (status) {
      case SeasonStatus.UPCOMING:
        return "UPCOMING"
      case SeasonStatus.ACTIVE:
        return "ACTIVE"
      case SeasonStatus.COMPLETED:
        return "COMPLETED"
      default:
        return "UNKNOWN"
    }
  }

  const getTimeDisplay = (timestamp: bigint): string => {
    const date = new Date(Number(timestamp) * 1000)
    return date.toLocaleString()
  }

  const getTimeRemaining = (timestamp: bigint): string => {
    const now = Math.floor(Date.now() / 1000)
    const diff = Number(timestamp) - now

    if (diff <= 0) return "Started"

    const hours = Math.floor(diff / 3600)
    const minutes = Math.floor((diff % 3600) / 60)

    if (hours > 24) {
      const days = Math.floor(hours / 24)
      return `${days}d ${hours % 24}h`
    }
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  return (
    <main className="relative min-h-screen pl-6 md:pl-28 pr-6 md:pr-12 py-12">
      <SideNav />
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />
      <AnimatedNoise opacity={0.02} />

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <BitmapChevron className="w-3 h-3 rotate-180" />
            Back
          </Link>
          <h1 className="font-[var(--font-bebas)] text-[clamp(2rem,6vw,4rem)] text-accent tracking-wide">
            Virtual Football
          </h1>
          <p className="font-mono text-sm text-muted-foreground mt-2">
            Automated virtual football league with 10 Premier League teams
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-8 flex gap-4 border-b border-border">
          <button
            onClick={() => setActiveTab("season")}
            className={`pb-4 px-4 font-mono text-xs uppercase tracking-widest transition-colors ${
              activeTab === "season"
                ? "text-accent border-b-2 border-accent"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Season Info
          </button>
          <button
            onClick={() => setActiveTab("matches")}
            className={`pb-4 px-4 font-mono text-xs uppercase tracking-widest transition-colors ${
              activeTab === "matches"
                ? "text-accent border-b-2 border-accent"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Matches
          </button>
          <button
            onClick={() => setActiveTab("table")}
            className={`pb-4 px-4 font-mono text-xs uppercase tracking-widest transition-colors ${
              activeTab === "table"
                ? "text-accent border-b-2 border-accent"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            League Table
          </button>
        </div>

        {/* Season Info Tab */}
        {activeTab === "season" && (
          <div className="space-y-8">
            {/* Current Season Info */}
            {season && currentSeasonId && Number(currentSeasonId) > 0 ? (
              <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
                <h2 className="font-mono text-lg font-medium text-foreground mb-6">
                  Season #{currentSeasonId.toString()}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                      Status
                    </div>
                    <div
                      className={`font-mono text-sm uppercase px-3 py-1 border inline-block ${
                        season.status === SeasonStatus.UPCOMING
                          ? "border-yellow-500 text-yellow-500 bg-yellow-500/10"
                          : season.status === SeasonStatus.ACTIVE
                            ? "border-accent text-accent bg-accent/10"
                            : "border-muted-foreground text-muted-foreground bg-background"
                      }`}
                    >
                      {getSeasonStatusName(season.status)}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                      Start Time
                    </div>
                    <div className="font-mono text-sm text-foreground">
                      {getTimeDisplay(season.startTime)}
                    </div>
                    {season.status === SeasonStatus.UPCOMING && (
                      <div className="font-mono text-xs text-accent mt-1">
                        Starts in {getTimeRemaining(season.startTime)}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                      End Time
                    </div>
                    <div className="font-mono text-sm text-foreground">
                      {getTimeDisplay(season.endTime)}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                      Total Matches
                    </div>
                    <div className="font-[var(--font-bebas)] text-3xl text-accent">
                      {season.totalMatches}
                    </div>
                  </div>
                </div>

                
                {(isOwner as any) && (
                  <div className="mt-6 pt-6 border-t border-border/30">
                    <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
                      Admin Actions
                    </div>
                    <div className="flex gap-4">
                      {season.status === SeasonStatus.UPCOMING && (
                        <Button
                          onClick={handleStartSeason}
                          disabled={isStartingSeason || isConfirmingStart}
                          className="font-mono text-xs uppercase tracking-widest"
                        >
                          <ScrambleTextOnHover
                            text={isStartingSeason || isConfirmingStart ? "Starting..." : "Start Season"}
                            duration={0.3}
                          />
                        </Button>
                      )}
                      {season.status === SeasonStatus.ACTIVE && (
                        <Button
                          onClick={handleEndSeason}
                          disabled={isEndingSeason || isConfirmingEnd}
                          variant="outline"
                          className="font-mono text-xs uppercase tracking-widest"
                        >
                          <ScrambleTextOnHover
                            text={isEndingSeason || isConfirmingEnd ? "Ending..." : "End Season"}
                            duration={0.3}
                          />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            ) : (
              <Card className="p-8 border-border/30 bg-card/50 backdrop-blur-sm text-center">
                <div className="font-mono text-sm text-muted-foreground mb-6">
                  No active season. {isOwner ? "Create a new season to get started." : "Wait for admin to create a season."}
                </div>
                {(isOwner as any) && (
                  <div className="max-w-md mx-auto space-y-4">
                    <div>
                      <label className="font-mono text-xs text-muted-foreground mb-2 block">
                        Season Start Time (optional)
                      </label>
                      <input
                        type="datetime-local"
                        value={createSeasonTime}
                        onChange={(e) => setCreateSeasonTime(e.target.value)}
                        className="w-full bg-background border border-border px-4 py-3 font-mono text-sm text-foreground focus:outline-none focus:border-accent"
                      />
                      <div className="font-mono text-xs text-muted-foreground mt-2">
                        Leave empty to start 1 hour from now
                      </div>
                    </div>
                    <Button
                      onClick={handleCreateSeason}
                      disabled={isCreatingSeason || isConfirmingCreate}
                      className="font-mono text-xs uppercase tracking-widest"
                    >
                      <ScrambleTextOnHover
                        text={isCreatingSeason || isConfirmingCreate ? "Creating..." : "Create Season"}
                        duration={0.3}
                      />
                    </Button>
                  </div>
                )}
              </Card>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  Season Duration
                </div>
                <div className="font-[var(--font-bebas)] text-3xl text-accent">1 Day</div>
                <div className="font-mono text-xs text-muted-foreground mt-2">24 hours</div>
              </Card>
              <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  Match Interval
                </div>
                <div className="font-[var(--font-bebas)] text-3xl text-accent">10 Min</div>
                <div className="font-mono text-xs text-muted-foreground mt-2">Between matches</div>
              </Card>
              <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  Teams
                </div>
                <div className="font-[var(--font-bebas)] text-3xl text-accent">10</div>
                <div className="font-mono text-xs text-muted-foreground mt-2">Premier League teams</div>
              </Card>
            </div>
          </div>
        )}

        {/* Matches Tab */}
        {activeTab === "matches" && (
          <div className="space-y-6">
            {matchIds.length > 0 ? (
              matchIds.map((matchId) => (
                <MatchCard key={matchId.toString()} matchId={matchId} isOwner={!!isOwner} />
              ))
            ) : (
              <Card className="p-8 border-border/30 bg-card/50 backdrop-blur-sm text-center">
                <div className="font-mono text-sm text-muted-foreground">
                  No matches available. Start the season to generate matches.
                </div>
              </Card>
            )}
          </div>
        )}

        {/* League Table Tab */}
        {activeTab === "table" && (
          <div>
            {currentSeasonId && Number(currentSeasonId) > 0 ? (
              <LeagueTable seasonId={Number(currentSeasonId)} />
            ) : (
              <Card className="p-8 border-border/30 bg-card/50 backdrop-blur-sm text-center">
                <div className="font-mono text-sm text-muted-foreground">
                  No active season. League table will appear once a season starts.
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

// Match Card Component
function MatchCard({ matchId, isOwner }: { matchId: bigint; isOwner: boolean }) {
  const { data: matchData } = useReadContract({
    ...VirtualFootballGameContract,
    functionName: "getMatch",
    args: [matchId],
  })

  const { data: homeTeamName } = useReadContract({
    ...VirtualFootballGameContract,
    functionName: "getTeamName",
    args: matchData ? [(matchData as any)[2]] : undefined,
    query: {
      enabled: !!matchData,
    },
  })

  const { data: awayTeamName } = useReadContract({
    ...VirtualFootballGameContract,
    functionName: "getTeamName",
    args: matchData ? [(matchData as any)[3]] : undefined,
    query: {
      enabled: !!matchData,
    },
  })

  const { writeContract: simulateMatch, isPending: isSimulating } = useWriteContract()

  const match = matchData as unknown as Match | undefined
  const now = Math.floor(Date.now() / 1000)
  const canSimulate = match && !match.isFinalized && Number(match.kickoffTime) <= now

  const handleSimulate = () => {
    simulateMatch({
      ...VirtualFootballGameContract,
      functionName: "simulateMatch",
      args: [matchId],
    })
  }

  const getTimeRemaining = (kickoff: bigint): string => {
    const diff = Number(kickoff) - now

    if (diff <= 0) return "Live"

    const hours = Math.floor(diff / 3600)
    const minutes = Math.floor((diff % 3600) / 60)

    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  if (!match) {
    return (
      <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm animate-pulse">
        <div className="h-4 bg-border rounded mb-4 w-1/4"></div>
        <div className="h-8 bg-border rounded"></div>
      </Card>
    )
  }

  return (
    <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm hover:border-accent/50 transition-colors duration-200">
      <div className="flex items-center justify-between mb-4">
        <div className="font-mono text-xs text-muted-foreground">Match #{matchId.toString()}</div>
        <div
          className={`font-mono text-xs uppercase px-3 py-1 border ${
            match.isFinalized
              ? "border-muted-foreground text-muted-foreground bg-background"
              : canSimulate
                ? "border-accent text-accent bg-accent/10 animate-pulse"
                : "border-yellow-500 text-yellow-500 bg-yellow-500/10"
          }`}
        >
          {match.isFinalized ? "FINISHED" : canSimulate ? "READY" : getTimeRemaining(match.kickoffTime)}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center mb-4">
        <div className="text-right">
          <div className="font-mono text-lg text-foreground">{homeTeamName as string}</div>
        </div>
        <div className="text-center">
          {match.isFinalized ? (
            <div className="font-[var(--font-bebas)] text-4xl text-accent">
              {match.homeScore} - {match.awayScore}
            </div>
          ) : (
            <div className="font-mono text-2xl text-muted-foreground">VS</div>
          )}
        </div>
        <div className="text-left">
          <div className="font-mono text-lg text-foreground">{awayTeamName as string}</div>
        </div>
      </div>

      <div className="font-mono text-xs text-muted-foreground text-center mb-4">
        Kickoff: {new Date(Number(match.kickoffTime) * 1000).toLocaleString()}
      </div>

      {canSimulate && isOwner && (
        <Button
          onClick={handleSimulate}
          disabled={isSimulating}
          className="w-full font-mono text-xs uppercase tracking-widest"
        >
          <ScrambleTextOnHover text={isSimulating ? "Simulating..." : "Simulate Match"} duration={0.3} />
        </Button>
      )}
    </Card>
  )
}

// League Table Component
function LeagueTable({ seasonId }: { seasonId: number }) {
  const teamIds = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

  return (
    <div className="border border-border/30 overflow-hidden">
      <div className="grid grid-cols-9 gap-px bg-border/30">
        <div className="bg-background p-4 col-span-2">
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Team</div>
        </div>
        <div className="bg-background p-4">
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground text-center">P</div>
        </div>
        <div className="bg-background p-4">
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground text-center">W</div>
        </div>
        <div className="bg-background p-4">
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground text-center">D</div>
        </div>
        <div className="bg-background p-4">
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground text-center">L</div>
        </div>
        <div className="bg-background p-4">
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground text-center">GD</div>
        </div>
        <div className="bg-background p-4">
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground text-center">
            Pts
          </div>
        </div>
      </div>

      {teamIds.map((teamId, index) => (
        <TeamRow key={teamId} seasonId={seasonId} teamId={teamId} position={index + 1} />
      ))}
    </div>
  )
}

// Team Row Component
function TeamRow({ seasonId, teamId, position }: { seasonId: number; teamId: number; position: number }) {
  const { data: teamName } = useReadContract({
    ...VirtualFootballGameContract,
    functionName: "getTeamName",
    args: [teamId],
  })

  const { data: teamStatsData } = useReadContract({
    ...VirtualFootballGameContract,
    functionName: "getTeamStats",
    args: [seasonId, teamId],
  })

  const stats = teamStatsData as unknown as TeamStats | undefined

  const goalDifference = stats ? stats.goalsScored - stats.goalsConceded : 0

  return (
    <div
      className={`grid grid-cols-9 gap-px bg-border/30 hover:bg-accent/10 transition-colors duration-200 ${
        position <= 3 ? "border-l-2 border-l-accent" : ""
      }`}
    >
      <div className="bg-background p-4 col-span-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-muted-foreground w-6">{position}</span>
          <span className="font-mono text-sm text-foreground">{teamName as string}</span>
        </div>
      </div>
      <div className="bg-background p-4">
        <div className="font-mono text-sm text-foreground text-center">{stats?.matchesPlayed || 0}</div>
      </div>
      <div className="bg-background p-4">
        <div className="font-mono text-sm text-foreground text-center">{stats?.wins || 0}</div>
      </div>
      <div className="bg-background p-4">
        <div className="font-mono text-sm text-foreground text-center">{stats?.draws || 0}</div>
      </div>
      <div className="bg-background p-4">
        <div className="font-mono text-sm text-foreground text-center">{stats?.losses || 0}</div>
      </div>
      <div className="bg-background p-4">
        <div
          className={`font-mono text-sm text-center ${
            goalDifference > 0 ? "text-accent" : goalDifference < 0 ? "text-red-500" : "text-foreground"
          }`}
        >
          {goalDifference > 0 ? "+" : ""}
          {goalDifference}
        </div>
      </div>
      <div className="bg-background p-4">
        <div className="font-mono text-sm text-accent font-medium text-center">{stats?.points || 0}</div>
      </div>
    </div>
  )
}
