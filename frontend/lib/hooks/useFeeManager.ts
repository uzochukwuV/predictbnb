import { useReadContract } from 'wagmi'
import { formatEther } from 'viem'
import { FeeManagerV2Contract } from '../contracts'

/**
 * Hook to get developer earnings for a game
 */
export function useDeveloperEarnings(gameId: `0x${string}` | undefined) {
  return useReadContract({
    ...FeeManagerV2Contract,
    functionName: 'developerEarnings',
    args: gameId ? [gameId] : undefined,
    query: {
      enabled: !!gameId,
    },
  })
}

/**
 * Hook to get query fee amount
 */
export function useQueryFee() {
  return useReadContract({
    ...FeeManagerV2Contract,
    functionName: 'queryFee',
  })
}

/**
 * Hook to get formatted developer earnings
 */
export function useFormattedDeveloperEarnings(gameId: `0x${string}` | undefined) {
  const { data, isLoading, error } = useDeveloperEarnings(gameId)
  const dataany = data as any
  const formatted = (dataany as any)
    ? {
        totalEarned: formatEther(dataany[0]),
        pendingEarnings: formatEther(dataany[1]),
        lastWithdrawTime: Number(dataany[2]),
        totalQueries: Number(dataany[3]),
      }
    : null

  return {
    data: formatted,
    isLoading,
    error,
  }
}

/**
 * Hook to get all earnings data for multiple games
 */
export function useMultipleGameEarnings(gameIds: `0x${string}`[] | undefined) {
  // This would need useReadContracts for parallel fetching
  // For now, return a helper that can be used with Promise.all
  return {
    gameIds,
    // Frontend can map over gameIds and use useDeveloperEarnings for each
  }
}
