'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  TrendingUp,
  Star,
  Zap,
  DollarSign,
  Users,
  BarChart3,
  Gamepad2,
} from 'lucide-react';
import Link from 'next/link';

type GameType = 'all' | 'esports' | 'onchain' | 'web2' | 'mobile';

interface Game {
  id: string;
  name: string;
  type: GameType;
  queryVolume: number;
  monthlyQueries: number;
  costPerQuery: number;
  reputation: number;
  developer: string;
  description: string;
  schemaType: string;
  activeMarkets: number;
}

const gameTypes: { value: GameType; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All Games', icon: <Gamepad2 className="w-4 h-4" /> },
  { value: 'esports', label: 'Esports', icon: <TrendingUp className="w-4 h-4" /> },
  { value: 'onchain', label: 'Onchain', icon: <Zap className="w-4 h-4" /> },
  { value: 'web2', label: 'Web2', icon: <Users className="w-4 h-4" /> },
  { value: 'mobile', label: 'Mobile', icon: <BarChart3 className="w-4 h-4" /> },
];

const mockGames: Game[] = [
  {
    id: '1',
    name: 'CS:GO Championship',
    type: 'esports',
    queryVolume: 2450000,
    monthlyQueries: 1200000,
    costPerQuery: 1.8,
    reputation: 5,
    developer: 'Valve Gaming',
    description: 'Professional CS:GO match results and player statistics',
    schemaType: 'MatchResult',
    activeMarkets: 127,
  },
  {
    id: '2',
    name: 'OnchainChess Pro',
    type: 'onchain',
    queryVolume: 450000,
    monthlyQueries: 180000,
    costPerQuery: 1.8,
    reputation: 5,
    developer: 'ChainGame Studios',
    description: 'Fully onchain chess tournament results with ELO ratings',
    schemaType: 'TournamentResult',
    activeMarkets: 43,
  },
  {
    id: '3',
    name: 'Racing League Global',
    type: 'web2',
    queryVolume: 890000,
    monthlyQueries: 420000,
    costPerQuery: 1.8,
    reputation: 4,
    developer: 'Speedster Games',
    description: 'Global racing championship results and leaderboards',
    schemaType: 'RaceResult',
    activeMarkets: 76,
  },
  {
    id: '4',
    name: 'MOBA Arena Championship',
    type: 'esports',
    queryVolume: 1850000,
    monthlyQueries: 920000,
    costPerQuery: 1.8,
    reputation: 5,
    developer: 'Arena Games Inc',
    description: 'Professional MOBA match data with detailed player stats',
    schemaType: 'MatchResult',
    activeMarkets: 203,
  },
  {
    id: '5',
    name: 'Battle Royale Elite',
    type: 'esports',
    queryVolume: 3200000,
    monthlyQueries: 1500000,
    costPerQuery: 1.8,
    reputation: 5,
    developer: 'Elite Gaming Co',
    description: 'Battle royale tournament results with kill/death analytics',
    schemaType: 'MatchResult',
    activeMarkets: 312,
  },
  {
    id: '6',
    name: 'Crypto Kart Racing',
    type: 'onchain',
    queryVolume: 320000,
    monthlyQueries: 125000,
    costPerQuery: 1.8,
    reputation: 4,
    developer: 'OnChain Racers',
    description: 'Blockchain-based kart racing with NFT prizes',
    schemaType: 'RaceResult',
    activeMarkets: 28,
  },
  {
    id: '7',
    name: 'Mobile Legends Tournament',
    type: 'mobile',
    queryVolume: 680000,
    monthlyQueries: 310000,
    costPerQuery: 1.8,
    reputation: 4,
    developer: 'Mobile Esports Ltd',
    description: 'Mobile MOBA tournament results and rankings',
    schemaType: 'TournamentResult',
    activeMarkets: 89,
  },
  {
    id: '8',
    name: 'Poker Championship Series',
    type: 'web2',
    queryVolume: 540000,
    monthlyQueries: 220000,
    costPerQuery: 1.8,
    reputation: 5,
    developer: 'Card Masters Inc',
    description: 'Professional poker tournament results and player analytics',
    schemaType: 'TournamentResult',
    activeMarkets: 61,
  },
  {
    id: '9',
    name: 'DeFi Warriors Battle',
    type: 'onchain',
    queryVolume: 290000,
    monthlyQueries: 95000,
    costPerQuery: 1.8,
    reputation: 4,
    developer: 'DeFi Games DAO',
    description: 'Onchain PvP battle results with token rewards',
    schemaType: 'MatchResult',
    activeMarkets: 34,
  },
  {
    id: '10',
    name: 'Soccer Manager League',
    type: 'web2',
    queryVolume: 1120000,
    monthlyQueries: 480000,
    costPerQuery: 1.8,
    reputation: 5,
    developer: 'Sports Gaming Global',
    description: 'Fantasy soccer league results and player performance data',
    schemaType: 'LeagueResult',
    activeMarkets: 145,
  },
  {
    id: '11',
    name: 'Fighting Game Championship',
    type: 'esports',
    queryVolume: 720000,
    monthlyQueries: 340000,
    costPerQuery: 1.8,
    reputation: 4,
    developer: 'Combat Sports Gaming',
    description: '1v1 fighting game tournament results and combo analytics',
    schemaType: 'MatchResult',
    activeMarkets: 98,
  },
  {
    id: '12',
    name: 'Mobile Puzzle Arena',
    type: 'mobile',
    queryVolume: 410000,
    monthlyQueries: 165000,
    costPerQuery: 1.8,
    reputation: 3,
    developer: 'Casual Gaming Co',
    description: 'Competitive puzzle game leaderboards and match history',
    schemaType: 'LeaderboardResult',
    activeMarkets: 52,
  },
];

export default function GamesPage() {
  const [selectedType, setSelectedType] = useState<GameType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'volume' | 'reputation' | 'markets'>('volume');

  // Filter games
  const filteredGames = mockGames.filter((game) => {
    const matchesType = selectedType === 'all' || game.type === selectedType;
    const matchesSearch =
      searchQuery === '' ||
      game.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.developer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  // Sort games
  const sortedGames = [...filteredGames].sort((a, b) => {
    if (sortBy === 'volume') return b.queryVolume - a.queryVolume;
    if (sortBy === 'reputation') return b.reputation - a.reputation;
    if (sortBy === 'markets') return b.activeMarkets - a.activeMarkets;
    return 0;
  });

  return (
    <div className="pt-24 pb-16 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl md:text-6xl font-bold mb-4">
            <span className="gradient-text">Games Marketplace</span>
          </h1>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto">
            Browse {mockGames.length}+ games earning millions from prediction markets
          </p>
        </motion.div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="card p-4 text-center">
            <DollarSign className="w-8 h-8 text-accent mx-auto mb-2" />
            <div className="text-2xl font-mono font-bold text-white">
              ${(mockGames.reduce((sum, g) => sum + g.queryVolume * 1.44, 0) / 1000000).toFixed(1)}M
            </div>
            <p className="text-sm text-text-muted">Total Earned</p>
          </div>
          <div className="card p-4 text-center">
            <Zap className="w-8 h-8 text-primary mx-auto mb-2" />
            <div className="text-2xl font-mono font-bold text-white">
              {(mockGames.reduce((sum, g) => sum + g.queryVolume, 0) / 1000000).toFixed(1)}M
            </div>
            <p className="text-sm text-text-muted">Total Queries</p>
          </div>
          <div className="card p-4 text-center">
            <Users className="w-8 h-8 text-secondary mx-auto mb-2" />
            <div className="text-2xl font-mono font-bold text-white">
              {mockGames.reduce((sum, g) => sum + g.activeMarkets, 0)}
            </div>
            <p className="text-sm text-text-muted">Active Markets</p>
          </div>
          <div className="card p-4 text-center">
            <Gamepad2 className="w-8 h-8 text-warning mx-auto mb-2" />
            <div className="text-2xl font-mono font-bold text-white">{mockGames.length}</div>
            <p className="text-sm text-text-muted">Games Listed</p>
          </div>
        </div>

        {/* Filters */}
        <div className="card p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search games or developers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-dark-hover border border-white/10 rounded-lg text-white placeholder-text-muted focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            {/* Sort */}
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-text-muted" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-3 bg-dark-hover border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary transition-colors cursor-pointer"
              >
                <option value="volume">Highest Volume</option>
                <option value="reputation">Best Reputation</option>
                <option value="markets">Most Markets</option>
              </select>
            </div>
          </div>

          {/* Type Filters */}
          <div className="flex flex-wrap gap-2 mt-4">
            {gameTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => setSelectedType(type.value)}
                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center space-x-2 ${
                  selectedType === type.value
                    ? 'bg-gradient-primary text-white'
                    : 'bg-dark-hover text-text-secondary hover:text-white border border-white/10'
                }`}
              >
                {type.icon}
                <span>{type.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-text-secondary">
            Showing <span className="text-white font-bold">{sortedGames.length}</span> games
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-primary hover:text-primary/80 text-sm font-medium"
            >
              Clear search
            </button>
          )}
        </div>

        {/* Games Grid */}
        <AnimatePresence mode="popLayout">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedGames.map((game, index) => (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
                className="card-hover p-6 group"
              >
                {/* Game Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-1 group-hover:text-primary transition-colors">
                      {game.name}
                    </h3>
                    <p className="text-sm text-text-muted">{game.developer}</p>
                  </div>
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                      game.type === 'esports'
                        ? 'bg-primary/20 text-primary'
                        : game.type === 'onchain'
                        ? 'bg-secondary/20 text-secondary'
                        : game.type === 'web2'
                        ? 'bg-accent/20 text-accent'
                        : 'bg-warning/20 text-warning'
                    }`}
                  >
                    {game.type}
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-text-secondary mb-4 line-clamp-2">
                  {game.description}
                </p>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-dark-hover p-3 rounded-lg">
                    <div className="flex items-center space-x-2 mb-1">
                      <Zap className="w-4 h-4 text-primary" />
                      <span className="text-xs text-text-muted">Queries</span>
                    </div>
                    <p className="text-lg font-mono font-bold">
                      {(game.queryVolume / 1000000).toFixed(2)}M
                    </p>
                  </div>
                  <div className="bg-dark-hover p-3 rounded-lg">
                    <div className="flex items-center space-x-2 mb-1">
                      <DollarSign className="w-4 h-4 text-accent" />
                      <span className="text-xs text-text-muted">Earned</span>
                    </div>
                    <p className="text-lg font-mono font-bold text-accent">
                      ${(game.queryVolume * 1.44 / 1000000).toFixed(2)}M
                    </p>
                  </div>
                </div>

                {/* Reputation & Markets */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < game.reputation
                            ? 'fill-warning text-warning'
                            : 'text-dark-hover'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center space-x-1 text-sm text-text-muted">
                    <Users className="w-4 h-4" />
                    <span>{game.activeMarkets} markets</span>
                  </div>
                </div>

                {/* Schema & Cost */}
                <div className="border-t border-white/10 pt-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">Schema:</span>
                    <span className="font-mono text-primary">{game.schemaType}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-text-muted">Cost per query:</span>
                    <span className="font-mono font-bold text-white">
                      ${game.costPerQuery.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* CTA */}
                <Link
                  href={`/games/${game.id}`}
                  className="mt-4 w-full bg-gradient-primary text-white font-bold py-3 px-4 rounded-lg text-center hover:scale-105 transition-transform flex items-center justify-center"
                >
                  View Details
                  <TrendingUp className="ml-2 w-4 h-4" />
                </Link>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>

        {/* Empty State */}
        {sortedGames.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Gamepad2 className="w-16 h-16 text-text-muted mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">No games found</h3>
            <p className="text-text-secondary mb-6">
              Try adjusting your filters or search query
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedType('all');
              }}
              className="btn-secondary"
            >
              Reset Filters
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
