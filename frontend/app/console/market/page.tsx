"use client"

import { useEffect, useState } from "react"
import { useAccount, useReadContract, useReadContracts } from "wagmi"
import { formatEther } from "viem"
import { SideNav } from "@/components/side-nav"
import { AnimatedNoise } from "@/components/animated-noise"
import { HighlightText } from "@/components/highlight-text"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrambleTextOnHover } from "@/components/scramble-text"
import {
  FeeManagerV2Contract,
  type ConsumerBalance,
  type StreakData,
  type ReferralData,
} from "@/lib/contracts"

export default function MarketConsumerDashboard() {
  const { address, isConnected } = useAccount()
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d" | "all">("30d")

  // Fetch consumer balance
  const { data: balanceData } = useReadContract({
    ...FeeManagerV2Contract,
    functionName: "consumerBalances",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  })

  // Fetch streak data
  const { data: streakDataRaw } = useReadContract({
    ...FeeManagerV2Contract,
    functionName: "streakData",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  })

  // Fetch referral data
  const { data: referralDataRaw } = useReadContract({
    ...FeeManagerV2Contract,
    functionName: "referralData",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  })

  // Fetch free trial queries
  const { data: freeTrialQueries } = useReadContract({
    ...FeeManagerV2Contract,
    functionName: "lifetimeTrialQueries",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  })

  if (!isConnected) {
    return (
      <main className="relative min-h-screen pl-6 md:pl-28 pr-6 md:pr-12 py-12">
        <SideNav />
        <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />
        <AnimatedNoise opacity={0.02} />

        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="mb-12 text-center">
            <HighlightText className="font-mono text-xs uppercase tracking-widest text-accent">
              Market Consumer Dashboard
            </HighlightText>
            <h1 className="font-[var(--font-bebas)] text-[clamp(2rem,5vw,4rem)] text-foreground mt-4 leading-none">
              Connect Your Wallet
            </h1>
            <p className="font-mono text-sm text-muted-foreground mt-4">
              Please connect your wallet to view your market consumer dashboard
            </p>
          </div>
        </div>
      </main>
    )
  }

  const balance = balanceData as unknown as ConsumerBalance | undefined
  const streakData = streakDataRaw as unknown as StreakData | undefined
  const referralData = referralDataRaw as unknown as ReferralData | undefined

  const totalBalance = balance
    ? parseFloat(formatEther(balance.realBalance + balance.bonusBalance))
    : 0
  const realBalance = balance ? parseFloat(formatEther(balance?.realBalance || BigInt(0))) : 0
  const bonusBalance = balance ? parseFloat(formatEther(balance?.bonusBalance || BigInt(0))) : 0
  const totalQueries = balance?.totalQueries || 0
  const bonusTier = balance?.bonusTier || 0
  const currentStreak = streakData?.currentStreak || 0
  const longestStreak = streakData?.longestStreak || 0
  const referralCount = referralData?.referralCount || 0
  const referralEarnings = referralData
    ? parseFloat(formatEther(referralData.earningsFromRefs))
    : 0
  const freeTrialUsed = freeTrialQueries ? Number(freeTrialQueries) : 0
  const freeTrialLeft = Math.max(0, 5 - freeTrialUsed)

  // Calculate bonus tier percentage
  const bonusTierPercentage = bonusTier === 0 ? 0 : bonusTier === 1 ? 5 : bonusTier === 2 ? 10 : 15

  return (
    <main className="relative min-h-screen pl-6 md:pl-28 pr-6 md:pr-12 py-12">
      <SideNav />
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />
      <AnimatedNoise opacity={0.02} />

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <HighlightText className="font-mono text-xs uppercase tracking-widest text-accent">
            Market Consumer Dashboard
          </HighlightText>
          <h1 className="font-[var(--font-bebas)] text-[clamp(2rem,5vw,4rem)] text-foreground mt-4 leading-none">
            Your Account & Queries
          </h1>
          <p className="font-mono text-sm text-muted-foreground mt-4">
            Track your balance, query usage, and rewards from the PredictBNB oracle
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

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
              Balance
            </div>
            <div className="font-[var(--font-bebas)] text-4xl text-accent">
              {totalBalance.toFixed(4)} BNB
            </div>
            <div className="font-mono text-xs text-muted-foreground mt-2">
              {realBalance.toFixed(4)} real + {bonusBalance.toFixed(4)} bonus
            </div>
          </Card>

          <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
              Bonus Tier
            </div>
            <div className="font-[var(--font-bebas)] text-4xl text-accent">
              {bonusTier === 0 ? "None" : `Tier ${bonusTier}`}
            </div>
            <div className="font-mono text-xs text-muted-foreground mt-2">
              {bonusTierPercentage}% discount on queries
            </div>
          </Card>

          <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
              Total Queries
            </div>
            <div className="font-[var(--font-bebas)] text-4xl text-accent">
              {totalQueries.toLocaleString()}
            </div>
            <div className="font-mono text-xs text-muted-foreground mt-2">All time</div>
          </Card>

          <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
              Current Streak
            </div>
            <div className="font-[var(--font-bebas)] text-4xl text-accent">
              {currentStreak > 0 ? "🔥 " : ""}
              {currentStreak} {currentStreak === 1 ? "day" : "days"}
            </div>
            <div className="font-mono text-xs text-muted-foreground mt-2">Best: {longestStreak} days</div>
          </Card>
        </div>

        {/* Balance Details */}
        <div className="mb-12">
          <h2 className="font-mono text-lg font-medium text-foreground mb-6">Balance Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
              <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">
                Real Balance
              </div>
              <div className="font-[var(--font-bebas)] text-3xl text-foreground mb-2">
                {realBalance.toFixed(4)} BNB
              </div>
              <div className="font-mono text-xs text-muted-foreground">Deposited funds</div>
              <Button
                variant="outline"
                className="mt-4 w-full font-mono text-xs uppercase tracking-widest"
              >
                <ScrambleTextOnHover text="Deposit" duration={0.3} />
              </Button>
            </Card>

            <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
              <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">
                Bonus Balance
              </div>
              <div className="font-[var(--font-bebas)] text-3xl text-foreground mb-2">
                {bonusBalance.toFixed(4)} BNB
              </div>
              <div className="font-mono text-xs text-muted-foreground">
                From rewards & referrals
              </div>
            </Card>

            <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
              <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">
                Free Trial
              </div>
              <div className="font-[var(--font-bebas)] text-3xl text-foreground mb-2">
                {freeTrialLeft} / 5
              </div>
              <div className="font-mono text-xs text-muted-foreground">
                Queries remaining
              </div>
            </Card>
          </div>
        </div>

        {/* Rewards & Referrals */}
        <div className="mb-12">
          <h2 className="font-mono text-lg font-medium text-foreground mb-6">Rewards & Referrals</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
              <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
                Streak Rewards
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-xs text-muted-foreground">Current Streak</div>
                  <div className="font-mono text-sm text-accent font-medium">
                    {currentStreak > 0 ? "🔥 " : ""}
                    {currentStreak} {currentStreak === 1 ? "day" : "days"}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="font-mono text-xs text-muted-foreground">Longest Streak</div>
                  <div className="font-mono text-sm text-foreground">
                    {longestStreak} {longestStreak === 1 ? "day" : "days"}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="font-mono text-xs text-muted-foreground">Total Rewards</div>
                  <div className="font-mono text-sm text-accent font-medium">
                    {streakData ? parseFloat(formatEther(streakData?.totalRewards || BigInt(0))).toFixed(4) : "0.0000"} BNB
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border/30">
                <div className="font-mono text-xs text-muted-foreground">
                  Stay active daily to maintain your streak and earn rewards!
                </div>
              </div>
            </Card>

            <Card className="p-6 border-border/30 bg-card/50 backdrop-blur-sm">
              <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
                Referral Program
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-xs text-muted-foreground">Referrals Made</div>
                  <div className="font-mono text-sm text-accent font-medium">{referralCount}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="font-mono text-xs text-muted-foreground">Earnings</div>
                  <div className="font-mono text-sm text-accent font-medium">
                    {referralEarnings.toFixed(4)} BNB
                  </div>
                </div>
                {referralData?.referrer && referralData.referrer !== "0x0000000000000000000000000000000000000000" && (
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-xs text-muted-foreground">Referred By</div>
                    <div className="font-mono text-xs text-foreground">
                      {referralData.referrer.slice(0, 6)}...{referralData.referrer.slice(-4)}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-border/30">
                <Button variant="outline" className="w-full font-mono text-xs uppercase tracking-widest">
                  <ScrambleTextOnHover text="Get Referral Link" duration={0.3} />
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* Volume Bonus Tiers */}
        <div>
          <h2 className="font-mono text-lg font-medium text-foreground mb-6">Volume Bonus Tiers</h2>
          <div className="border border-border/30 overflow-hidden">
            <div className="grid grid-cols-4 gap-px bg-border/30">
              <div className="bg-background p-4">
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Tier</div>
              </div>
              <div className="bg-background p-4">
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  Required Volume
                </div>
              </div>
              <div className="bg-background p-4">
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  Discount
                </div>
              </div>
              <div className="bg-background p-4">
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  Status
                </div>
              </div>
            </div>

            {[
              { tier: 1, volume: "10 BNB", discount: "5%", threshold: 10 },
              { tier: 2, volume: "50 BNB", discount: "10%", threshold: 50 },
              { tier: 3, volume: "100 BNB", discount: "15%", threshold: 100 },
            ].map((tierInfo) => (
              <div
                key={tierInfo.tier}
                className={`grid grid-cols-4 gap-px bg-border/30 ${
                  bonusTier >= tierInfo.tier ? "bg-accent/10" : ""
                } transition-colors duration-200`}
              >
                <div className="bg-background p-4">
                  <div className="font-mono text-sm text-foreground">Tier {tierInfo.tier}</div>
                </div>
                <div className="bg-background p-4">
                  <div className="font-mono text-sm text-muted-foreground">{tierInfo.volume}</div>
                </div>
                <div className="bg-background p-4">
                  <div className="font-mono text-sm text-accent font-medium">{tierInfo.discount}</div>
                </div>
                <div className="bg-background p-4">
                  <div className="font-mono text-xs uppercase tracking-widest">
                    {bonusTier >= tierInfo.tier ? (
                      <span className="text-accent">✓ Unlocked</span>
                    ) : (
                      <span className="text-muted-foreground">Locked</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
