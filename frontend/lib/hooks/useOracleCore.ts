import { useReadContract } from 'wagmi'
import { OracleCoreContract } from '../contracts'

/**
 * Hook to get statistics for a specific game
 */
export function useGameStats(gameId: `0x${string}` | undefined) {
  return useReadContract({
    ...OracleCoreContract,
    functionName: 'getGameStats',
    args: gameId ? [gameId] : undefined,
    query: {
      enabled: !!gameId,
    },
  })
}

/**
 * Hook to get all results for a game
 */
export function useGameResults(gameId: `0x${string}` | undefined) {
  return useReadContract({
    ...OracleCoreContract,
    functionName: 'getGameResults',
    args: gameId ? [gameId] : undefined,
    query: {
      enabled: !!gameId,
    },
  })
}

/**
 * Hook to get a specific result with gameId validation
 */
export function useGameResult(gameId: `0x${string}` | undefined, matchId: `0x${string}` | undefined) {
  return useReadContract({
    ...OracleCoreContract,
    functionName: 'getGameResult',
    args: gameId && matchId ? [gameId, matchId] : undefined,
    query: {
      enabled: !!(gameId && matchId),
    },
  })
}

/**
 * Hook to get global oracle statistics
 */
export function useGlobalStats() {
  return useReadContract({
    ...OracleCoreContract,
    functionName: 'getGlobalStats',
  })
}

/**
 * Hook to batch get results
 */
export function useResultsBatch(matchIds: `0x${string}`[] | undefined) {
  return useReadContract({
    ...OracleCoreContract,
    functionName: 'getResultsBatch',
    args: matchIds && matchIds.length > 0 ? [matchIds] : undefined,
    query: {
      enabled: !!(matchIds && matchIds.length > 0),
    },
  })
}

/**
 * Hook to get pending results for a game
 */
export function usePendingResults(gameId: `0x${string}` | undefined, limit: number = 10) {
  return useReadContract({
    ...OracleCoreContract,
    functionName: 'getPendingResults',
    args: gameId ? [gameId, BigInt(limit)] : undefined,
    query: {
      enabled: !!gameId,
    },
  })
}

/**
 * Hook to check if a result can be finalized
 */
export function useCanFinalize(matchId: `0x${string}` | undefined) {
  return useReadContract({
    ...OracleCoreContract,
    functionName: 'canFinalize',
    args: matchId ? [matchId] : undefined,
    query: {
      enabled: !!matchId,
    },
  })
}

/**
 * Hook to get full result data with decode instructions
 */
export function useFullResult(matchId: `0x${string}` | undefined) {
  return useReadContract({
    ...OracleCoreContract,
    functionName: 'getFullResult',
    args: matchId ? [matchId] : undefined,
    query: {
      enabled: !!matchId,
    },
  })
}

/**
 * Hook to peek at a quick field value without charging
 */
export function usePeekResultField(matchId: `0x${string}` | undefined, fieldHash: `0x${string}` | undefined) {
  return useReadContract({
    ...OracleCoreContract,
    functionName: 'peekResultField',
    args: matchId && fieldHash ? [matchId, fieldHash] : undefined,
    query: {
      enabled: !!(matchId && fieldHash),
    },
  })
}

/**
 * Comprehensive hook to get all oracle data for a game
 */
export function useGameOracleData(gameId: `0x${string}` | undefined) {
  const { data: stats, isLoading: isLoadingStats } = useGameStats(gameId)
  const { data: results, isLoading: isLoadingResults } = useGameResults(gameId)
  const { data: pending, isLoading: isLoadingPending } = usePendingResults(gameId, 10)
  const statsany = stats as any
  // Calculate finalization rate
  const finalizationRate = stats
    ? Number(statsany[1]) > 0
      ? (Number(statsany[1]) / Number(statsany[0])) * 100
      : 0
    : 0

  // Calculate dispute rate
  const disputeRate = stats
    ? Number(statsany[0]) > 0
      ? (Number(statsany[2]) / Number(statsany[0])) * 100
      : 0
    : 0

  return {
    stats: statsany
      ? {
          totalResults: Number(statsany[0]),
          finalizedResults: Number(statsany[1]),
          disputedResults: Number(statsany[2]),
          finalizationRate,
          disputeRate,
        }
      : null,
    results,
    pending,
    isLoading: isLoadingStats || isLoadingResults || isLoadingPending,
  }
}
