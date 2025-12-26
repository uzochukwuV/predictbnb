import { Address } from 'viem'
import GameRegistryABI from './abis/GameRegistry.json'
import OracleCoreABI from './abis/OracleCore.json'
import FeeManagerV2ABI from './abis/FeeManagerV2.json'
import VirtualFootballGameABI from './abis/VirtualFootballGame.json'
import VirtualFootballMarketABI from './abis/VirtualFootballMarket.json'

// Contract addresses - these should be set via environment variables
// For now using placeholder addresses
export const CONTRACTS = {
  GameRegistry: (process.env.NEXT_PUBLIC_GAME_REGISTRY_ADDRESS || '0x0000000000000000000000000000000000000000') as Address,
  OracleCore: (process.env.NEXT_PUBLIC_ORACLE_CORE_ADDRESS || '0x0000000000000000000000000000000000000000') as Address,
  FeeManagerV2: (process.env.NEXT_PUBLIC_FEE_MANAGER_ADDRESS || '0x0000000000000000000000000000000000000000') as Address,
  VirtualFootballGame: (process.env.NEXT_PUBLIC_VIRTUAL_FOOTBALL_GAME_ADDRESS || '0x0000000000000000000000000000000000000000') as Address,
  VirtualFootballMarket: (process.env.NEXT_PUBLIC_VIRTUAL_FOOTBALL_MARKET_ADDRESS || '0x0000000000000000000000000000000000000000') as Address,
} as const

// ABIs
export const ABIS = {
  GameRegistry: GameRegistryABI.abi,
  OracleCore: OracleCoreABI.abi,
  FeeManagerV2: FeeManagerV2ABI.abi,
  VirtualFootballGame: VirtualFootballGameABI.abi,
  VirtualFootballMarket: VirtualFootballMarketABI.abi,
} as const

// Contract configurations for wagmi
export const GameRegistryContract = {
  address: CONTRACTS.GameRegistry,
  abi: ABIS.GameRegistry,
} as const

export const OracleCoreContract = {
  address: CONTRACTS.OracleCore,
  abi: ABIS.OracleCore,
} as const

export const FeeManagerV2Contract = {
  address: CONTRACTS.FeeManagerV2,
  abi: ABIS.FeeManagerV2,
} as const

export const VirtualFootballGameContract = {
  address: CONTRACTS.VirtualFootballGame,
  abi: ABIS.VirtualFootballGame,
} as const

export const VirtualFootballMarketContract = {
  address: CONTRACTS.VirtualFootballMarket,
  abi: ABIS.VirtualFootballMarket,
} as const

// Type helpers for contract data structures
export type GameData = {
  gameId: `0x${string}`
  developer: Address
  name: string
  metadata: string
  stake: bigint
  registeredAt: bigint
  isActive: boolean
  gameType: number
}

export type ConsumerBalance = {
  realBalance: bigint
  bonusBalance: bigint
  lastResetTime: bigint
  freeQueriesUsed: number
  totalQueries: number
  bonusTier: number
}

export type DeveloperEarnings = {
  totalEarned: bigint
  pendingEarnings: bigint
  lastWithdrawTime: bigint
  totalQueries: number
}

export type StreakData = {
  lastActiveDay: bigint
  currentStreak: number
  longestStreak: number
  totalRewards: bigint
}

export type ReferralData = {
  referrer: Address
  referralCount: number
  earningsFromRefs: bigint
  hasUsedReferral: boolean
}
