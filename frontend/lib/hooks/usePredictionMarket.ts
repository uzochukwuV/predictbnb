import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { type Address, type Hex, parseEther } from 'viem'
import RPSPredictionMarketABI from '../abis/RPSPredictionMarket.json'

// Contract addresses - update these with deployed addresses
const PREDICTION_MARKET_ADDRESS: Address = (process.env.NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS as Address) || '0x0000000000000000000000000000000000000000'

export interface Market {
  matchId: Hex
  gameId: Hex
  player1: Address
  player2: Address
  totalPool: bigint
  player1Pool: bigint
  player2Pool: bigint
  tiePool: bigint
  bettingDeadline: bigint
  isResolved: boolean
  winner: Address
  resolvedAt: bigint
}

export interface Bet {
  bettor: Address
  predictedWinner: Address
  amount: bigint
  claimed: boolean
}

export interface MarketOdds {
  player1Odds: bigint
  player2Odds: bigint
  tieOdds: bigint
}

// Read hooks
export function useGetMarket(marketId: bigint | undefined) {
  return useReadContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: RPSPredictionMarketABI.abi,
    functionName: 'getMarket',
    args: marketId !== undefined ? [marketId] : undefined,
    query: {
      enabled: marketId !== undefined,
    },
  })
}

export function useGetUserBets(marketId: bigint | undefined, userAddress: Address | undefined) {
  return useReadContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: RPSPredictionMarketABI.abi,
    functionName: 'getUserBets',
    args: marketId !== undefined && userAddress ? [marketId, userAddress] : undefined,
    query: {
      enabled: marketId !== undefined && !!userAddress,
    },
  })
}

export function useCalculatePotentialWinnings(
  marketId: bigint | undefined,
  userAddress: Address | undefined,
  assumedWinner: Address | undefined
) {
  return useReadContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: RPSPredictionMarketABI.abi,
    functionName: 'calculatePotentialWinnings',
    args: marketId !== undefined && userAddress && assumedWinner
      ? [marketId, userAddress, assumedWinner]
      : undefined,
    query: {
      enabled: marketId !== undefined && !!userAddress && !!assumedWinner,
    },
  })
}

export function useGetOdds(marketId: bigint | undefined) {
  return useReadContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: RPSPredictionMarketABI.abi,
    functionName: 'getOdds',
    args: marketId !== undefined ? [marketId] : undefined,
    query: {
      enabled: marketId !== undefined,
    },
  })
}

export function useMarketCounter() {
  return useReadContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: RPSPredictionMarketABI.abi,
    functionName: 'marketCounter',
  })
}

export function usePlatformFee() {
  return useReadContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: RPSPredictionMarketABI.abi,
    functionName: 'PLATFORM_FEE',
  })
}

// Write hooks
export function usePlaceBet() {
  const { data: hash, writeContract, isPending, error } = useWriteContract()

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash })

  const placeBet = (marketId: bigint, predictedWinner: Address, amount: string) => {
    writeContract({
      address: PREDICTION_MARKET_ADDRESS,
      abi: RPSPredictionMarketABI.abi,
      functionName: 'placeBet',
      args: [marketId, predictedWinner],
      value: parseEther(amount),
    })
  }

  return {
    placeBet,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  }
}

export function useResolveMarket() {
  const { data: hash, writeContract, isPending, error } = useWriteContract()

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash })

  const resolveMarket = (marketId: bigint) => {
    writeContract({
      address: PREDICTION_MARKET_ADDRESS,
      abi: RPSPredictionMarketABI.abi,
      functionName: 'resolveMarket',
      args: [marketId],
    })
  }

  return {
    resolveMarket,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  }
}

export function useClaimWinnings() {
  const { data: hash, writeContract, isPending, error } = useWriteContract()

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash })

  const claimWinnings = (marketId: bigint) => {
    writeContract({
      address: PREDICTION_MARKET_ADDRESS,
      abi: RPSPredictionMarketABI.abi,
      functionName: 'claimWinnings',
      args: [marketId],
    })
  }

  return {
    claimWinnings,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  }
}

export function useFundOracleBalance() {
  const { data: hash, writeContract, isPending, error } = useWriteContract()

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash })

  const fundOracleBalance = (amount: string) => {
    writeContract({
      address: PREDICTION_MARKET_ADDRESS,
      abi: RPSPredictionMarketABI.abi,
      functionName: 'fundOracleBalance',
      value: parseEther(amount),
    })
  }

  return {
    fundOracleBalance,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  }
}

export function useCreateMarket() {
  const { data: hash, writeContract, isPending, error } = useWriteContract()

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash })

  const createMarket = (
    matchId: Hex,
    gameId: Hex,
    player1: Address,
    player2: Address,
    bettingDeadline: bigint
  ) => {
    writeContract({
      address: PREDICTION_MARKET_ADDRESS,
      abi: RPSPredictionMarketABI.abi,
      functionName: 'createMarket',
      args: [matchId, gameId, player1, player2, bettingDeadline],
    })
  }

  return {
    createMarket,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  }
}

// Helper functions
export function getPredictionMarketAddress(): Address {
  return PREDICTION_MARKET_ADDRESS
}

export function formatBNB(wei: bigint): string {
  const ether = Number(wei) / 1e18
  return ether.toFixed(4)
}

export function calculateOddsDisplay(totalPool: bigint, specificPool: bigint): string {
  if (specificPool === 0n) return '0.00x'
  const odds = Number(totalPool) / Number(specificPool)
  return `${odds.toFixed(2)}x`
}

export function calculatePotentialPayout(
  betAmount: bigint,
  totalPool: bigint,
  winningPool: bigint,
  platformFeeBps: bigint
): bigint {
  if (winningPool === 0n) return 0n

  const platformFee = (totalPool * platformFeeBps) / 10000n
  const payoutPool = totalPool - platformFee

  return (betAmount * payoutPool) / winningPool
}
