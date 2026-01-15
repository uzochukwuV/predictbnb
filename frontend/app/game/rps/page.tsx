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
  useGetPlayerMatches,
  useScheduleMatch,
  getCardName,
  getCardEmoji,
  getMatchStatusName,
  type RPSMatch,
} from "@/lib/hooks/useRPSContract"
import { injected } from "wagmi/connectors"
import { Clock, Trophy, Users, Zap } from "lucide-react"

enum MatchStatus {
  SCHEDULED = 0,
  PLAYER1_COMMITTED = 1,
  COMPLETED = 2,
  CANCELLED = 3,
}

interface ScheduleFormData {
  player2: string
  duration: string
  durationUnit: "minutes" | "hours"
}

export default function RPSGamePage() {
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormData>({
    player2: "",
    duration: "5",
    durationUnit: "minutes",
  })
  const [selectedMatchId, setSelectedMatchId] = useState<Hex | null>(null)

  // Wagmi hooks
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()

  // Contract hooks
  const { data: playerMatchIds, refetch: refetchPlayerMatches } = useGetPlayerMatches(address)
  const { data: selectedMatchData, refetch: refetchSelectedMatch } = useGetMatch(selectedMatchId || undefined)
  const { data: playerStats } = useGetPlayerStats(address)

  const {
    scheduleMatch,
    isPending: isScheduling,
    isConfirming: isConfirmingSchedule,
    isConfirmed: isScheduleConfirmed,
    error: scheduleError,
  } = useScheduleMatch()

  const {
    commitToMatch,
    isPending: isCommitting,
    isConfirming: isConfirmingCommit,
    isConfirmed: isCommitConfirmed,
    error: commitError,
  } = useCommitToMatch()

  const wins = playerStats ? Number((playerStats as any)[0]) : 0
  const totalMatches = playerStats ? Number((playerStats as any)[1]) : 0

  // Auto-select first match if none selected
  useEffect(() => {
    if (!selectedMatchId && playerMatchIds && (playerMatchIds as Hex[]).length > 0) {
      setSelectedMatchId((playerMatchIds as Hex[])[0])
    }
  }, [playerMatchIds, selectedMatchId])

  // Refetch on transaction confirm
  useEffect(() => {
    if (isScheduleConfirmed) {
      refetchPlayerMatches()
      setShowScheduleForm(false)
      setScheduleForm({
        player2: "",
        duration: "5",
        durationUnit: "minutes",
      })
    }
  }, [isScheduleConfirmed, refetchPlayerMatches])

  useEffect(() => {
    if (isCommitConfirmed) {
      refetchSelectedMatch()
      refetchPlayerMatches()
    }
  }, [isCommitConfirmed, refetchSelectedMatch, refetchPlayerMatches])

  const handleConnectWallet = () => {
    connect({ connector: injected() })
  }

  const handleScheduleMatch = () => {
    if (!address || !scheduleForm.player2 || !scheduleForm.duration) return

    const durationInSeconds =
      scheduleForm.durationUnit === "hours"
        ? parseInt(scheduleForm.duration) * 3600
        : parseInt(scheduleForm.duration) * 60

    const scheduledTimestamp = Math.floor(Date.now() / 1000) + durationInSeconds
    const timestamp = BigInt(scheduledTimestamp)

    scheduleMatch(address, scheduleForm.player2 as Address, timestamp)
  }

  const handleCommitToMatch = (matchId: Hex) => {
    commitToMatch(matchId)
  }

  const formatCountdown = (seconds: number): string => {
    if (seconds <= 0) return "Ready!"

    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`
    if (minutes > 0) return `${minutes}m ${secs}s`
    return `${secs}s`
  }

  return (
    <main className="relative min-h-screen bg-background">
      <AnimatedNoise opacity={0.03} />

      <div className="relative z-10 min-h-screen px-6 md:px-12 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <BitmapChevron className="w-3 h-3 rotate-180" />
              Back
            </Link>
            <h1 className="font-[var(--font-bebas)] text-[clamp(2.5rem,7vw,5rem)] text-accent tracking-wide leading-none">
              ROCK PAPER SCISSORS
            </h1>
            <p className="font-mono text-sm text-muted-foreground mt-2">
              On-chain randomness • Best of 3 rounds • Instant settlement
            </p>
          </div>

          {!isConnected ? (
            <button
              onClick={handleConnectWallet}
              className="group inline-flex items-center gap-2 border-2 border-accent bg-accent/10 px-6 py-3 font-mono text-xs uppercase tracking-widest text-accent hover:bg-accent hover:text-background transition-all duration-200"
            >
              <ScrambleTextOnHover text="Connect Wallet" as="span" duration={0.5} />
            </button>
          ) : (
            <div className="flex items-center gap-4">
              <div className="border border-border px-4 py-2 font-mono text-xs">
                <span className="text-muted-foreground">Connected: </span>
                <span className="text-accent">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
              </div>
              <button
                onClick={() => disconnect()}
                className="border border-border px-4 py-2 font-mono text-xs hover:border-accent hover:text-accent transition-colors"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>

        {!isConnected ? (
          <div className="text-center py-24 border border-border bg-background/50">
            <Zap className="w-12 h-12 text-accent mx-auto mb-4" />
            <h2 className="font-mono text-lg text-foreground mb-2">Connect Your Wallet</h2>
            <p className="font-mono text-xs text-muted-foreground">
              Connect to view your matches and start playing
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Player Stats & Match List */}
            <div className="space-y-6">
              {/* Player Stats */}
              <div className="border border-border bg-background/50 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="w-5 h-5 text-accent" />
                  <h2 className="font-mono text-xs uppercase tracking-widest text-foreground">Your Stats</h2>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="font-mono text-2xl text-accent">{totalMatches}</div>
                    <div className="font-mono text-xs text-muted-foreground mt-1">Matches</div>
                  </div>
                  <div>
                    <div className="font-mono text-2xl text-accent">{wins}</div>
                    <div className="font-mono text-xs text-muted-foreground mt-1">Wins</div>
                  </div>
                  <div>
                    <div className="font-mono text-2xl text-accent">
                      {totalMatches > 0 ? `${((wins / totalMatches) * 100).toFixed(0)}%` : "0%"}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground mt-1">Win Rate</div>
                  </div>
                </div>
              </div>

              {/* Match List */}
              <div className="border border-border bg-background/50 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-accent" />
                    <h2 className="font-mono text-xs uppercase tracking-widest text-foreground">Your Matches</h2>
                  </div>
                  <button
                    onClick={() => setShowScheduleForm(!showScheduleForm)}
                    className="border border-accent bg-accent/10 px-3 py-1 font-mono text-xs text-accent hover:bg-accent hover:text-background transition-all duration-200"
                  >
                    {showScheduleForm ? "Cancel" : "+ New"}
                  </button>
                </div>

                {showScheduleForm && (
                  <div className="mb-4 p-4 border border-border bg-background/80 space-y-3">
                    <div>
                      <label className="font-mono text-xs text-muted-foreground mb-1 block">
                        Opponent Address
                      </label>
                      <input
                        type="text"
                        value={scheduleForm.player2}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, player2: e.target.value })}
                        placeholder="0x..."
                        className="w-full bg-background border border-border px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min="1"
                        value={scheduleForm.duration}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, duration: e.target.value })}
                        className="bg-background border border-border px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                      <select
                        value={scheduleForm.durationUnit}
                        onChange={(e) =>
                          setScheduleForm({
                            ...scheduleForm,
                            durationUnit: e.target.value as "minutes" | "hours",
                          })
                        }
                        className="bg-background border border-border px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:border-accent"
                      >
                        <option value="minutes">Min</option>
                        <option value="hours">Hrs</option>
                      </select>
                    </div>
                    <button
                      onClick={handleScheduleMatch}
                      disabled={
                        !scheduleForm.player2 || !scheduleForm.duration || isScheduling || isConfirmingSchedule
                      }
                      className="w-full border border-accent bg-accent/10 px-4 py-2 font-mono text-xs text-accent hover:bg-accent hover:text-background transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isScheduling ? "Confirming..." : isConfirmingSchedule ? "Processing..." : "Schedule Match"}
                    </button>
                    {scheduleError && (
                      <div className="p-2 border border-red-500/50 bg-red-500/10">
                        <p className="font-mono text-xs text-red-500">{scheduleError.message}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {!playerMatchIds || (playerMatchIds as Hex[]).length === 0 ? (
                    <div className="text-center py-8">
                      <p className="font-mono text-xs text-muted-foreground">No matches yet</p>
                      <p className="font-mono text-xs text-muted-foreground mt-1">
                        Schedule your first match
                      </p>
                    </div>
                  ) : (
                    (playerMatchIds as Hex[]).map((matchId) => (
                      <MatchListItem
                        key={matchId}
                        matchId={matchId}
                        isSelected={matchId === selectedMatchId}
                        onClick={() => setSelectedMatchId(matchId)}
                        playerAddress={address}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Selected Match Details */}
            <div className="lg:col-span-2">
              {selectedMatchId ? (
                <MatchDetails
                  matchId={selectedMatchId}
                  matchData={selectedMatchData}
                  playerAddress={address}
                  onCommit={handleCommitToMatch}
                  isCommitting={isCommitting}
                  isConfirmingCommit={isConfirmingCommit}
                  isCommitConfirmed={isCommitConfirmed}
                  commitError={commitError}
                  formatCountdown={formatCountdown}
                />
              ) : (
                <div className="border border-border bg-background/50 p-12 text-center">
                  <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-mono text-sm text-foreground mb-2">No Match Selected</h3>
                  <p className="font-mono text-xs text-muted-foreground">
                    Select a match from the list or schedule a new one
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

// Match List Item Component
function MatchListItem({
  matchId,
  isSelected,
  onClick,
  playerAddress,
}: {
  matchId: Hex
  isSelected: boolean
  onClick: () => void
  playerAddress: Address | undefined
}) {
  const { data: matchData } = useGetMatch(matchId)
  const [countdown, setCountdown] = useState<number | null>(null)

  const match = matchData
    ? ({
        matchId: matchData.matchId,
        player1: matchData.player1 as Address,
        player2: matchData.player2 as Address,
        scheduledTime: matchData.scheduledTime as bigint,
        status: matchData.status,
        player1Cards: matchData.player1Cards,
        player2Cards: matchData.player2Cards,
        winner: matchData.winner as Address,
        player1Wins: matchData.player1Wins,
        player2Wins: matchData.player2Wins,
        randomSeed1: matchData.randomSeed1 as bigint,
        randomSeed2: matchData.randomSeed2 as bigint,
        completedAt: matchData.completedAt as bigint,
      } as RPSMatch)
    : null

  useEffect(() => {
    if (!match) return

    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000)
      const timeUntilStart = Number(match.scheduledTime) - now
      setCountdown(Math.max(0, timeUntilStart))
    }, 1000)

    return () => clearInterval(interval)
  }, [match])

  if (!match) {
    return (
      <div className="p-3 border border-border bg-background/50">
        <div className="font-mono text-xs text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const opponent =
    match.player1.toLowerCase() === playerAddress?.toLowerCase() ? match.player2 : match.player1

  const isReady = countdown !== null && countdown === 0

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 border transition-all duration-200 ${
        isSelected
          ? "border-accent bg-accent/10"
          : "border-border bg-background/50 hover:border-accent/50 hover:bg-background/80"
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="font-mono text-xs text-foreground">
          vs {opponent.slice(0, 6)}...{opponent.slice(-4)}
        </div>
        <div
          className={`font-mono text-xs uppercase px-2 py-0.5 ${
            match.status === MatchStatus.COMPLETED
              ? "text-green-400 bg-green-400/10"
              : isReady
                ? "text-accent bg-accent/10"
                : "text-muted-foreground bg-muted-foreground/10"
          }`}
        >
          {match.status === MatchStatus.COMPLETED
            ? "Done"
            : isReady
              ? "Ready"
              : countdown !== null && countdown > 0
                ? `${Math.floor(countdown / 60)}m`
                : "Waiting"}
        </div>
      </div>
      <div className="font-mono text-xs text-muted-foreground">
        {getMatchStatusName(match.status)}
      </div>
    </button>
  )
}

// Match Details Component
function MatchDetails({
  matchId,
  matchData,
  playerAddress,
  onCommit,
  isCommitting,
  isConfirmingCommit,
  isCommitConfirmed,
  commitError,
  formatCountdown,
}: {
  matchId: Hex
  matchData: any
  playerAddress: Address | undefined
  onCommit: (matchId: Hex) => void
  isCommitting: boolean
  isConfirmingCommit: boolean
  isCommitConfirmed: boolean
  commitError: Error | null
  formatCountdown: (seconds: number) => string
}) {
  const [countdown, setCountdown] = useState<number | null>(null)

  const match = matchData
    ? ({
        matchId: matchData.matchId,
        player1: matchData.player1 as Address,
        player2: matchData.player2 as Address,
        scheduledTime: matchData.scheduledTime as bigint,
        status: matchData.status,
        player1Cards: matchData.player1Cards,
        player2Cards: matchData.player2Cards,
        winner: matchData.winner as Address,
        player1Wins: matchData.player1Wins,
        player2Wins: matchData.player2Wins,
        randomSeed1: matchData.randomSeed1 as bigint,
        randomSeed2: matchData.randomSeed2 as bigint,
        completedAt: matchData.completedAt as bigint,
      } as RPSMatch)
    : null

  useEffect(() => {
    if (!match) return

    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000)
      const timeUntilStart = Number(match.scheduledTime) - now
      setCountdown(Math.max(0, timeUntilStart))
    }, 1000)

    return () => clearInterval(interval)
  }, [match])

  if (!match) {
    return (
      <div className="border border-border bg-background/50 p-8 text-center">
        <div className="font-mono text-sm text-muted-foreground">Loading match...</div>
      </div>
    )
  }

  const isPlayer1 = match.player1.toLowerCase() === playerAddress?.toLowerCase()
  const isPlayer2 = match.player2.toLowerCase() === playerAddress?.toLowerCase()
  const isPlayer = isPlayer1 || isPlayer2

  const canCommit =
    isPlayer &&
    countdown === 0 &&
    ((match.status === MatchStatus.SCHEDULED && isPlayer1) ||
      (match.status === MatchStatus.PLAYER1_COMMITTED && isPlayer2))

  return (
    <div className="space-y-6">
      {/* Countdown Banner */}
      {match.status !== MatchStatus.COMPLETED && countdown !== null && (
        <div className="border-2 border-accent bg-accent/5 p-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-accent" />
            <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              {countdown > 0 ? "Match Starts In" : "Match Ready!"}
            </h3>
          </div>
          <div className="font-[var(--font-bebas)] text-[clamp(2rem,6vw,4rem)] text-accent leading-none">
            {formatCountdown(countdown)}
          </div>
        </div>
      )}

      {/* Players & Status */}
      <div className="border border-border bg-background/50 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-mono text-xs uppercase tracking-widest text-foreground">Match Info</h3>
          <div
            className={`font-mono text-xs uppercase px-3 py-1 ${
              match.status === MatchStatus.COMPLETED
                ? "text-green-400 border border-green-400 bg-green-400/10"
                : countdown === 0
                  ? "text-accent border border-accent bg-accent/10"
                  : "text-muted-foreground border border-border"
            }`}
          >
            {getMatchStatusName(match.status)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Player 1 */}
          <div className="border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-accent" />
              <div className="font-mono text-xs text-muted-foreground">Player 1</div>
            </div>
            <div className="font-mono text-sm text-foreground mb-3 break-all">
              {match.player1.slice(0, 10)}...{match.player1.slice(-8)}
            </div>
            {match.status >= MatchStatus.PLAYER1_COMMITTED && (
              <div className="inline-block px-3 py-1 border border-accent bg-accent/10 font-mono text-xs text-accent">
                Committed ✓
              </div>
            )}
            {isPlayer1 && (
              <div className="mt-2 font-mono text-xs text-accent">(You)</div>
            )}
          </div>

          {/* Player 2 */}
          <div className="border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-accent" />
              <div className="font-mono text-xs text-muted-foreground">Player 2</div>
            </div>
            <div className="font-mono text-sm text-foreground mb-3 break-all">
              {match.player2.slice(0, 10)}...{match.player2.slice(-8)}
            </div>
            {match.status === MatchStatus.COMPLETED && (
              <div className="inline-block px-3 py-1 border border-accent bg-accent/10 font-mono text-xs text-accent">
                Committed ✓
              </div>
            )}
            {isPlayer2 && (
              <div className="mt-2 font-mono text-xs text-accent">(You)</div>
            )}
          </div>
        </div>

        {/* Commit Action */}
        {canCommit && (
          <div className="mt-6">
            <button
              onClick={() => onCommit(matchId)}
              disabled={isCommitting || isConfirmingCommit}
              className="w-full border-2 border-accent bg-accent/10 px-6 py-4 font-mono text-sm uppercase tracking-widest text-accent hover:bg-accent hover:text-background transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCommitting
                ? "Confirming..."
                : isConfirmingCommit
                  ? "Generating Cards..."
                  : "🎲 Commit to Match"}
            </button>
          </div>
        )}

        {commitError && (
          <div className="mt-4 p-4 border border-red-500/50 bg-red-500/10">
            <p className="font-mono text-xs text-red-500">{commitError.message}</p>
          </div>
        )}

        {isCommitConfirmed && match.status !== MatchStatus.COMPLETED && (
          <div className="mt-4 p-4 border border-accent bg-accent/10">
            <p className="font-mono text-xs text-accent">
              Cards generated! {match.status === MatchStatus.PLAYER1_COMMITTED ? "Waiting for Player 2..." : ""}
            </p>
          </div>
        )}

        {!canCommit && !isPlayer && match.status !== MatchStatus.COMPLETED && (
          <div className="mt-6 p-4 border border-border bg-background/80 text-center">
            <p className="font-mono text-xs text-muted-foreground">You are spectating this match</p>
          </div>
        )}

        {!canCommit && isPlayer && match.status !== MatchStatus.COMPLETED && (
          <div className="mt-6 p-4 border border-border bg-background/80 text-center">
            <p className="font-mono text-xs text-muted-foreground">
              {countdown && countdown > 0
                ? "Waiting for scheduled time..."
                : match.status === MatchStatus.SCHEDULED
                  ? "Waiting for Player 1 to commit..."
                  : "Waiting for Player 2 to commit..."}
            </p>
          </div>
        )}
      </div>

      {/* Match Results */}
      {match.status === MatchStatus.COMPLETED && (
        <div className="border border-border bg-background/50 p-6">
          <h3 className="font-mono text-xs uppercase tracking-widest text-foreground mb-6">Match Results</h3>

          {/* Winner Banner */}
          <div className="mb-6 p-6 border-2 border-accent bg-accent/5 text-center">
            <div className="font-mono text-xs text-muted-foreground mb-2">Winner</div>
            <div className="font-[var(--font-bebas)] text-3xl text-accent">
              {match.winner === "0x0000000000000000000000000000000000000000"
                ? "🤝 TIE GAME"
                : `🏆 ${match.winner.slice(0, 6)}...${match.winner.slice(-4)}`}
            </div>
            <div className="mt-2 font-mono text-lg text-muted-foreground">
              Score: {match.player1Wins} - {match.player2Wins}
            </div>
          </div>

          {/* Cards Display */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Player 1 Cards */}
            <div>
              <div className="font-mono text-xs text-muted-foreground mb-4">
                Player 1 Cards ({match.player1Wins} {match.player1Wins === 1 ? "win" : "wins"})
              </div>
              <div className="grid grid-cols-3 gap-3">
                {match.player1Cards.map((card, i) => (
                  <div key={i} className="border border-border bg-background p-4 text-center aspect-square flex flex-col items-center justify-center">
                    <div className="text-4xl mb-2">{getCardEmoji(card)}</div>
                    <div className="font-mono text-xs text-muted-foreground">{getCardName(card)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Player 2 Cards */}
            <div>
              <div className="font-mono text-xs text-muted-foreground mb-4">
                Player 2 Cards ({match.player2Wins} {match.player2Wins === 1 ? "win" : "wins"})
              </div>
              <div className="grid grid-cols-3 gap-3">
                {match.player2Cards.map((card, i) => (
                  <div key={i} className="border border-border bg-background p-4 text-center aspect-square flex flex-col items-center justify-center">
                    <div className="text-4xl mb-2">{getCardEmoji(card)}</div>
                    <div className="font-mono text-xs text-muted-foreground">{getCardName(card)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Round by Round */}
          <div className="mt-6 border border-border p-4">
            <div className="font-mono text-xs text-muted-foreground mb-3">Round Breakdown</div>
            <div className="space-y-2">
              {[0, 1, 2].map((i) => {
                const card1 = match.player1Cards[i]
                const card2 = match.player2Cards[i]
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
                    <span className={`${result === "Tie" ? "text-muted-foreground" : "text-accent"}`}>
                      {result}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
