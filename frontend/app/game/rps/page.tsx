"use client"

import { useState, useEffect } from "react"
import { useAccount, useConnect, useDisconnect } from "wagmi"
import { type Hex, type Address } from "viem"
import { ScrambleTextOnHover } from "@/components/scramble-text"
import { AnimatedNoise } from "@/components/animated-noise"
import { BitmapChevron } from "@/components/bitmap-chevron"
import Link from "next/link"
import {
  useGetMatch,
  useCommitToMatch,
  useGetPlayerStats,
  useScheduleMatch,
  getCardName,
  getCardEmoji,
  getMatchStatusName,
  type RPSMatch,
} from "@/lib/hooks/useRPSContract"
import { injected } from "wagmi/connectors"

enum MatchStatus {
  SCHEDULED = 0,
  PLAYER1_COMMITTED = 1,
  COMPLETED = 2,
  CANCELLED = 3,
}

interface ScheduleFormData {
  player1: string
  player2: string
  duration: string
  durationUnit: "minutes" | "hours"
}

export default function RPSGamePage() {
  const [activeTab, setActiveTab] = useState<"schedule" | "play" | "results">("schedule")
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormData>({
    player1: "",
    player2: "",
    duration: "30",
    durationUnit: "minutes",
  })
  const [playMatchId, setPlayMatchId] = useState<Hex | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)

  // Wagmi hooks
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()

  // Contract hooks
  const { data: matchData, refetch: refetchMatch } = useGetMatch(playMatchId || undefined)
  const { data: playerStats } = useGetPlayerStats(address)

  const {
    scheduleMatch,
    isPending: isScheduling,
    isConfirming: isConfirmingSchedule,
    isConfirmed: isScheduleConfirmed,
    error: scheduleError,
    hash: scheduleHash,
  } = useScheduleMatch()

  const {
    commitToMatch,
    isPending: isCommitting,
    isConfirming: isConfirmingCommit,
    isConfirmed: isCommitConfirmed,
    error: commitError,
  } = useCommitToMatch()

  // Parse match data
  const parseMatch = (data: any): RPSMatch | null => {
    if (!data) return null
    return {
      matchId: data[0] as Hex,
      player1: data[1] as Address,
      player2: data[2] as Address,
      scheduledTime: data[3] as bigint,
      status: Number(data[4]),
      player1Cards: [Number(data[5][0]), Number(data[5][1]), Number(data[5][2])],
      player2Cards: [Number(data[6][0]), Number(data[6][1]), Number(data[6][2])],
      winner: data[7] as Address,
      player1Wins: Number(data[8]),
      player2Wins: Number(data[9]),
      randomSeed1: data[10] as bigint,
      randomSeed2: data[11] as bigint,
      completedAt: data[12] as bigint,
    }
  }

  const currentMatch = parseMatch(matchData)
  const wins = playerStats ? Number((playerStats as any)[0]) : 0
  const totalMatches = playerStats ? Number((playerStats as any)[1]) : 0

  // Countdown timer
  useEffect(() => {
    if (!currentMatch) return

    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000)
      const timeUntilStart = Number(currentMatch.scheduledTime) - now

      if (timeUntilStart > 0) {
        setCountdown(timeUntilStart)
      } else {
        setCountdown(0)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [currentMatch])

  // Refetch match data when transactions are confirmed
  useEffect(() => {
    if (isCommitConfirmed) {
      refetchMatch()
    }
  }, [isCommitConfirmed, refetchMatch])

  // Auto-fill own address in schedule form
  useEffect(() => {
    if (isConnected && address && !scheduleForm.player1) {
      setScheduleForm((prev) => ({ ...prev, player1: address }))
    }
  }, [isConnected, address, scheduleForm.player1])

  const handleConnectWallet = () => {
    connect({ connector: injected() })
  }

  const handleDisconnectWallet = () => {
    disconnect()
  }

  const handleScheduleMatch = () => {
    if (!scheduleForm.player1 || !scheduleForm.player2 || !scheduleForm.duration) return

    const durationInSeconds = scheduleForm.durationUnit === "hours"
      ? parseInt(scheduleForm.duration) * 3600
      : parseInt(scheduleForm.duration) * 60

    const scheduledTimestamp = Math.floor(Date.now() / 1000) + durationInSeconds
    const timestamp = BigInt(scheduledTimestamp)

    scheduleMatch(scheduleForm.player1 as Address, scheduleForm.player2 as Address, timestamp)
  }

  const handleCommitToMatch = () => {
    if (!playMatchId) return
    commitToMatch(playMatchId)
  }

  const canCommit = (): boolean => {
    if (!currentMatch || !address || countdown === null || countdown > 0) return false

    const isPlayer1 = currentMatch.player1.toLowerCase() === address.toLowerCase()
    const isPlayer2 = currentMatch.player2.toLowerCase() === address.toLowerCase()

    if (!isPlayer1 && !isPlayer2) return false

    if (currentMatch.status === MatchStatus.SCHEDULED && isPlayer1) return true
    if (currentMatch.status === MatchStatus.PLAYER1_COMMITTED && isPlayer2) return true

    return false
  }

  const getPlayerRole = (): string | null => {
    if (!currentMatch || !address) return null

    if (currentMatch.player1.toLowerCase() === address.toLowerCase()) return "Player 1"
    if (currentMatch.player2.toLowerCase() === address.toLowerCase()) return "Player 2"
    return "Spectator"
  }

  const formatCountdown = (seconds: number): string => {
    if (seconds <= 0) return "Match Ready!"

    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`
    }
    return `${secs}s`
  }

  return (
    <main className="relative min-h-screen bg-background">
      <AnimatedNoise opacity={0.03} />

      <div className="relative z-10 min-h-screen px-6 md:px-12 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-16">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <BitmapChevron className="w-3 h-3 rotate-180" />
              Back
            </Link>
            <h1 className="font-[var(--font-bebas)] text-[clamp(2rem,6vw,4rem)] text-accent tracking-wide">
              Rock Paper Scissors
            </h1>
            <p className="font-mono text-sm text-muted-foreground mt-2">
              Schedule matches, commit cards, and compete with on-chain randomness
            </p>
          </div>

          {!isConnected ? (
            <button
              onClick={handleConnectWallet}
              className="group inline-flex items-center gap-2 border border-accent bg-accent/10 px-6 py-3 font-mono text-xs uppercase tracking-widest text-accent hover:bg-accent hover:text-background transition-all duration-200"
            >
              <ScrambleTextOnHover text="Connect Wallet" as="span" duration={0.5} />
            </button>
          ) : (
            <div className="flex items-center gap-4">
              <div className="border border-border px-4 py-2 font-mono text-xs">
                <span className="text-muted-foreground">Connected: </span>
                <span className="text-accent">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
              </div>
              <button
                onClick={handleDisconnectWallet}
                className="border border-border px-4 py-2 font-mono text-xs hover:border-accent hover:text-accent transition-colors"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>

        {/* Player Stats */}
        {isConnected && (
          <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-border bg-background/50 p-6">
              <div className="font-mono text-xs text-muted-foreground mb-2">Total Matches</div>
              <div className="font-mono text-3xl text-accent">{totalMatches}</div>
            </div>
            <div className="border border-border bg-background/50 p-6">
              <div className="font-mono text-xs text-muted-foreground mb-2">Wins</div>
              <div className="font-mono text-3xl text-accent">{wins}</div>
            </div>
            <div className="border border-border bg-background/50 p-6">
              <div className="font-mono text-xs text-muted-foreground mb-2">Win Rate</div>
              <div className="font-mono text-3xl text-accent">
                {totalMatches > 0 ? `${((wins / totalMatches) * 100).toFixed(0)}%` : "0%"}
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-8 flex gap-4 border-b border-border">
          <button
            onClick={() => setActiveTab("schedule")}
            className={`pb-4 px-4 font-mono text-xs uppercase tracking-widest transition-colors ${
              activeTab === "schedule"
                ? "text-accent border-b-2 border-accent"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Schedule Match
          </button>
          <button
            onClick={() => setActiveTab("play")}
            className={`pb-4 px-4 font-mono text-xs uppercase tracking-widest transition-colors ${
              activeTab === "play"
                ? "text-accent border-b-2 border-accent"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Play Match
          </button>
          <button
            onClick={() => setActiveTab("results")}
            className={`pb-4 px-4 font-mono text-xs uppercase tracking-widest transition-colors ${
              activeTab === "results"
                ? "text-accent border-b-2 border-accent"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            View Results
          </button>
        </div>

        {/* Schedule Match Tab */}
        {activeTab === "schedule" && (
          <div className="max-w-2xl">
            <h2 className="font-mono text-xs uppercase tracking-widest text-foreground mb-6 flex items-center gap-2">
              <span className="w-2 h-2 bg-accent" />
              Schedule New Match
            </h2>

            <div className="border border-border bg-background/50 p-8">
              <div className="space-y-6">
                <div>
                  <label className="font-mono text-xs text-muted-foreground mb-2 block">
                    Player 1 Address
                  </label>
                  <input
                    type="text"
                    value={scheduleForm.player1}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, player1: e.target.value })}
                    placeholder="0x..."
                    className="w-full bg-background border border-border px-4 py-3 font-mono text-sm text-foreground focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="font-mono text-xs text-muted-foreground mb-2 block">
                    Player 2 Address
                  </label>
                  <input
                    type="text"
                    value={scheduleForm.player2}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, player2: e.target.value })}
                    placeholder="0x..."
                    className="w-full bg-background border border-border px-4 py-3 font-mono text-sm text-foreground focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="font-mono text-xs text-muted-foreground mb-2 block">
                    Match Starts In
                  </label>
                  <div className="flex gap-4 mb-3">
                    <input
                      type="number"
                      min="1"
                      value={scheduleForm.duration}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, duration: e.target.value })}
                      placeholder="30"
                      className="flex-1 bg-background border border-border px-4 py-3 font-mono text-sm text-foreground focus:outline-none focus:border-accent"
                    />
                    <select
                      value={scheduleForm.durationUnit}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, durationUnit: e.target.value as "minutes" | "hours" })}
                      className="bg-background border border-border px-4 py-3 font-mono text-sm text-foreground focus:outline-none focus:border-accent"
                    >
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                    </select>
                  </div>
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setScheduleForm({ ...scheduleForm, duration: "5", durationUnit: "minutes" })}
                      className="px-3 py-1 border border-border font-mono text-xs hover:border-accent hover:text-accent transition-colors"
                    >
                      5 min
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleForm({ ...scheduleForm, duration: "15", durationUnit: "minutes" })}
                      className="px-3 py-1 border border-border font-mono text-xs hover:border-accent hover:text-accent transition-colors"
                    >
                      15 min
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleForm({ ...scheduleForm, duration: "30", durationUnit: "minutes" })}
                      className="px-3 py-1 border border-border font-mono text-xs hover:border-accent hover:text-accent transition-colors"
                    >
                      30 min
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleForm({ ...scheduleForm, duration: "1", durationUnit: "hours" })}
                      className="px-3 py-1 border border-border font-mono text-xs hover:border-accent hover:text-accent transition-colors"
                    >
                      1 hour
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleForm({ ...scheduleForm, duration: "2", durationUnit: "hours" })}
                      className="px-3 py-1 border border-border font-mono text-xs hover:border-accent hover:text-accent transition-colors"
                    >
                      2 hours
                    </button>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">
                    Match will be playable after this duration from now
                  </p>
                </div>

                <button
                  onClick={handleScheduleMatch}
                  disabled={!isConnected || !scheduleForm.player1 || !scheduleForm.player2 || !scheduleForm.duration || isScheduling || isConfirmingSchedule}
                  className="w-full group inline-flex items-center justify-center gap-2 border border-accent bg-accent/10 px-6 py-3 font-mono text-xs uppercase tracking-widest text-accent hover:bg-accent hover:text-background transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ScrambleTextOnHover
                    text={isScheduling ? "Confirming..." : isConfirmingSchedule ? "Processing..." : "Schedule Match"}
                    as="span"
                    duration={0.5}
                  />
                </button>

                {scheduleError && (
                  <div className="p-4 border border-red-500/50 bg-red-500/10">
                    <p className="font-mono text-xs text-red-500">Error: {scheduleError.message}</p>
                  </div>
                )}

                {isScheduleConfirmed && scheduleHash && (
                  <div className="p-4 border border-accent bg-accent/10">
                    <p className="font-mono text-xs text-accent mb-2">Match scheduled successfully!</p>
                    <p className="font-mono text-xs text-muted-foreground break-all">
                      Transaction: {scheduleHash}
                    </p>
                    <button
                      onClick={() => {
                        setActiveTab("play")
                        // Extract match ID from events if needed
                      }}
                      className="mt-4 font-mono text-xs text-accent hover:underline"
                    >
                      Go to Play Match →
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 border border-border bg-background/50 p-6">
              <h3 className="font-mono text-xs uppercase tracking-widest text-foreground mb-4">How Scheduling Works</h3>
              <div className="space-y-3 font-mono text-xs text-muted-foreground">
                <p>• Schedule a match between any two wallet addresses</p>
                <p>• Choose how long until the match starts (in minutes or hours)</p>
                <p>• Quick presets available: 5min, 15min, 30min, 1hr, 2hr</p>
                <p>• Both players commit after the countdown ends</p>
                <p>• Cards are randomly generated on-chain when committing</p>
                <p>• Match resolves automatically when both players commit</p>
              </div>
            </div>
          </div>
        )}

        {/* Play Match Tab */}
        {activeTab === "play" && (
          <div className="max-w-4xl">
            <h2 className="font-mono text-xs uppercase tracking-widest text-foreground mb-6 flex items-center gap-2">
              <span className="w-2 h-2 bg-accent" />
              Play Match
            </h2>

            {!currentMatch ? (
              <div className="border border-border bg-background/50 p-8">
                <div className="mb-6">
                  <label className="font-mono text-xs text-muted-foreground mb-2 block">
                    Enter Match ID
                  </label>
                  <input
                    type="text"
                    placeholder="0x..."
                    onChange={(e) => setPlayMatchId(e.target.value as Hex)}
                    className="w-full bg-background border border-border px-4 py-3 font-mono text-sm text-foreground focus:outline-none focus:border-accent"
                  />
                  <p className="mt-2 font-mono text-xs text-muted-foreground">
                    Enter the match ID to load match details
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Match Status Card */}
                <div className="border border-border bg-background/50 p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <div className="font-mono text-xs text-muted-foreground mb-2">Match ID</div>
                      <div className="font-mono text-sm text-foreground">{currentMatch.matchId.slice(0, 16)}...</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-xs text-muted-foreground mb-2">Status</div>
                      <div className="font-mono text-sm text-accent uppercase">
                        {getMatchStatusName(currentMatch.status)}
                      </div>
                    </div>
                  </div>

                  {/* Countdown Timer */}
                  {currentMatch.status !== MatchStatus.COMPLETED && countdown !== null && (
                    <div className="mb-6 p-6 border border-accent bg-accent/5 text-center">
                      <div className="font-mono text-xs text-muted-foreground mb-2">
                        {countdown > 0 ? "Match starts in" : "Match is ready!"}
                      </div>
                      <div className="font-mono text-4xl text-accent">{formatCountdown(countdown)}</div>
                    </div>
                  )}

                  {/* Player Info */}
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div className="border border-border p-4">
                      <div className="font-mono text-xs text-muted-foreground mb-2">Player 1</div>
                      <div className="font-mono text-sm text-foreground mb-4">
                        {currentMatch.player1.slice(0, 6)}...{currentMatch.player1.slice(-4)}
                      </div>
                      {currentMatch.status >= MatchStatus.PLAYER1_COMMITTED && (
                        <div className="inline-block px-3 py-1 border border-accent bg-accent/10 font-mono text-xs text-accent">
                          Committed ✓
                        </div>
                      )}
                    </div>

                    <div className="border border-border p-4">
                      <div className="font-mono text-xs text-muted-foreground mb-2">Player 2</div>
                      <div className="font-mono text-sm text-foreground mb-4">
                        {currentMatch.player2.slice(0, 6)}...{currentMatch.player2.slice(-4)}
                      </div>
                      {currentMatch.status === MatchStatus.COMPLETED && (
                        <div className="inline-block px-3 py-1 border border-accent bg-accent/10 font-mono text-xs text-accent">
                          Committed ✓
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Your Role */}
                  {getPlayerRole() && (
                    <div className="mb-6 p-4 border border-border bg-background/80">
                      <div className="font-mono text-xs text-muted-foreground">Your Role</div>
                      <div className="font-mono text-sm text-accent">{getPlayerRole()}</div>
                    </div>
                  )}

                  {/* Commit Button */}
                  {canCommit() && (
                    <button
                      onClick={handleCommitToMatch}
                      disabled={isCommitting || isConfirmingCommit}
                      className="w-full group inline-flex items-center justify-center gap-2 border border-accent bg-accent/10 px-6 py-4 font-mono text-sm uppercase tracking-widest text-accent hover:bg-accent hover:text-background transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ScrambleTextOnHover
                        text={isCommitting ? "Confirming..." : isConfirmingCommit ? "Generating Cards..." : "Commit to Match"}
                        as="span"
                        duration={0.5}
                      />
                    </button>
                  )}

                  {commitError && (
                    <div className="mt-4 p-4 border border-red-500/50 bg-red-500/10">
                      <p className="font-mono text-xs text-red-500">Error: {commitError.message}</p>
                    </div>
                  )}

                  {isCommitConfirmed && (
                    <div className="mt-4 p-4 border border-accent bg-accent/10">
                      <p className="font-mono text-xs text-accent">
                        Cards generated! {currentMatch.status === MatchStatus.PLAYER1_COMMITTED ? "Waiting for Player 2..." : "Match complete!"}
                      </p>
                    </div>
                  )}

                  {/* Waiting Message */}
                  {!canCommit() && currentMatch.status !== MatchStatus.COMPLETED && getPlayerRole() !== "Spectator" && (
                    <div className="p-4 border border-border bg-background/80 text-center">
                      <p className="font-mono text-xs text-muted-foreground">
                        {countdown && countdown > 0 ? "Waiting for scheduled time..." : "Waiting for other player..."}
                      </p>
                    </div>
                  )}
                </div>

                {/* Match Results */}
                {currentMatch.status === MatchStatus.COMPLETED && (
                  <div className="border border-border bg-background/50 p-8">
                    <h3 className="font-mono text-xs uppercase tracking-widest text-foreground mb-6 flex items-center gap-2">
                      <span className="w-2 h-2 bg-foreground/20" />
                      Match Results
                    </h3>

                    {/* Winner Banner */}
                    <div className="mb-6 p-6 border-2 border-accent bg-accent/5 text-center">
                      <div className="font-mono text-xs text-muted-foreground mb-2">Winner</div>
                      <div className="font-mono text-2xl text-accent">
                        {currentMatch.winner === "0x0000000000000000000000000000000000000000"
                          ? "🤝 TIE GAME"
                          : `🏆 ${currentMatch.winner.slice(0, 6)}...${currentMatch.winner.slice(-4)}`}
                      </div>
                      <div className="mt-2 font-mono text-sm text-muted-foreground">
                        Score: {currentMatch.player1Wins} - {currentMatch.player2Wins}
                      </div>
                    </div>

                    {/* Cards Display */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Player 1 Cards */}
                      <div>
                        <div className="font-mono text-xs text-muted-foreground mb-4">
                          Player 1 Cards ({currentMatch.player1Wins} wins)
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {currentMatch.player1Cards.map((card, i) => (
                            <div key={i} className="border border-border bg-background p-4 text-center">
                              <div className="text-3xl mb-2">{getCardEmoji(card)}</div>
                              <div className="font-mono text-xs text-muted-foreground">{getCardName(card)}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Player 2 Cards */}
                      <div>
                        <div className="font-mono text-xs text-muted-foreground mb-4">
                          Player 2 Cards ({currentMatch.player2Wins} wins)
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {currentMatch.player2Cards.map((card, i) => (
                            <div key={i} className="border border-border bg-background p-4 text-center">
                              <div className="text-3xl mb-2">{getCardEmoji(card)}</div>
                              <div className="font-mono text-xs text-muted-foreground">{getCardName(card)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Round by Round */}
                    <div className="mt-6 border border-border p-4">
                      <div className="font-mono text-xs text-muted-foreground mb-3">Round Results</div>
                      <div className="space-y-2">
                        {[0, 1, 2].map((i) => {
                          const card1 = currentMatch.player1Cards[i]
                          const card2 = currentMatch.player2Cards[i]
                          let result = "Tie"
                          if (
                            (card1 === 0 && card2 === 2) ||
                            (card1 === 1 && card2 === 0) ||
                            (card1 === 2 && card2 === 1)
                          ) {
                            result = "P1 Wins"
                          } else if (card1 !== card2) {
                            result = "P2 Wins"
                          }

                          return (
                            <div key={i} className="flex items-center justify-between font-mono text-xs">
                              <span className="text-muted-foreground">Round {i + 1}</span>
                              <span className="text-foreground">
                                {getCardEmoji(card1)} vs {getCardEmoji(card2)}
                              </span>
                              <span className="text-accent">{result}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Results Tab */}
        {activeTab === "results" && (
          <div className="max-w-2xl">
            <h2 className="font-mono text-xs uppercase tracking-widest text-foreground mb-6 flex items-center gap-2">
              <span className="w-2 h-2 bg-accent" />
              View Match Results
            </h2>

            <div className="border border-border bg-background/50 p-8">
              <div className="mb-6">
                <label className="font-mono text-xs text-muted-foreground mb-2 block">
                  Enter Match ID
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  onChange={(e) => {
                    setPlayMatchId(e.target.value as Hex)
                    setActiveTab("play")
                  }}
                  className="w-full bg-background border border-border px-4 py-3 font-mono text-sm text-foreground focus:outline-none focus:border-accent"
                />
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  Enter a match ID to view its results
                </p>
              </div>

              <div className="p-6 border border-border bg-background/80 text-center">
                <p className="font-mono text-xs text-muted-foreground">
                  Or switch to the "Play Match" tab to view active matches
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
