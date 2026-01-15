import { useReadContract, useReadContracts } from 'wagmi'
import { Address } from 'viem'
import { GameRegistryContract } from '../contracts'

/**
 * Hook to get all matches for a specific game
 */
export function useGameMatches(gameId: `0x${string}` | undefined) {
  return useReadContract({
    ...GameRegistryContract,
    functionName: 'getGameMatches',
    args: gameId ? [gameId] : undefined,
    query: {
      enabled: !!gameId,
    },
  })
}

/**
 * Hook to get paginated matches for a game
 */
export function useGameMatchesPaginated(
  gameId: `0x${string}` | undefined,
  offset: number = 0,
  limit: number = 20
) {
  return useReadContract({
    ...GameRegistryContract,
    functionName: 'getGameMatchesPaginated',
    args: gameId ? [gameId, BigInt(offset), BigInt(limit)] : undefined,
    query: {
      enabled: !!gameId,
    },
  })
}

/**
 * Hook to get match details with gameId validation
 */
export function useGameMatch(gameId: `0x${string}` | undefined, matchId: `0x${string}` | undefined) {
  return useReadContract({
    ...GameRegistryContract,
    functionName: 'getGameMatch',
    args: gameId && matchId ? [gameId, matchId] : undefined,
    query: {
      enabled: !!(gameId && matchId),
    },
  })
}

/**
 * Hook to batch get matches
 */
export function useMatchesBatch(matchIds: `0x${string}`[] | undefined) {
  return useReadContract({
    ...GameRegistryContract,
    functionName: 'getMatchesBatch',
    args: matchIds && matchIds.length > 0 ? [matchIds] : undefined,
    query: {
      enabled: !!(matchIds && matchIds.length > 0),
    },
  })
}

/**
 * Hook to get all games for a developer
 */
export function useDeveloperGames(developerAddress: Address | undefined) {
  return useReadContract({
    ...GameRegistryContract,
    functionName: 'getDeveloperGames',
    args: developerAddress ? [developerAddress] : undefined,
    query: {
      enabled: !!developerAddress,
    },
  })
}

/**
 * Hook to get aggregated developer statistics
 */
export function useDeveloperStats(developerAddress: Address | undefined) {
  return useReadContract({
    ...GameRegistryContract,
    functionName: 'getDeveloperStats',
    args: developerAddress ? [developerAddress] : undefined,
    query: {
      enabled: !!developerAddress,
    },
  })
}

/**
 * Hook to get all active games
 */
export function useActiveGames() {
  return useReadContract({
    ...GameRegistryContract,
    functionName: 'getActiveGames',
  })
}

/**
 * Hook to get paginated list of all games
 */
export function useAllGames(offset: number = 0, limit: number = 10) {
  return useReadContract({
    ...GameRegistryContract,
    functionName: 'getAllGames',
    args: [BigInt(offset), BigInt(limit)],
  })
}

/**
 * Hook to batch get games
 */
export function useGamesBatch(gameIds: `0x${string}`[] | undefined) {
  return useReadContract({
    ...GameRegistryContract,
    functionName: 'getGamesBatch',
    args: gameIds && gameIds.length > 0 ? [gameIds] : undefined,
    query: {
      enabled: !!(gameIds && gameIds.length > 0),
    },
  })
}

/**
 * Hook to check if a match exists for a game
 */
export function useMatchExists(gameId: `0x${string}` | undefined, matchId: `0x${string}` | undefined) {
  return useReadContract({
    ...GameRegistryContract,
    functionName: 'matchExists',
    args: gameId && matchId ? [gameId, matchId] : undefined,
    query: {
      enabled: !!(gameId && matchId),
    },
  })
}

/**
 * Comprehensive hook to fetch all dashboard data for a developer
 */
export function useDeveloperDashboard(developerAddress: Address | undefined) {
  // Get developer's games
  const { data: gameIds, isLoading: isLoadingGames } = useDeveloperGames(developerAddress)

  // Get developer stats
  const { data: stats, isLoading: isLoadingStats } = useDeveloperStats(developerAddress)

  // Batch get game details if we have gameIds
  const { data: games, isLoading: isLoadingGameDetails } = useGamesBatch(
    gameIds as `0x${string}`[] | undefined
  )

  return {
    gameIds,
    stats,
    games,
    isLoading: isLoadingGames || isLoadingStats || isLoadingGameDetails,
  }
}
