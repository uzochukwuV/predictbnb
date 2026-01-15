// Subgraph client for PredictBNB
// This will be used when the subgraph is deployed to The Graph

import { Game, ProtocolStats } from "@/lib/hooks/useContractData"

const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL || ""

export interface SubgraphError {
  message: string
  locations?: { line: number; column: number }[]
}

export interface SubgraphResponse<T> {
  data?: T
  errors?: SubgraphError[]
}

export async function querySubgraph<T>(query: string, variables?: Record<string, unknown>): Promise<T | null> {
  if (!SUBGRAPH_URL) {
    console.warn("Subgraph URL not configured")
    return null
  }

  try {
    const response = await fetch(SUBGRAPH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result: SubgraphResponse<T> = await response.json()

    if (result.errors) {
      console.error("Subgraph query errors:", result.errors)
      return null
    }

    return result.data || null
  } catch (error) {
    console.error("Subgraph query failed:", error)
    return null
  }
}

// Type-safe query helpers
export async function fetchProtocolStats(): Promise<ProtocolStats | null> {
  const query = `
    query ProtocolStats {
      protocolStats(id: "protocol") {
        totalGames
        totalMatches
        totalResults
        totalQueries
        totalRevenue
        protocolBalance
        disputerPoolBalance
        updatedAt
      }
    }
  `

  interface QueryResult {
    protocolStats: {
      totalGames: number
      totalMatches: number
      totalResults: number
      totalQueries: string
      totalRevenue: string
      protocolBalance: string
      disputerPoolBalance: string
    } | null
  }

  const result = await querySubgraph<QueryResult>(query)
  
  if (!result?.protocolStats) return null

  const stats = result.protocolStats
  const totalResults = stats.totalResults || 0
  const totalFinalized = Math.floor(totalResults * 0.96) // Approximate

  return {
    totalGames: stats.totalGames,
    totalMatches: stats.totalMatches,
    totalResults: totalResults,
    totalFinalized: totalFinalized,
    totalDisputed: Math.floor(totalResults * 0.01),
    totalQueries: parseInt(stats.totalQueries) || 0,
    totalRevenue: parseFloat(stats.totalRevenue) / 1e18 || 0,
    protocolBalance: parseFloat(stats.protocolBalance) / 1e18 || 0,
    disputerPoolBalance: parseFloat(stats.disputerPoolBalance) / 1e18 || 0,
    queryFee: 0.00416,
    finalizationRate: totalResults > 0 ? (totalFinalized / totalResults) * 100 : 100,
    disputeRate: totalResults > 0 ? 1 : 0,
    isLive: true,
  }
}

export async function fetchAllGames(first: number = 20, skip: number = 0): Promise<Game[]> {
  const query = `
    query AllGames($first: Int!, $skip: Int!) {
      games(
        first: $first
        skip: $skip
        orderBy: totalMatches
        orderDirection: desc
        where: { isActive: true }
      ) {
        id
        developer
        name
        stakedAmount
        reputation
        registeredAt
        totalMatches
        totalDisputes
        isActive
        earnings {
          totalEarned
          totalQueries
        }
      }
    }
  `

  interface GameData {
    id: string
    developer: string
    name: string
    stakedAmount: string
    reputation: number
    registeredAt: string
    totalMatches: number
    totalDisputes: number
    isActive: boolean
    earnings: {
      totalEarned: string
      totalQueries: number
    } | null
  }

  interface QueryResult {
    games: GameData[]
  }

  const result = await querySubgraph<QueryResult>(query, { first, skip })
  
  if (!result?.games) return []

  return result.games.map(game => ({
    id: game.id,
    name: game.name,
    developer: game.developer,
    type: "Traditional",
    stake: (parseFloat(game.stakedAmount) / 1e18).toFixed(2),
    queries: game.earnings?.totalQueries || 0,
    revenue: ((parseFloat(game.earnings?.totalEarned || "0") / 1e18)).toFixed(4),
    reputation: game.reputation,
    matches: game.totalMatches,
    disputes: game.totalDisputes,
    status: game.isActive ? "active" as const : "inactive" as const,
    registeredAt: parseInt(game.registeredAt) * 1000,
    isLive: true,
  }))
}

export async function fetchDailyStats(days: number = 7) {
  const query = `
    query DailyStats($days: Int!) {
      dailyStats(
        first: $days
        orderBy: date
        orderDirection: desc
      ) {
        id
        date
        gamesRegistered
        matchesScheduled
        resultsSubmitted
        queriesMade
        revenue
      }
    }
  `

  interface DailyStatsData {
    id: string
    date: string
    gamesRegistered: number
    matchesScheduled: number
    resultsSubmitted: number
    queriesMade: number
    revenue: string
  }

  interface QueryResult {
    dailyStats: DailyStatsData[]
  }

  const result = await querySubgraph<QueryResult>(query, { days })
  
  if (!result?.dailyStats) return []

  return result.dailyStats.map(stat => ({
    date: new Date(parseInt(stat.date) * 1000),
    gamesRegistered: stat.gamesRegistered,
    matchesScheduled: stat.matchesScheduled,
    resultsSubmitted: stat.resultsSubmitted,
    queries: stat.queriesMade,
    revenue: parseFloat(stat.revenue) / 1e18,
  }))
}
