// Demo data for when contracts aren't deployed
// This provides realistic mock data for UI development and testing

import { Game, ProtocolStats, UserBalance } from "@/lib/hooks/useContractData"

export const DEMO_PROTOCOL_STATS: ProtocolStats = {
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

export const DEMO_GAMES: Game[] = [
  {
    id: "0x1234567890abcdef1234567890abcdef12345678",
    name: "Virtual Football League",
    developer: "0xaaa1...bbb1",
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
    developer: "0xbbb2...ccc2",
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
    developer: "0xccc3...ddd3",
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
    developer: "0xddd4...eee4",
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
    developer: "0xeee5...fff5",
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

export const DEMO_USER_BALANCE: UserBalance = {
  realBalance: "0.5",
  bonusBalance: "0.05",
  totalBalance: "0.55",
  freeQueriesUsed: 3,
  freeQueriesRemaining: 2,
  totalQueries: 127,
  bonusTier: 1,
  isLive: false,
}

export interface Market {
  id: string
  title: string
  game: string
  gameId: string
  matchId: string
  totalPool: string
  optionA: { label: string; pool: string; odds: number }
  optionB: { label: string; pool: string; odds: number }
  status: "active" | "resolved" | "pending" | "disputed"
  endsAt: string
  endsAtTimestamp: number
  participants: number
  winner?: string
  isLive: boolean
}

export const DEMO_MARKETS: Market[] = [
  {
    id: "1",
    title: "Virtual Football: Team Alpha vs Team Beta",
    game: "Virtual Football League",
    gameId: "0x1234567890abcdef1234567890abcdef12345678",
    matchId: "0xabc123",
    totalPool: "12.5",
    optionA: { label: "Team Alpha Wins", pool: "7.5", odds: 1.67 },
    optionB: { label: "Team Beta Wins", pool: "5.0", odds: 2.5 },
    status: "active",
    endsAt: "2h 30m",
    endsAtTimestamp: Date.now() + 2.5 * 60 * 60 * 1000,
    participants: 156,
    isLive: false,
  },
  {
    id: "2",
    title: "RPS Tournament Final",
    game: "RPS Championship",
    gameId: "0x2345678901bcdef12345678901bcdef123456789",
    matchId: "0xdef456",
    totalPool: "8.2",
    optionA: { label: "Player X", pool: "4.1", odds: 2.0 },
    optionB: { label: "Player Y", pool: "4.1", odds: 2.0 },
    status: "active",
    endsAt: "45m",
    endsAtTimestamp: Date.now() + 45 * 60 * 1000,
    participants: 89,
    isLive: false,
  },
  {
    id: "3",
    title: "CS2 Semi-Final Match",
    game: "CS2 Pro League",
    gameId: "0x3456789012cdef123456789012cdef1234567890",
    matchId: "0xghi789",
    totalPool: "25.0",
    optionA: { label: "Ninjas", pool: "18.0", odds: 1.39 },
    optionB: { label: "Vikings", pool: "7.0", odds: 3.57 },
    status: "resolved",
    endsAt: "Ended",
    endsAtTimestamp: Date.now() - 2 * 60 * 60 * 1000,
    participants: 312,
    winner: "Ninjas",
    isLive: false,
  },
  {
    id: "4",
    title: "League of Legends Qualifier",
    game: "LoL Esports",
    gameId: "0x4567890123def1234567890123def12345678901",
    matchId: "0xjkl012",
    totalPool: "5.8",
    optionA: { label: "Dragons", pool: "3.2", odds: 1.81 },
    optionB: { label: "Phoenix", pool: "2.6", odds: 2.23 },
    status: "pending",
    endsAt: "Pending Result",
    endsAtTimestamp: Date.now() - 30 * 60 * 1000,
    participants: 67,
    isLive: false,
  },
  {
    id: "5",
    title: "Dota 2 Grand Final",
    game: "Dota 2 International",
    gameId: "0x5678901234ef12345678901234ef123456789012",
    matchId: "0xmno345",
    totalPool: "45.2",
    optionA: { label: "Spirit", pool: "22.6", odds: 2.0 },
    optionB: { label: "OG", pool: "22.6", odds: 2.0 },
    status: "active",
    endsAt: "5h 15m",
    endsAtTimestamp: Date.now() + 5.25 * 60 * 60 * 1000,
    participants: 534,
    isLive: false,
  },
]

export interface RecentActivity {
  id: string
  type: "result" | "market" | "query" | "dispute" | "registration"
  game: string
  action: string
  time: string
  timestamp: number
  status: "pending" | "success" | "warning"
  txHash?: string
}

export const DEMO_RECENT_ACTIVITY: RecentActivity[] = [
  { 
    id: "1", 
    type: "result", 
    game: "Virtual Football", 
    action: "Result submitted", 
    time: "2 mins ago", 
    timestamp: Date.now() - 2 * 60 * 1000,
    status: "pending" 
  },
  { 
    id: "2", 
    type: "market", 
    game: "RPS Battle", 
    action: "Market resolved", 
    time: "5 mins ago", 
    timestamp: Date.now() - 5 * 60 * 1000,
    status: "success" 
  },
  { 
    id: "3", 
    type: "query", 
    game: "CS Tournament", 
    action: "Query executed", 
    time: "12 mins ago", 
    timestamp: Date.now() - 12 * 60 * 1000,
    status: "success" 
  },
  { 
    id: "4", 
    type: "dispute", 
    game: "League Match", 
    action: "Dispute created", 
    time: "1 hour ago", 
    timestamp: Date.now() - 60 * 60 * 1000,
    status: "warning" 
  },
  { 
    id: "5", 
    type: "registration", 
    game: "New RPG Arena", 
    action: "Game registered", 
    time: "2 hours ago", 
    timestamp: Date.now() - 2 * 60 * 60 * 1000,
    status: "success" 
  },
]

export interface LeaderboardEntry {
  rank: number
  address: string
  name?: string
  value: string
  secondaryValue?: string
  change: number
}

export const DEMO_TOP_GAMES: LeaderboardEntry[] = [
  { rank: 1, address: "0x123...", name: "Virtual Football League", value: "24,521", secondaryValue: "4.82 BNB", change: 15 },
  { rank: 2, address: "0x456...", name: "RPS Championship", value: "18,932", secondaryValue: "3.72 BNB", change: 8 },
  { rank: 3, address: "0x789...", name: "CS2 Pro League", value: "15,721", secondaryValue: "3.09 BNB", change: 12 },
  { rank: 4, address: "0xabc...", name: "League of Legends Esports", value: "12,450", secondaryValue: "2.45 BNB", change: -3 },
  { rank: 5, address: "0xdef...", name: "Dota 2 International", value: "9,876", secondaryValue: "1.94 BNB", change: 22 },
]

export const DEMO_TOP_DEVELOPERS: LeaderboardEntry[] = [
  { rank: 1, address: "0xaaa...", name: "GameStudio Pro", value: "8.45 BNB", secondaryValue: "3 games", change: 18 },
  { rank: 2, address: "0xbbb...", name: "Esports Hub", value: "6.23 BNB", secondaryValue: "2 games", change: 12 },
  { rank: 3, address: "0xccc...", name: "Casual Games Inc", value: "4.87 BNB", secondaryValue: "5 games", change: 8 },
  { rank: 4, address: "0xddd...", name: "Tournament Masters", value: "3.56 BNB", secondaryValue: "1 game", change: 25 },
  { rank: 5, address: "0xeee...", name: "Indie Oracle", value: "2.12 BNB", secondaryValue: "2 games", change: -5 },
]

export const DEMO_DAILY_STATS = [
  { day: "Mon", queries: 4521, revenue: 18.8 },
  { day: "Tue", queries: 5234, revenue: 21.8 },
  { day: "Wed", queries: 6102, revenue: 25.4 },
  { day: "Thu", queries: 5876, revenue: 24.5 },
  { day: "Fri", queries: 7234, revenue: 30.1 },
  { day: "Sat", queries: 8912, revenue: 37.1 },
  { day: "Sun", queries: 8013, revenue: 33.4 },
]

export interface Dispute {
  id: string
  game: string
  gameId: string
  matchId: string
  challenger: string
  stakeAmount: string
  status: "pending" | "accepted" | "rejected" | "investigating"
  reason: string
  createdAt: number
  resolvedAt?: number
}

export const DEMO_DISPUTES: Dispute[] = [
  { 
    id: "1", 
    game: "CS2 Pro League", 
    gameId: "0x345...",
    matchId: "0xabc...", 
    challenger: "0x111...",
    stakeAmount: "0.2",
    status: "pending", 
    reason: "Incorrect score reported",
    createdAt: Date.now() - 2 * 60 * 60 * 1000,
  },
  { 
    id: "2", 
    game: "Virtual Football", 
    gameId: "0x123...",
    matchId: "0xdef...", 
    challenger: "0x222...",
    stakeAmount: "0.2",
    status: "rejected", 
    reason: "Match time discrepancy",
    createdAt: Date.now() - 24 * 60 * 60 * 1000,
    resolvedAt: Date.now() - 23 * 60 * 60 * 1000,
  },
]
