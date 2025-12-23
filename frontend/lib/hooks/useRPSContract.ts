import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { type Address, type Hex } from 'viem'
import RockPaperScissorsABI from '../abis/RockPaperScissors.json'

// Contract addresses - update these with deployed addresses
const RPS_CONTRACT_ADDRESS: Address = (process.env.NEXT_PUBLIC_RPS_CONTRACT_ADDRESS as Address) || '0x0000000000000000000000000000000000000000'

export interface RPSMatch {
  matchId: Hex
  player1: Address
  player2: Address
  scheduledTime: bigint
  status: number
  player1Cards: number[]
  player2Cards: number[]
  winner: Address
  player1Wins: number
  player2Wins: number
  randomSeed1: bigint
  randomSeed2: bigint
  completedAt: bigint
}

export interface PlayerStats {
  wins: bigint
  totalMatches: bigint
}

// Read hooks
export function useGetMatch(matchId: Hex | undefined) {
  return useReadContract({
    address: RPS_CONTRACT_ADDRESS,
    abi: RockPaperScissorsABI.abi,
    functionName: 'getMatch',
    args: matchId ? [matchId] : undefined,
    query: {
      enabled: !!matchId,
    },
  })
}

export function useGetPlayerStats(playerAddress: Address | undefined) {
  return useReadContract({
    address: RPS_CONTRACT_ADDRESS,
    abi: RockPaperScissorsABI.abi,
    functionName: 'getPlayerStats',
    args: playerAddress ? [playerAddress] : undefined,
    query: {
      enabled: !!playerAddress,
    },
  })
}

export function useGameId() {
  return useReadContract({
    address: RPS_CONTRACT_ADDRESS,
    abi: RockPaperScissorsABI.abi,
    functionName: 'gameId',
  })
}

export function useMatchCounter() {
  return useReadContract({
    address: RPS_CONTRACT_ADDRESS,
    abi: RockPaperScissorsABI.abi,
    functionName: 'matchCounter',
  })
}

// Write hooks
export function useCommitToMatch() {
  const { data: hash, writeContract, isPending, error } = useWriteContract()

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash })

  const commitToMatch = (matchId: Hex) => {
    writeContract({
      address: RPS_CONTRACT_ADDRESS,
      abi: RockPaperScissorsABI.abi,
      functionName: 'commitToMatch',
      args: [matchId],
    })
  }

  return {
    commitToMatch,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  }
}

export function useScheduleMatch() {
  const { data: hash, writeContract, isPending, error } = useWriteContract()

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash })

  const scheduleMatch = (
    player1: Address,
    player2: Address,
    scheduledTime: bigint
  ) => {
    writeContract({
      address: RPS_CONTRACT_ADDRESS,
      abi: RockPaperScissorsABI.abi,
      functionName: 'scheduleMatch',
      args: [player1, player2, scheduledTime],
    })
  }

  return {
    scheduleMatch,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  }
}

// Helper functions
export function getRPSContractAddress(): Address {
  return RPS_CONTRACT_ADDRESS
}

export function getCardName(card: number): string {
  const names = ['Rock', 'Paper', 'Scissors']
  return names[card] || 'Unknown'
}

export function getCardEmoji(card: number): string {
  const emojis = ['🪨', '📄', '✂️']
  return emojis[card] || '❓'
}

export function getMatchStatusName(status: number): string {
  const statuses = ['Scheduled', 'Player 1 Committed', 'Completed', 'Cancelled']
  return statuses[status] || 'Unknown'
}
