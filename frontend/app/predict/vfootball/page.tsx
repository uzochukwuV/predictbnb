"use client"

import { useState, useEffect } from "react"
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { formatEther, parseEther, type Address } from "viem"
import { ScrambleTextOnHover } from "@/components/scramble-text"
import { AnimatedNoise } from "@/components/animated-noise"
import { BitmapChevron } from "@/components/bitmap-chevron"
import { SideNav } from "@/components/side-nav"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { VirtualFootballGameContract, VirtualFootballMarketContract } from "@/lib/contracts"

// Enums matching contracts
enum SeasonStatus {
  UPCOMING = 0,
  ACTIVE = 1,
  COMPLETED = 2,
}

enum BetType {
  MATCH_WINNER = 0,
  OVER_UNDER = 1,
  BOTH_TEAMS_SCORE = 2,
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

type Vote = {
  voter: Address
  predictedWinner: number
  votedAt: bigint
  claimed: boolean
  isEarlyVoter: boolean
}

type SingleBet = {
  betId: bigint
  bettor: Address
  gameMatchId: bigint
  oracleMatchId: string
  betType: BetType
  selection: number
  amount: bigint
  odds: number
  isSettled: boolean
  isWon: boolean
  isClaimed: boolean
}

const TEAM_NAMES = [
  "Manchester City",
  "Arsenal",
  "Liverpool",
  "Manchester United",
  "Chelsea",
  "Tottenham",
  "Newcastle",
  "Brighton",
  "Aston Villa",
  "West Ham",
]

export default function VirtualFootballPredictionMarketPage() {
  const [activeTab, setActiveTab] = useState<"voting" | "betting" | "tipster" | "mybets">("voting")
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null)
  const [selectedMatch, setSelectedMatch] = useState<bigint | null>(null)
  const [betType, setBetType] = useState<BetType>(BetType.MATCH_WINNER)
  const [betSelection, setBetSelection] = useState<number | null>(null)
  const [betAmount, setBetAmount] = useState("")

  const { address, isConnected } = useAccount()

  // Fetch current season
  const { data: currentSeasonId, refetch: refetchSeasonId } = useReadContract({
    ...VirtualFootballGameContract,
    functionName: "currentSeasonId",
  })

  const { data: seasonData, refetch: refetchSeason } = useReadContract({
    ...VirtualFootballGameContract,
    functionName: "getSeason",
    args: currentSeasonId ? [Number(currentSeasonId)] : undefined,
    query: {
      enabled: !!currentSeasonId && currentSeasonId > 0,
    },
  })

  // Fetch season matches
  const { data: seasonMatchIds } = useReadContract({
    ...VirtualFootballGameContract,
    functionName: "getSeasonMatches",
    args: currentSeasonId ? [Number(currentSeasonId)] : undefined,
    query: {
      enabled: !!currentSeasonId && currentSeasonId > 0,
    },
  })

  // Fetch user's vote for current season
  const { data: userVoteData, refetch: refetchVote } = useReadContract({
    ...VirtualFootballMarketContract,
    functionName: "seasonVotes",
    args: currentSeasonId && address ? [Number(currentSeasonId), address] : undefined,
    query: {
      enabled: !!currentSeasonId && !!address && currentSeasonId > 0,
    },
  })

  // Fetch user's bets
  const { data: userBetIds, refetch: refetchUserBets } = useReadContract({
    ...VirtualFootballMarketContract,
    functionName: "userBets",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  })

  // Fetch betting volume for current season
  const { data: seasonVolume } = useReadContract({
    ...VirtualFootballMarketContract,
    functionName: "seasonBettingVolume",
    args: currentSeasonId ? [Number(currentSeasonId)] : undefined,
    query: {
      enabled: !!currentSeasonId && currentSeasonId > 0,
    },
  })

  // Write contract hooks
  const { data: voteHash, writeContract: voteForWinner, isPending: isVoting } = useWriteContract()
  const { data: claimVoteHash, writeContract: claimVoteReward, isPending: isClaimingVote } = useWriteContract()
  const { data: betHash, writeContract: placeBet, isPending: isPlacingBet } = useWriteContract()
  const { data: claimBetHash, writeContract: claimBetWinnings, isPending: isClaimingBet } = useWriteContract()
  const { data: settleHash, writeContract: settleBet, isPending: isSettling } = useWriteContract()

  // Wait for transactions
  const { isLoading: isConfirmingVote, isSuccess: isVoteConfirmed } = useWaitForTransactionReceipt({ hash: voteHash })
  const { isLoading: isConfirmingClaimVote, isSuccess: isClaimVoteConfirmed } = useWaitForTransactionReceipt({ hash: claimVoteHash })
  const { isLoading: isConfirmingBet, isSuccess: isBetConfirmed } = useWaitForTransactionReceipt({ hash: betHash })
  const { isLoading: isConfirmingClaimBet, isSuccess: isClaimBetConfirmed } = useWaitForTransactionReceipt({ hash: claimBetHash })
  const { isLoading: isConfirmingSettle, isSuccess: isSettleConfirmed } = useWaitForTransactionReceipt({ hash: settleHash })

  // Refetch data when transactions confirm
  useEffect(() => {
    if (isVoteConfirmed || isClaimVoteConfirmed || isBetConfirmed || isClaimBetConfirmed || isSettleConfirmed) {
      refetchVote()
      refetchUserBets()
      refetchSeason()
      refetchSeasonId()
    }
  }, [isVoteConfirmed, isClaimVoteConfirmed, isBetConfirmed, isClaimBetConfirmed, isSettleConfirmed])

  const season = seasonData as unknown as Season | undefined
  const userVote = userVoteData as unknown as Vote | undefined
  const hasVoted = userVote && userVote.voter !== "0x0000000000000000000000000000000000000000"
  const matchIds = (seasonMatchIds as bigint[]) || []
  const betIds = (userBetIds as bigint[]) || []

  const handleVote = () => {
    if (selectedTeam === null || !currentSeasonId) return
    voteForWinner({
      ...VirtualFootballMarketContract,
      functionName: "voteForSeasonWinner",
      args: [Number(currentSeasonId), selectedTeam],
    })
    setSelectedTeam(null)
  }

  const handleClaimVoteReward = () => {
    if (!currentSeasonId) return
    claimVoteReward({
      ...VirtualFootballMarketContract,
      functionName: "claimVotingReward",
      args: [Number(currentSeasonId)],
    })
  }

  const handlePlaceBet = () => {
    if (selectedMatch === null || betSelection === null || !betAmount) return
    const amount = parseEther(betAmount)
    placeBet({
      ...VirtualFootballMarketContract,
      functionName: "placeBet",
      args: [selectedMatch, betType, betSelection, amount],
      value: amount,
    })
    setBetAmount("")
    setBetSelection(null)
  }

  const getBetTypeName = (type: BetType): string => {
    switch (type) {
      case BetType.MATCH_WINNER:
        return "Match Winner"
      case BetType.OVER_UNDER:
        return "Over/Under 2.5"
      case BetType.BOTH_TEAMS_SCORE:
        return "Both Teams Score"
    }
  }

  const getSelectionName = (type: BetType, selection: number): string => {
    if (type === BetType.MATCH_WINNER) {
      return selection === 0 ? "Home Win" : selection === 1 ? "Away Win" : "Draw"
    } else if (type === BetType.OVER_UNDER) {
      return selection === 0 ? "Over 2.5" : "Under 2.5"
    } else {
      return selection === 0 ? "Yes" : "No"
    }
  }

  if (!isConnected) {
    return (
      <main className="relative min-h-screen pl-6 md:pl-28 pr-6 md:pr-12 py-12">
        <SideNav />
        <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />
        <AnimatedNoise opacity={0.02} />
        <div className="relative z-10 max-w-7xl mx-auto text-center">
          <h1 className="font-[var(--font-bebas)] text-[clamp(2rem,5vw,4rem)] text-foreground mt-12">
            Connect Your Wallet
          </h1>
          <p className="font-mono text-sm text-muted-foreground mt-4">
            Please connect your wallet to access the Virtual Football prediction market
          </p>
        </div>
      </main>
    )
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
            VF Prediction Market
          </h1>
          <p className="font-mono text-sm text-muted-foreground mt-2">
            Vote for season winner (FREE), bet on matches, or follow tipsters
          </p>
        </div>

        {/* Season Info Bar */}
        {season && currentSeasonId && Number(currentSeasonId) > 0 && (
          <Card className="p-4 mb-8 border-border/30 bg-card/50 backdrop-blur-sm">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <div className="font-mono text-xs text-muted-foreground mb-1">Season</div>
                <div className="font-mono text-lg text-accent">#{currentSeasonId.toString()}</div>
              </div>
              <div>
                <div className="font-mono text-xs text-muted-foreground mb-1">Status</div>
                <div className={`font-mono text-sm uppercase ${
                  season.status === SeasonStatus.UPCOMING ? "text-yellow-500" :
                  season.status === SeasonStatus.ACTIVE ? "text-accent" : "text-muted-foreground"
                }`}>
                  {season.status === SeasonStatus.UPCOMING ? "UPCOMING" :
                   season.status === SeasonStatus.ACTIVE ? "ACTIVE" : "COMPLETED"}
                </div>
              </div>
              <div>
                <div className="font-mono text-xs text-muted-foreground mb-1">Betting Volume</div>
                <div className="font-mono text-lg text-accent">
                  {seasonVolume ? parseFloat(formatEther(seasonVolume as bigint)).toFixed(4) : "0.0000"} BNB
                </div>
              </div>
              <div>
                <div className="font-mono text-xs text-muted-foreground mb-1">Your Bets</div>
                <div className="font-mono text-lg text-accent">{betIds.length}</div>
              </div>
            </div>
          </Card>
        )}

        {/* Tabs */}
        <div className="mb-8 flex gap-4 border-b border-border overflow-x-auto">
          <button
            onClick={() => setActiveTab("voting")}
            className={`pb-4 px-4 font-mono text-xs uppercase tracking-widest transition-colors whitespace-nowrap ${
              activeTab === "voting"
                ? "text-accent border-b-2 border-accent"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Season Voting (FREE)
          </button>
          <button
            onClick={() => setActiveTab("betting")}
            className={`pb-4 px-4 font-mono text-xs uppercase tracking-widest transition-colors whitespace-nowrap ${
              activeTab === "betting"
                ? "text-accent border-b-2 border-accent"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Match Betting
          </button>
          <button
            onClick={() => setActiveTab("tipster")}
            className={`pb-4 px-4 font-mono text-xs uppercase tracking-widest transition-colors whitespace-nowrap ${
              activeTab === "tipster"
                ? "text-accent border-b-2 border-accent"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Tipsters
          </button>
          <button
            onClick={() => setActiveTab("mybets")}
            className={`pb-4 px-4 font-mono text-xs uppercase tracking-widest transition-colors whitespace-nowrap ${
              activeTab === "mybets"
                ? "text-accent border-b-2 border-accent"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            My Bets
          </button>
        </div>

        {/* Season Voting Tab */}
        {activeTab === "voting" && (
          <div className="space-y-6">
            <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
              <h2 className="font-mono text-lg font-medium text-foreground mb-4">
                Vote for Season Winner
              </h2>
              <div className="font-mono text-sm text-muted-foreground mb-6">
                {season?.status === SeasonStatus.UPCOMING
                  ? "Vote for FREE before the season starts! Win rewards if your prediction is correct. Early voters get 20% bonus."
                  : season?.status === SeasonStatus.ACTIVE
                    ? "Voting is closed. The season is active."
                    : "Season completed. Check if you won rewards!"}
              </div>

              {hasVoted ? (
                <div className="space-y-4">
                  <div className="border border-accent bg-accent/10 p-6">
                    <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
                      Your Prediction
                    </div>
                    <div className="font-[var(--font-bebas)] text-3xl text-accent mb-2">
                      {TEAM_NAMES[userVote.predictedWinner]}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {userVote.isEarlyVoter && "🎁 Early voter bonus eligible! "}
                      Voted on {new Date(Number(userVote.votedAt) * 1000).toLocaleString()}
                    </div>
                  </div>

                  {season?.status === SeasonStatus.COMPLETED && !userVote.claimed && (
                    <Button
                      onClick={handleClaimVoteReward}
                      disabled={isClaimingVote || isConfirmingClaimVote}
                      className="w-full font-mono text-xs uppercase tracking-widest"
                    >
                      <ScrambleTextOnHover
                        text={isClaimingVote || isConfirmingClaimVote ? "Claiming..." : "Claim Rewards"}
                        duration={0.3}
                      />
                    </Button>
                  )}

                  {userVote.claimed && (
                    <div className="text-center font-mono text-sm text-accent">
                      ✓ Rewards claimed
                    </div>
                  )}
                </div>
              ) : season?.status === SeasonStatus.UPCOMING ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {TEAM_NAMES.map((team, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedTeam(index)}
                        className={`border p-4 text-left transition-all duration-200 ${
                          selectedTeam === index
                            ? "border-accent bg-accent/10"
                            : "border-border hover:border-foreground/40"
                        }`}
                      >
                        <div className="font-mono text-sm text-foreground">{team}</div>
                      </button>
                    ))}
                  </div>

                  {selectedTeam !== null && (
                    <Button
                      onClick={handleVote}
                      disabled={isVoting || isConfirmingVote}
                      className="w-full font-mono text-xs uppercase tracking-widest"
                    >
                      <ScrambleTextOnHover
                        text={isVoting || isConfirmingVote ? "Voting..." : `Vote for ${TEAM_NAMES[selectedTeam]}`}
                        duration={0.3}
                      />
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 font-mono text-sm text-muted-foreground">
                  Voting is closed for this season
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Match Betting Tab */}
        {activeTab === "betting" && (
          <div className="space-y-6">
            <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
              <h2 className="font-mono text-lg font-medium text-foreground mb-4">
                Place Bets on Matches
              </h2>
              <div className="font-mono text-sm text-muted-foreground mb-6">
                Choose a match and bet type. 5% platform fee applies.
              </div>

              {/* Bet Type Selector */}
              <div className="mb-6">
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">
                  Bet Type
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[BetType.MATCH_WINNER, BetType.OVER_UNDER, BetType.BOTH_TEAMS_SCORE].map((type) => (
                    <button
                      key={type}
                      onClick={() => setBetType(type)}
                      className={`border p-3 transition-all duration-200 ${
                        betType === type
                          ? "border-accent bg-accent/10"
                          : "border-border hover:border-foreground/40"
                      }`}
                    >
                      <div className="font-mono text-sm text-foreground">{getBetTypeName(type)}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Match List */}
              <div className="space-y-4">
                {matchIds.length > 0 ? (
                  matchIds.map((matchId) => (
                    <BettingMatchCard
                      key={matchId.toString()}
                      matchId={matchId}
                      isSelected={selectedMatch === matchId}
                      onSelect={() => setSelectedMatch(matchId)}
                      betType={betType}
                      betSelection={betSelection}
                      setBetSelection={setBetSelection}
                      betAmount={betAmount}
                      setBetAmount={setBetAmount}
                      onPlaceBet={handlePlaceBet}
                      isPlacingBet={isPlacingBet || isConfirmingBet}
                    />
                  ))
                ) : (
                  <div className="text-center py-8 font-mono text-sm text-muted-foreground">
                    No matches available for betting
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Tipster Tab */}
        {activeTab === "tipster" && (
          <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
            <h2 className="font-mono text-lg font-medium text-foreground mb-4">Tipster System</h2>
            <div className="text-center py-16 font-mono text-sm text-muted-foreground">
              Tipster functionality coming soon! Register as a tipster, follow expert bettors, and copy their bets automatically.
            </div>
          </Card>
        )}

        {/* My Bets Tab */}
        {activeTab === "mybets" && (
          <div className="space-y-6">
            {betIds.length > 0 ? (
              betIds.map((betId) => (
                <UserBetCard key={betId.toString()} betId={betId} />
              ))
            ) : (
              <Card className="p-8 border-border/30 bg-card/50 backdrop-blur-sm text-center">
                <div className="font-mono text-sm text-muted-foreground">
                  You haven't placed any bets yet
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

// Betting Match Card Component
function BettingMatchCard({
  matchId,
  isSelected,
  onSelect,
  betType,
  betSelection,
  setBetSelection,
  betAmount,
  setBetAmount,
  onPlaceBet,
  isPlacingBet,
}: {
  matchId: bigint
  isSelected: boolean
  onSelect: () => void
  betType: BetType
  betSelection: number | null
  setBetSelection: (selection: number | null) => void
  betAmount: string
  setBetAmount: (amount: string) => void
  onPlaceBet: () => void
  isPlacingBet: boolean
}) {
  const { data: matchData } = useReadContract({
    ...VirtualFootballGameContract,
    functionName: "getMatch",
    args: [matchId],
  })

  const { data: homeTeamName } = useReadContract({
    ...VirtualFootballGameContract,
    functionName: "getTeamName",
    args: matchData ? [(matchData as any)[2]] : undefined,
    query: { enabled: !!matchData },
  })

  const { data: awayTeamName } = useReadContract({
    ...VirtualFootballGameContract,
    functionName: "getTeamName",
    args: matchData ? [(matchData as any)[3]] : undefined,
    query: { enabled: !!matchData },
  })

  const match = matchData as unknown as Match | undefined
  if (!match) return null

  const now = Math.floor(Date.now() / 1000)
  const canBet = !match.isFinalized && Number(match.kickoffTime) > now

  const getSelectionOptions = () => {
    if (betType === BetType.MATCH_WINNER) {
      return [
        { value: 0, label: `${homeTeamName} Win` },
        { value: 1, label: `${awayTeamName} Win` },
        { value: 2, label: "Draw" },
      ]
    } else if (betType === BetType.OVER_UNDER) {
      return [
        { value: 0, label: "Over 2.5 Goals" },
        { value: 1, label: "Under 2.5 Goals" },
      ]
    } else {
      return [
        { value: 0, label: "Yes" },
        { value: 1, label: "No" },
      ]
    }
  }

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left border p-6 transition-all duration-200 ${
        isSelected ? "border-accent bg-accent/10" : "border-border hover:border-foreground/40"
      } ${!canBet ? "opacity-50" : ""}`}
      disabled={!canBet}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="font-mono text-xs text-muted-foreground">Match #{matchId.toString()}</div>
        {!canBet && (
          <div className="font-mono text-xs uppercase px-3 py-1 border border-muted-foreground text-muted-foreground">
            CLOSED
          </div>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center mb-4">
        <div className="text-right font-mono text-lg text-foreground">{homeTeamName as string}</div>
        <div className="text-center font-mono text-2xl text-muted-foreground">VS</div>
        <div className="text-left font-mono text-lg text-foreground">{awayTeamName as string}</div>
      </div>

      {isSelected && canBet && (
        <div className="mt-6 space-y-4 border-t border-border/30 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {getSelectionOptions().map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setBetSelection(option.value)
                }}
                className={`border p-3 transition-all duration-200 ${
                  betSelection === option.value
                    ? "border-accent bg-accent/20"
                    : "border-border hover:border-foreground/40"
                }`}
              >
                <div className="font-mono text-sm text-foreground">{option.label}</div>
              </button>
            ))}
          </div>

          {betSelection !== null && (
            <div className="space-y-3">
              <div>
                <label className="font-mono text-xs text-muted-foreground mb-2 block">Bet Amount (BNB)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.1"
                  value={betAmount}
                  onChange={(e) => {
                    e.stopPropagation()
                    setBetAmount(e.target.value)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full bg-background border border-border px-4 py-3 font-mono text-sm text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onPlaceBet()
                }}
                disabled={!betAmount || isPlacingBet}
                className="w-full border border-accent bg-accent/10 px-6 py-3 font-mono text-xs uppercase tracking-widest text-accent hover:bg-accent hover:text-background transition-all duration-200 disabled:opacity-50"
              >
                <ScrambleTextOnHover text={isPlacingBet ? "Placing..." : "Place Bet"} duration={0.3} />
              </button>
            </div>
          )}
        </div>
      )}
    </button>
  )
}

// User Bet Card Component
function UserBetCard({ betId }: { betId: bigint }) {
  const { data: betData } = useReadContract({
    ...VirtualFootballMarketContract,
    functionName: "bets",
    args: [betId],
  })

  const { writeContract: settleBet, isPending: isSettling } = useWriteContract()
  const { writeContract: claimBet, isPending: isClaiming } = useWriteContract()

  const bet = betData as unknown as SingleBet | undefined
  if (!bet) return null

  const handleSettle = () => {
    settleBet({
      ...VirtualFootballMarketContract,
      functionName: "settleBet",
      args: [betId],
    })
  }

  const handleClaim = () => {
    claimBet({
      ...VirtualFootballMarketContract,
      functionName: "claimWinnings",
      args: [betId],
    })
  }

  const getBetTypeName = (type: BetType): string => {
    switch (type) {
      case BetType.MATCH_WINNER:
        return "Match Winner"
      case BetType.OVER_UNDER:
        return "Over/Under 2.5"
      case BetType.BOTH_TEAMS_SCORE:
        return "Both Teams Score"
    }
  }

  const getSelectionName = (type: BetType, selection: number): string => {
    if (type === BetType.MATCH_WINNER) {
      return selection === 0 ? "Home Win" : selection === 1 ? "Away Win" : "Draw"
    } else if (type === BetType.OVER_UNDER) {
      return selection === 0 ? "Over 2.5" : "Under 2.5"
    } else {
      return selection === 0 ? "Yes" : "No"
    }
  }

  return (
    <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="font-mono text-xs text-muted-foreground">Bet #{betId.toString()}</div>
        <div
          className={`font-mono text-xs uppercase px-3 py-1 border ${
            bet.isClaimed
              ? "border-muted-foreground text-muted-foreground"
              : bet.isSettled
                ? bet.isWon
                  ? "border-accent text-accent bg-accent/10"
                  : "border-red-500 text-red-500 bg-red-500/10"
                : "border-yellow-500 text-yellow-500 bg-yellow-500/10"
          }`}
        >
          {bet.isClaimed ? "CLAIMED" : bet.isSettled ? (bet.isWon ? "WON" : "LOST") : "PENDING"}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="font-mono text-xs text-muted-foreground mb-1">Bet Type</div>
          <div className="font-mono text-sm text-foreground">{getBetTypeName(bet.betType)}</div>
        </div>
        <div>
          <div className="font-mono text-xs text-muted-foreground mb-1">Selection</div>
          <div className="font-mono text-sm text-foreground">{getSelectionName(bet.betType, bet.selection)}</div>
        </div>
        <div>
          <div className="font-mono text-xs text-muted-foreground mb-1">Amount</div>
          <div className="font-mono text-sm text-accent">{formatEther(bet.amount)} BNB</div>
        </div>
        <div>
          <div className="font-mono text-xs text-muted-foreground mb-1">Odds</div>
          <div className="font-mono text-sm text-foreground">{(bet.odds / 100).toFixed(2)}x</div>
        </div>
      </div>

      {!bet.isSettled && (
        <Button
          onClick={handleSettle}
          disabled={isSettling}
          variant="outline"
          className="w-full font-mono text-xs uppercase tracking-widest"
        >
          <ScrambleTextOnHover text={isSettling ? "Settling..." : "Settle Bet"} duration={0.3} />
        </Button>
      )}

      {bet.isSettled && bet.isWon && !bet.isClaimed && (
        <Button
          onClick={handleClaim}
          disabled={isClaiming}
          className="w-full font-mono text-xs uppercase tracking-widest"
        >
          <ScrambleTextOnHover
            text={isClaiming ? "Claiming..." : `Claim ${formatEther(BigInt(bet.amount) * BigInt(bet.odds) / 100n)} BNB`}
            duration={0.3}
          />
        </Button>
      )}
    </Card>
  )
}
