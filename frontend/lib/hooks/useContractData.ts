import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { formatEther, parseEther, type Address } from "viem"
import { useState, useEffect, useMemo } from "react"
import {
  GameRegistryContract,
  OracleCoreContract,
  FeeManagerV2Contract,
  type GameData,
  type DeveloperEarnings,
  type ConsumerBalance,
  CONTRACTS,
} from "@/lib/contracts"

// Check if contracts are deployed (not zero address)
const isContractDeployed = (address: Address) => {
  return address !== "0x0000000000000000000000000000000000000000"
}

export const useContractsDeployed = () => {
  return {
    gameRegistry: isContractDeployed(CONTRACTS.GameRegistry),
    oracleCore: isContractDeployed(CONTRACTS.OracleCore),
    feeManager: isContractDeployed(CONTRACTS.FeeManagerV2),
    anyDeployed: isContractDeployed(CONTRACTS.GameRegistry) || 
                 isContractDeployed(CONTRACTS.OracleCore) || 
                 isContractDeployed(CONTRACTS.FeeManagerV2),
  }
}

// ============================================
// Protocol Stats Hooks
// ============================================

export interface ProtocolStats {
  totalGames: number
  totalMatches: number
  totalResults: number
  totalFinalized: number
  totalDisputed: number
  totalQueries: number
  totalRevenue: number
  protocolBalance: number
  disputerPoolBalance: number
  queryFee: number
  finalizationRate: number
  disputeRate: number
  isLive: boolean
}

export const useProtocolStats = (): { data: ProtocolStats; isLoading: boolean; error: Error | null } => {
  const deployed = useContractsDeployed()
  
  const { data: contractData, isLoading, error } = useReadContracts({
    contracts: [
      { ...OracleCoreContract, functionName: "totalResults" },
      { ...OracleCoreContract, functionName: "totalFinalized" },
      { ...OracleCoreContract, functionName: "totalDisputed" },
      { ...FeeManagerV2Contract, functionName: "totalQueries" },
      { ...FeeManagerV2Contract, functionName: "totalRevenue" },
      { ...FeeManagerV2Contract, functionName: "protocolBalance" },
      { ...FeeManagerV2Contract, functionName: "disputerPoolBalance" },
      { ...FeeManagerV2Contract, functionName: "queryFee" },
      { ...GameRegistryContract, functionName: "totalGames" },
      { ...GameRegistryContract, functionName: "totalMatches" },
    ],
    query: { enabled: deployed.anyDeployed },
  })

  const data = useMemo((): ProtocolStats => {
    // If contracts aren't deployed or no data, return demo data
    if (!deployed.anyDeployed || !contractData) {
      return {
        totalGames: 23,
        totalMatches: 4521,
        totalResults: 1247,
        totalFinalized: 1203,
        totalDisputed: 12,
        totalQueries: 45892,
        totalRevenue: 156.78,
        protocolBalance: 23.52,
        disputerPoolBalance: 7.84,
        queryFee: 0.00416,
        finalizationRate: 96.5,
        disputeRate: 0.96,
        isLive: false,
      }
    }

    const totalResults = contractData[0]?.result ? Number(contractData[0].result) : 0
    const totalFinalized = contractData[1]?.result ? Number(contractData[1].result) : 0
    const totalDisputed = contractData[2]?.result ? Number(contractData[2].result) : 0
    const totalQueries = contractData[3]?.result ? Number(contractData[3].result) : 0
    const totalRevenue = contractData[4]?.result ? parseFloat(formatEther(contractData[4].result as bigint)) : 0
    const protocolBalance = contractData[5]?.result ? parseFloat(formatEther(contractData[5].result as bigint)) : 0
    const disputerPoolBalance = contractData[6]?.result ? parseFloat(formatEther(contractData[6].result as bigint)) : 0
    const queryFee = contractData[7]?.result ? parseFloat(formatEther(contractData[7].result as bigint)) : 0.00416
    const totalGames = contractData[8]?.result ? Number(contractData[8].result) : 0
    const totalMatches = contractData[9]?.result ? Number(contractData[9].result) : 0

    const finalizationRate = totalResults > 0 ? (totalFinalized / totalResults) * 100 : 100
    const disputeRate = totalResults > 0 ? (totalDisputed / totalResults) * 100 : 0

    return {
      totalGames,
      totalMatches,
      totalResults,
      totalFinalized,
      totalDisputed,
      totalQueries,
      totalRevenue,
      protocolBalance,
      disputerPoolBalance,
      queryFee,
      finalizationRate,
      disputeRate,
      isLive: true,
    }
  }, [contractData, deployed.anyDeployed])

  return { data, isLoading, error: error as Error | null }
}

// ============================================
// Game Hooks
// ============================================

export interface Game {
  id: string
  name: string
  developer: string
  type: string
  stake: string
  queries: number
  revenue: string
  reputation: number
  matches: number
  disputes: number
  status: "active" | "inactive" | "pending"
  registeredAt: number
  isLive: boolean
}

// Demo games for fallback
const DEMO_GAMES: Game[] = [
  {
    id: "0x1234567890abcdef1234567890abcdef12345678",
    name: "Virtual Football League",
    developer: "0xaaa...bbb",
    type: "Sports",
    stake: "0.15",
    queries: 24521,
    revenue: "4.82",
    reputation: 850,
    matches: 156,
    disputes: 2,
    status: "active",
    registeredAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    isLive: false,
  },
  {
    id: "0x2345678901bcdef12345678901bcdef123456789",
    name: "RPS Championship",
    developer: "0xbbb...ccc",
    type: "Casual",
    stake: "0.1",
    queries: 18932,
    revenue: "3.72",
    reputation: 920,
    matches: 2341,
    disputes: 0,
    status: "active",
    registeredAt: Date.now() - 45 * 24 * 60 * 60 * 1000,
    isLive: false,
  },
  {
    id: "0x3456789012cdef123456789012cdef1234567890",
    name: "CS2 Pro League",
    developer: "0xccc...ddd",
    type: "Esports",
    stake: "0.5",
    queries: 15721,
    revenue: "3.09",
    reputation: 780,
    matches: 89,
    disputes: 5,
    status: "active",
    registeredAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
    isLive: false,
  },
  {
    id: "0x4567890123def1234567890123def12345678901",
    name: "League of Legends Esports",
    developer: "0xddd...eee",
    type: "Esports",
    stake: "0.25",
    queries: 12450,
    revenue: "2.45",
    reputation: 810,
    matches: 67,
    disputes: 3,
    status: "active",
    registeredAt: Date.now() - 20 * 24 * 60 * 60 * 1000,
    isLive: false,
  },
  {
    id: "0x5678901234ef12345678901234ef123456789012",
    name: "Dota 2 International",
    developer: "0xeee...fff",
    type: "Esports",
    stake: "0.3",
    queries: 9876,
    revenue: "1.94",
    reputation: 890,
    matches: 45,
    disputes: 1,
    status: "active",
    registeredAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
    isLive: false,
  },
]

export const useAllGames = (): { data: Game[]; isLoading: boolean; error: Error | null } => {
  const deployed = useContractsDeployed()
  const [games, setGames] = useState<Game[]>([])
  
  // For now, return demo data as we can't enumerate all games from contract
  // In production, this would use subgraph
  useEffect(() => {
    if (!deployed.gameRegistry) {
      setGames(DEMO_GAMES)
    }
    // TODO: Implement subgraph query for all games
  }, [deployed.gameRegistry])

  return { data: games.length > 0 ? games : DEMO_GAMES, isLoading: false, error: null }
}

export const useDeveloperGames = (address?: Address): { data: Game[]; isLoading: boolean; error: Error | null; refetch: () => void } => {
  const deployed = useContractsDeployed()
  
  const { data: gameIds, isLoading, error, refetch } = useReadContract({
    ...GameRegistryContract,
    functionName: "getDeveloperGames",
    args: address ? [address] : undefined,
    query: { enabled: !!address && deployed.gameRegistry },
  })

  const games = useMemo((): Game[] => {
    if (!deployed.gameRegistry || !gameIds || (gameIds as any[]).length === 0) {
      // Return demo games filtered by "developer"
      return DEMO_GAMES.slice(0, 3).map(g => ({ ...g, developer: address || g.developer }))
    }
    // TODO: Fetch full game data for each gameId
    return []
  }, [gameIds, deployed.gameRegistry, address])

  return { data: games, isLoading, error: error as Error | null, refetch }
}

export const useGameDetails = (gameId: string): { data: Game | null; isLoading: boolean; error: Error | null } => {
  const deployed = useContractsDeployed()
  
  const { data: gameData, isLoading, error } = useReadContract({
    ...GameRegistryContract,
    functionName: "getGame",
    args: [gameId as `0x${string}`],
    query: { enabled: !!gameId && deployed.gameRegistry },
  })

  const { data: earningsData } = useReadContract({
    ...FeeManagerV2Contract,
    functionName: "developerEarnings",
    args: [gameId as `0x${string}`],
    query: { enabled: !!gameId && deployed.feeManager },
  })

  const game = useMemo((): Game | null => {
    if (!deployed.gameRegistry || !gameData) {
      // Return demo game
      return DEMO_GAMES.find(g => g.id === gameId) || DEMO_GAMES[0]
    }

    const data = gameData as unknown as GameData
    const earnings = earningsData as unknown as DeveloperEarnings | undefined

    return {
      id: gameId,
      name: data.name,
      developer: data.developer,
      type: data.gameType === 0 ? "Onchain" : "Traditional",
      stake: formatEther(data.stake),
      queries: earnings?.totalQueries || 0,
      revenue: earnings ? formatEther(earnings.totalEarned) : "0",
      reputation: 500, // Default, would come from contract
      matches: 0, // Would need additional call
      disputes: 0,
      status: data.isActive ? "active" : "inactive",
      registeredAt: Number(data.registeredAt) * 1000,
      isLive: true,
    }
  }, [gameData, earningsData, gameId, deployed.gameRegistry])

  return { data: game, isLoading, error: error as Error | null }
}

// ============================================
// Game Registration Hook
// ============================================

export const useRegisterGame = () => {
  const { writeContract, isPending, data: hash, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const registerGame = (name: string, metadata: string = "{}") => {
    writeContract({
      ...GameRegistryContract,
      functionName: "registerGame",
      args: [name, metadata],
      value: parseEther("0.1"),
    })
  }

  return {
    registerGame,
    isPending,
    isConfirming,
    isSuccess,
    hash,
    error,
  }
}

// ============================================
// Consumer Balance Hooks
// ============================================

export interface UserBalance {
  realBalance: string
  bonusBalance: string
  totalBalance: string
  freeQueriesUsed: number
  freeQueriesRemaining: number
  totalQueries: number
  bonusTier: number
  isLive: boolean
}

export const useConsumerBalance = (address?: Address): { data: UserBalance; isLoading: boolean; error: Error | null } => {
  const deployed = useContractsDeployed()
  
  const { data: balanceData, isLoading, error } = useReadContract({
    ...FeeManagerV2Contract,
    functionName: "getConsumerBalance",
    args: address ? [address] : undefined,
    query: { enabled: !!address && deployed.feeManager },
  })

  const data = useMemo((): UserBalance => {
    if (!deployed.feeManager || !balanceData) {
      return {
        realBalance: "0.5",
        bonusBalance: "0.05",
        totalBalance: "0.55",
        freeQueriesUsed: 3,
        freeQueriesRemaining: 2,
        totalQueries: 127,
        bonusTier: 1,
        isLive: false,
      }
    }

    const balance = balanceData as unknown as ConsumerBalance
    const realBalance = parseFloat(formatEther(balance.realBalance))
    const bonusBalance = parseFloat(formatEther(balance.bonusBalance))

    return {
      realBalance: realBalance.toFixed(4),
      bonusBalance: bonusBalance.toFixed(4),
      totalBalance: (realBalance + bonusBalance).toFixed(4),
      freeQueriesUsed: balance.freeQueriesUsed,
      freeQueriesRemaining: Math.max(0, 5 - balance.freeQueriesUsed),
      totalQueries: balance.totalQueries,
      bonusTier: balance.bonusTier,
      isLive: true,
    }
  }, [balanceData, deployed.feeManager])

  return { data, isLoading, error: error as Error | null }
}

// ============================================
// Deposit Hook
// ============================================

export const useDeposit = () => {
  const { writeContract, isPending, data: hash, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const deposit = (amount: string, referrer?: Address) => {
    writeContract({
      ...FeeManagerV2Contract,
      functionName: "deposit",
      args: referrer ? [referrer] : [],
      value: parseEther(amount),
    })
  }

  return {
    deposit,
    isPending,
    isConfirming,
    isSuccess,
    hash,
    error,
  }
}

// ============================================
// Withdraw Earnings Hook
// ============================================

export const useWithdrawEarnings = () => {
  const { writeContract, isPending, data: hash, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const withdraw = (gameId: string) => {
    writeContract({
      ...FeeManagerV2Contract,
      functionName: "withdrawEarnings",
      args: [gameId as `0x${string}`],
    })
  }

  return {
    withdraw,
    isPending,
    isConfirming,
    isSuccess,
    hash,
    error,
  }
}
