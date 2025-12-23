"use client"

import { useState, useEffect } from "react"
import { useAccount, useConnect, useDisconnect } from "wagmi"
import { type Address, type Hex, zeroAddress } from "viem"
import { ScrambleTextOnHover } from "@/components/scramble-text"
import { AnimatedNoise } from "@/components/animated-noise"
import { BitmapChevron } from "@/components/bitmap-chevron"
import Link from "next/link"
import {
  useGetMarket,
  useGetUserBets,
  usePlaceBet,
  useClaimWinnings,
  useResolveMarket,
  useMarketCounter,
  formatBNB,
  calculateOddsDisplay,
  type Market,
  type Bet,
} from "@/lib/hooks/usePredictionMarket"
import { injected } from "wagmi/connectors"

enum MarketStatus {
  LIVE = "live",
  CLOSED = "closed",
  RESOLVED = "resolved",
}

export default function PredictionMarketPage() {
  const [activeTab, setActiveTab] = useState<"live" | "finished">("live")
  const [selectedMarketId, setSelectedMarketId] = useState<bigint | undefined>(undefined)
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null)
  const [betAmount, setBetAmount] = useState("")
  const [selectedOutcome, setSelectedOutcome] = useState<Address | null>(null)
  const [marketIds, setMarketIds] = useState<bigint[]>([])

  // Wagmi hooks
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()

  // Contract hooks
  const { data: marketData, refetch: refetchMarket } = useGetMarket(selectedMarketId)
  const { data: userBetsData, refetch: refetchUserBets } = useGetUserBets(selectedMarketId, address)
  const { data: marketCounter } = useMarketCounter()

  const {
    placeBet,
    isPending: isPlacingBet,
    isConfirming: isConfirmingBet,
    isConfirmed: isBetConfirmed,
    error: placeBetError,
  } = usePlaceBet()

  const {
    claimWinnings,
    isPending: isClaiming,
    isConfirming: isConfirmingClaim,
    isConfirmed: isClaimConfirmed,
    error: claimError,
  } = useClaimWinnings()

  const {
    resolveMarket: resolveMarketTx,
    isPending: isResolving,
    isConfirming: isConfirmingResolve,
    isConfirmed: isResolveConfirmed,
    error: resolveError,
  } = useResolveMarket()

  // Parse market data
  const parseMarket = (data: any): Market | null => {
    if (!data) return null
    return {
      matchId: data[0] as Hex,
      gameId: data[1] as Hex,
      player1: data[2] as Address,
      player2: data[3] as Address,
      totalPool: data[4] as bigint,
      player1Pool: data[5] as bigint,
      player2Pool: data[6] as bigint,
      tiePool: data[7] as bigint,
      bettingDeadline: data[8] as bigint,
      isResolved: data[9] as boolean,
      winner: data[10] as Address,
      resolvedAt: data[11] as bigint,
    }
  }

  // Parse user bets
  const parseUserBets = (data: any): Bet[] => {
    if (!data || !Array.isArray(data)) return []
    return data.map((bet: any) => ({
      bettor: bet[0] as Address,
      predictedWinner: bet[1] as Address,
      amount: bet[2] as bigint,
      claimed: bet[3] as boolean,
    }))
  }

  const market = parseMarket(marketData)
  const userBets = parseUserBets(userBetsData)

  // Generate market IDs from counter
  useEffect(() => {
    if (marketCounter !== undefined) {
      const count = Number(marketCounter)
      const ids: bigint[] = []
      for (let i = 0; i < count; i++) {
        ids.push(BigInt(i))
      }
      setMarketIds(ids)

      // Auto-select first market if none selected
      if (selectedMarketId === undefined && ids.length > 0) {
        setSelectedMarketId(ids[0])
      }
    }
  }, [marketCounter, selectedMarketId])

  // Refetch data when transactions are confirmed
  useEffect(() => {
    if (isBetConfirmed || isClaimConfirmed || isResolveConfirmed) {
      refetchMarket()
      refetchUserBets()
    }
  }, [isBetConfirmed, isClaimConfirmed, isResolveConfirmed, refetchMarket, refetchUserBets])

  // Update selected market when market data changes
  useEffect(() => {
    if (market) {
      setSelectedMarket(market)
    }
  }, [market])

  const handleConnectWallet = () => {
    connect({ connector: injected() })
  }

  const handleDisconnectWallet = () => {
    disconnect()
  }

  const handlePlaceBet = () => {
    if (!selectedMarket || !selectedOutcome || !betAmount || selectedMarketId === undefined) return

    placeBet(selectedMarketId, selectedOutcome, betAmount)

    setTimeout(() => {
      setBetAmount("")
      setSelectedOutcome(null)
    }, 500)
  }

  const handleClaimWinnings = () => {
    if (selectedMarketId !== undefined) {
      claimWinnings(selectedMarketId)
    }
  }

  const handleResolveMarket = () => {
    if (selectedMarketId !== undefined) {
      resolveMarketTx(selectedMarketId)
    }
  }

  const getMarketStatus = (market: Market | null): MarketStatus => {
    if (!market) return MarketStatus.LIVE

    if (market.isResolved) return MarketStatus.RESOLVED

    const now = BigInt(Math.floor(Date.now() / 1000))
    if (now >= market.bettingDeadline) return MarketStatus.CLOSED

    return MarketStatus.LIVE
  }

  const getTimeRemaining = (deadline: bigint): string => {
    const now = Math.floor(Date.now() / 1000)
    const diff = Number(deadline) - now

    if (diff <= 0) return "Closed"

    const hours = Math.floor(diff / 3600)
    const minutes = Math.floor((diff % 3600) / 60)

    if (hours > 24) {
      const days = Math.floor(hours / 24)
      return `${days}d ${hours % 24}h`
    }
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const calculatePotentialWinnings = (): string => {
    if (!market || !betAmount || !selectedOutcome) return "0.0000"

    let pool = 0n
    if (selectedOutcome === market.player1) pool = market.player1Pool
    else if (selectedOutcome === market.player2) pool = market.player2Pool
    else pool = market.tiePool

    if (pool === 0n) return "0.0000"

    const amount = BigInt(Math.floor(parseFloat(betAmount) * 1e18))
    const totalPool = market.totalPool + amount
    const winningPool = pool + amount
    const platformFee = (totalPool * 200n) / 10000n
    const payoutPool = totalPool - platformFee

    const winnings = (amount * payoutPool) / winningPool
    return formatBNB(winnings)
  }

  const hasWinningBets = (): boolean => {
    if (!market || userBets.length === 0) return false
    return userBets.some((bet) => !bet.claimed && bet.predictedWinner === market.winner)
  }

  const getTotalStaked = (): string => {
    const total = userBets.reduce((sum, bet) => sum + bet.amount, 0n)
    return formatBNB(total)
  }

  const getOutcomeName = (address: Address, market: Market): string => {
    if (address === zeroAddress) return "Tie"
    if (address === market.player1) return "Player 1"
    if (address === market.player2) return "Player 2"
    return "Unknown"
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
              Prediction Market
            </h1>
            <p className="font-mono text-sm text-muted-foreground mt-2">
              Bet on RPS matches and earn from correct predictions
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

        {/* Stats Bar */}
        {isConnected && (
          <div className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="border border-border bg-background/50 p-4">
              <div className="font-mono text-xs text-muted-foreground mb-1">Total Markets</div>
              <div className="font-mono text-2xl text-accent">{marketCounter?.toString() || "0"}</div>
            </div>
            <div className="border border-border bg-background/50 p-4">
              <div className="font-mono text-xs text-muted-foreground mb-1">Active Bets</div>
              <div className="font-mono text-2xl text-accent">{userBets.length}</div>
            </div>
            <div className="border border-border bg-background/50 p-4">
              <div className="font-mono text-xs text-muted-foreground mb-1">Total Staked</div>
              <div className="font-mono text-2xl text-accent">{getTotalStaked()} BNB</div>
            </div>
            <div className="border border-border bg-background/50 p-4">
              <div className="font-mono text-xs text-muted-foreground mb-1">Claimable</div>
              <div className="font-mono text-2xl text-accent">
                {hasWinningBets() ? "✓ Yes" : "—"}
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-8 flex gap-4 border-b border-border">
          <button
            onClick={() => setActiveTab("live")}
            className={`pb-4 px-4 font-mono text-xs uppercase tracking-widest transition-colors ${
              activeTab === "live"
                ? "text-accent border-b-2 border-accent"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Live Markets
          </button>
          <button
            onClick={() => setActiveTab("finished")}
            className={`pb-4 px-4 font-mono text-xs uppercase tracking-widest transition-colors ${
              activeTab === "finished"
                ? "text-accent border-b-2 border-accent"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Finished Markets
          </button>
        </div>

        {/* Error Messages */}
        {(placeBetError || claimError || resolveError) && (
          <div className="mb-8 p-4 border border-red-500/50 bg-red-500/10">
            <p className="font-mono text-xs text-red-500">
              Error: {placeBetError?.message || claimError?.message || resolveError?.message}
            </p>
          </div>
        )}

        {/* Success Messages */}
        {(isBetConfirmed || isClaimConfirmed || isResolveConfirmed) && (
          <div className="mb-8 p-4 border border-accent bg-accent/10">
            <p className="font-mono text-xs text-accent">
              {isBetConfirmed && "✓ Bet placed successfully!"}
              {isClaimConfirmed && "✓ Winnings claimed successfully!"}
              {isResolveConfirmed && "✓ Market resolved successfully!"}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Markets List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="font-mono text-xs uppercase tracking-widest text-foreground flex items-center gap-2">
              <span className="w-2 h-2 bg-accent" />
              {activeTab === "live" ? "Live Markets" : "Finished Markets"}
            </h2>

            {marketCounter === undefined || marketCounter === 0n ? (
              <div className="border border-border bg-background/50 p-8 text-center">
                <p className="font-mono text-sm text-muted-foreground">No markets available</p>
              </div>
            ) : (
              <div className="space-y-4">
                {marketIds
                  .filter((id) => {
                    // This is a simplified filter - in production you'd fetch each market
                    // For now, show all in live tab
                    return activeTab === "live"
                  })
                  .map((marketId) => (
                    <MarketCard
                      key={marketId.toString()}
                      marketId={marketId}
                      isSelected={selectedMarketId === marketId}
                      onSelect={() => setSelectedMarketId(marketId)}
                    />
                  ))}
              </div>
            )}
          </div>

          {/* Betting Panel */}
          <div>
            <h2 className="font-mono text-xs uppercase tracking-widest text-foreground mb-6 flex items-center gap-2">
              <span className="w-2 h-2 bg-accent" />
              {market ? "Place Bet" : "Select Market"}
            </h2>

            {!market ? (
              <div className="border border-border bg-background/50 p-6 text-center">
                <p className="font-mono text-xs text-muted-foreground">Select a market to view details and place bets</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Market Status */}
                <div className="border border-border bg-background/50 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-xs text-muted-foreground">Status</span>
                    <span
                      className={`font-mono text-xs uppercase px-3 py-1 border ${
                        getMarketStatus(market) === MarketStatus.LIVE
                          ? "border-accent text-accent bg-accent/10"
                          : getMarketStatus(market) === MarketStatus.CLOSED
                            ? "border-yellow-500 text-yellow-500 bg-yellow-500/10"
                            : "border-muted-foreground text-muted-foreground bg-background"
                      }`}
                    >
                      {getMarketStatus(market)}
                    </span>
                  </div>

                  {!market.isResolved && (
                    <div className="mb-4">
                      <div className="font-mono text-xs text-muted-foreground mb-2">
                        {getMarketStatus(market) === MarketStatus.LIVE ? "Closes in" : "Betting closed"}
                      </div>
                      <div className="font-mono text-2xl text-accent">{getTimeRemaining(market.bettingDeadline)}</div>
                    </div>
                  )}

                  <div className="space-y-2 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Pool</span>
                      <span className="text-foreground">{formatBNB(market.totalPool)} BNB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Match ID</span>
                      <span className="text-foreground">{market.matchId.slice(0, 10)}...</span>
                    </div>
                  </div>
                </div>

                {/* Betting Options */}
                {getMarketStatus(market) === MarketStatus.LIVE && isConnected && (
                  <div className="border border-border bg-background/50 p-6">
                    <div className="font-mono text-xs text-muted-foreground mb-4">Select Outcome</div>

                    <div className="space-y-3 mb-6">
                      {/* Player 1 */}
                      <button
                        onClick={() => setSelectedOutcome(market.player1)}
                        className={`w-full border p-4 text-left transition-all duration-200 ${
                          selectedOutcome === market.player1
                            ? "border-accent bg-accent/10"
                            : "border-border hover:border-foreground/40"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-xs text-foreground">Player 1</span>
                          <span className="font-mono text-sm text-accent font-medium">
                            {calculateOddsDisplay(market.totalPool, market.player1Pool)}
                          </span>
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {market.player1.slice(0, 10)}...
                        </div>
                        <div className="font-mono text-xs text-muted-foreground mt-1">
                          Pool: {formatBNB(market.player1Pool)} BNB
                        </div>
                      </button>

                      {/* Player 2 */}
                      <button
                        onClick={() => setSelectedOutcome(market.player2)}
                        className={`w-full border p-4 text-left transition-all duration-200 ${
                          selectedOutcome === market.player2
                            ? "border-accent bg-accent/10"
                            : "border-border hover:border-foreground/40"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-xs text-foreground">Player 2</span>
                          <span className="font-mono text-sm text-accent font-medium">
                            {calculateOddsDisplay(market.totalPool, market.player2Pool)}
                          </span>
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {market.player2.slice(0, 10)}...
                        </div>
                        <div className="font-mono text-xs text-muted-foreground mt-1">
                          Pool: {formatBNB(market.player2Pool)} BNB
                        </div>
                      </button>

                      {/* Tie */}
                      <button
                        onClick={() => setSelectedOutcome(zeroAddress)}
                        className={`w-full border p-4 text-left transition-all duration-200 ${
                          selectedOutcome === zeroAddress
                            ? "border-accent bg-accent/10"
                            : "border-border hover:border-foreground/40"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-xs text-foreground">Tie</span>
                          <span className="font-mono text-sm text-accent font-medium">
                            {calculateOddsDisplay(market.totalPool, market.tiePool)}
                          </span>
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">Draw</div>
                        <div className="font-mono text-xs text-muted-foreground mt-1">
                          Pool: {formatBNB(market.tiePool)} BNB
                        </div>
                      </button>
                    </div>

                    {selectedOutcome !== null && (
                      <div className="space-y-4">
                        <div>
                          <label className="font-mono text-xs text-muted-foreground mb-2 block">
                            Bet Amount (BNB)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.1"
                            value={betAmount}
                            onChange={(e) => setBetAmount(e.target.value)}
                            className="w-full bg-background border border-border px-4 py-3 font-mono text-sm text-foreground focus:outline-none focus:border-accent"
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              type="button"
                              onClick={() => setBetAmount("0.01")}
                              className="px-3 py-1 border border-border font-mono text-xs hover:border-accent hover:text-accent transition-colors"
                            >
                              0.01
                            </button>
                            <button
                              type="button"
                              onClick={() => setBetAmount("0.1")}
                              className="px-3 py-1 border border-border font-mono text-xs hover:border-accent hover:text-accent transition-colors"
                            >
                              0.1
                            </button>
                            <button
                              type="button"
                              onClick={() => setBetAmount("0.5")}
                              className="px-3 py-1 border border-border font-mono text-xs hover:border-accent hover:text-accent transition-colors"
                            >
                              0.5
                            </button>
                            <button
                              type="button"
                              onClick={() => setBetAmount("1")}
                              className="px-3 py-1 border border-border font-mono text-xs hover:border-accent hover:text-accent transition-colors"
                            >
                              1.0
                            </button>
                          </div>
                        </div>

                        {betAmount && (
                          <div className="p-4 border border-accent bg-accent/5">
                            <div className="font-mono text-xs text-muted-foreground mb-1">Potential Return</div>
                            <div className="font-mono text-xl text-accent">{calculatePotentialWinnings()} BNB</div>
                            <div className="font-mono text-xs text-muted-foreground mt-1">
                              {((parseFloat(calculatePotentialWinnings()) / parseFloat(betAmount) - 1) * 100).toFixed(1)}% profit
                            </div>
                          </div>
                        )}

                        <button
                          onClick={handlePlaceBet}
                          disabled={!betAmount || isPlacingBet || isConfirmingBet}
                          className="w-full group inline-flex items-center justify-center gap-2 border border-accent bg-accent/10 px-6 py-3 font-mono text-xs uppercase tracking-widest text-accent hover:bg-accent hover:text-background transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ScrambleTextOnHover
                            text={
                              isPlacingBet ? "Confirming..." : isConfirmingBet ? "Processing..." : "Place Bet"
                            }
                            as="span"
                            duration={0.5}
                          />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Resolve Button */}
                {getMarketStatus(market) === MarketStatus.CLOSED && (
                  <button
                    onClick={handleResolveMarket}
                    disabled={isResolving || isConfirmingResolve}
                    className="w-full group inline-flex items-center justify-center gap-2 border border-yellow-500 bg-yellow-500/10 px-6 py-3 font-mono text-xs uppercase tracking-widest text-yellow-500 hover:bg-yellow-500 hover:text-background transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ScrambleTextOnHover
                      text={
                        isResolving ? "Confirming..." : isConfirmingResolve ? "Processing..." : "Resolve Market"
                      }
                      as="span"
                      duration={0.5}
                    />
                  </button>
                )}

                {/* Resolved Market */}
                {getMarketStatus(market) === MarketStatus.RESOLVED && (
                  <div className="border border-border bg-background/50 p-6">
                    <div className="font-mono text-xs text-muted-foreground mb-2">Winner</div>
                    <div className="font-mono text-xl text-accent mb-4">
                      {market.winner === zeroAddress ? "🤝 Tie" : `🏆 ${getOutcomeName(market.winner, market)}`}
                    </div>

                    {hasWinningBets() && (
                      <button
                        onClick={handleClaimWinnings}
                        disabled={isClaiming || isConfirmingClaim}
                        className="w-full group inline-flex items-center justify-center gap-2 border border-accent bg-accent/10 px-6 py-3 font-mono text-xs uppercase tracking-widest text-accent hover:bg-accent hover:text-background transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ScrambleTextOnHover
                          text={
                            isClaiming
                              ? "Confirming..."
                              : isConfirmingClaim
                                ? "Processing..."
                                : "Claim Winnings"
                          }
                          as="span"
                          duration={0.5}
                        />
                      </button>
                    )}
                  </div>
                )}

                {/* Your Bets */}
                {userBets.length > 0 && (
                  <div className="border border-border bg-background/50 p-6">
                    <div className="font-mono text-xs text-muted-foreground mb-4">Your Bets on This Market</div>
                    <div className="space-y-3">
                      {userBets.map((bet, i) => (
                        <div key={i} className="border border-border p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-xs text-foreground">
                              {getOutcomeName(bet.predictedWinner, market)}
                            </span>
                            <span className="font-mono text-xs text-accent">{formatBNB(bet.amount)} BNB</span>
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {bet.claimed ? "✓ Claimed" : market.isResolved ? "Ready to claim" : "Pending"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

// Market Card Component
function MarketCard({
  marketId,
  isSelected,
  onSelect,
}: {
  marketId: bigint
  isSelected: boolean
  onSelect: () => void
}) {
  const { data: marketData } = useGetMarket(marketId)

  const parseMarket = (data: any): Market | null => {
    if (!data) return null
    return {
      matchId: data[0] as Hex,
      gameId: data[1] as Hex,
      player1: data[2] as Address,
      player2: data[3] as Address,
      totalPool: data[4] as bigint,
      player1Pool: data[5] as bigint,
      player2Pool: data[6] as bigint,
      tiePool: data[7] as bigint,
      bettingDeadline: data[8] as bigint,
      isResolved: data[9] as boolean,
      winner: data[10] as Address,
      resolvedAt: data[11] as bigint,
    }
  }

  const market = parseMarket(marketData)

  if (!market) {
    return (
      <div className="border border-border bg-background/50 p-6 animate-pulse">
        <div className="h-4 bg-border rounded mb-4 w-1/2"></div>
        <div className="h-3 bg-border rounded mb-2"></div>
        <div className="h-3 bg-border rounded w-2/3"></div>
      </div>
    )
  }

  const getMarketStatus = (): string => {
    if (market.isResolved) return "RESOLVED"
    const now = BigInt(Math.floor(Date.now() / 1000))
    if (now >= market.bettingDeadline) return "CLOSED"
    return "LIVE"
  }

  const getTimeRemaining = (): string => {
    const now = Math.floor(Date.now() / 1000)
    const diff = Number(market.bettingDeadline) - now

    if (diff <= 0) return "Closed"

    const hours = Math.floor(diff / 3600)
    const minutes = Math.floor((diff % 3600) / 60)

    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const status = getMarketStatus()

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left border p-6 transition-all duration-200 ${
        isSelected
          ? "border-accent bg-accent/10"
          : "border-border bg-background/50 hover:border-foreground/40"
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="font-mono text-xs text-muted-foreground">Market #{marketId.toString()}</span>
        <span
          className={`font-mono text-xs uppercase px-3 py-1 border ${
            status === "LIVE"
              ? "border-accent text-accent bg-accent/10"
              : status === "CLOSED"
                ? "border-yellow-500 text-yellow-500 bg-yellow-500/10"
                : "border-muted-foreground text-muted-foreground bg-background"
          }`}
        >
          {status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="font-mono text-xs text-muted-foreground mb-1">Player 1</div>
          <div className="font-mono text-xs text-foreground">{market.player1.slice(0, 10)}...</div>
        </div>
        <div>
          <div className="font-mono text-xs text-muted-foreground mb-1">Player 2</div>
          <div className="font-mono text-xs text-foreground">{market.player2.slice(0, 10)}...</div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <span className="font-mono text-xs text-muted-foreground">Pool: </span>
          <span className="font-mono text-sm text-accent">{formatBNB(market.totalPool)} BNB</span>
        </div>
        {!market.isResolved && (
          <div className="font-mono text-xs text-muted-foreground">{getTimeRemaining()}</div>
        )}
        {market.isResolved && (
          <div className="font-mono text-xs text-accent">
            Winner: {market.winner === zeroAddress ? "Tie" : market.winner.slice(0, 6)}...
          </div>
        )}
      </div>
    </button>
  )
}
