'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign,
  TrendingUp,
  Gamepad2,
  ArrowUpRight,
  BarChart3,
  Send,
  Plus,
  Download,
  Clock,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import CountUp from '@/components/CountUp';

type ViewMode = 'developer' | 'market';

// Mock data for charts
const revenueData = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  queries: Math.floor(Math.random() * 5000) + 1000,
  revenue: Math.floor(Math.random() * 7000) + 1000,
}));

const mockGames = [
  { id: 1, name: 'CS:GO Finals', type: 'Esports', queries: 125000, revenue: 180000, reputation: 950 },
  { id: 2, name: 'OnchainChess', type: 'Onchain', queries: 45000, revenue: 64800, reputation: 980 },
  { id: 3, name: 'Racing League', type: 'Web2', queries: 89000, revenue: 128160, reputation: 920 },
];

const mockQueries = [
  { id: 1, game: 'CS:GO Finals', matchId: '#CS-12345', time: '2m ago', cost: '$0', type: 'FREE' },
  { id: 2, game: 'OnchainChess', matchId: '#CHESS-456', time: '5m ago', cost: '$1.80', type: 'PAID' },
  { id: 3, game: 'Racing League', matchId: '#RACE-789', time: '12m ago', cost: '$1.64', type: 'PAID' },
  { id: 4, game: 'MOBA Championship', matchId: '#MOBA-321', time: '18m ago', cost: '$0', type: 'FREE' },
];

export default function DashboardPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('developer');

  return (
    <div className="pt-24 pb-16 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with View Toggle */}
        <div className="mb-8">
          <h1 className="section-title mb-4">Dashboard</h1>
          <div className="flex gap-4">
            <button
              onClick={() => setViewMode('developer')}
              className={`px-6 py-3 rounded-xl font-bold transition-all ${
                viewMode === 'developer'
                  ? 'bg-gradient-primary text-white shadow-lg shadow-primary/30'
                  : 'bg-dark-card text-text-secondary border border-white/10 hover:border-primary/50'
              }`}
            >
              Game Developer View
            </button>
            <button
              onClick={() => setViewMode('market')}
              className={`px-6 py-3 rounded-xl font-bold transition-all ${
                viewMode === 'market'
                  ? 'bg-gradient-primary text-white shadow-lg shadow-primary/30'
                  : 'bg-dark-card text-text-secondary border border-white/10 hover:border-primary/50'
              }`}
            >
              Prediction Market View
            </button>
          </div>
        </div>

        {/* Developer View */}
        {viewMode === 'developer' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {/* Revenue Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="card-hover p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-text-muted">Total Earned</span>
                  <DollarSign className="w-5 h-5 text-accent" />
                </div>
                <div className="revenue-number text-3xl mb-1">
                  $<CountUp end={373200} />
                </div>
                <div className="flex items-center text-sm text-accent">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  <span>+23.4% this month</span>
                </div>
              </div>

              <div className="card-hover p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-text-muted">Pending Withdrawal</span>
                  <Download className="w-5 h-5 text-primary" />
                </div>
                <div className="revenue-number text-3xl mb-1">
                  $<CountUp end={14400} />
                </div>
                <button className="text-sm text-primary hover:text-white transition-colors flex items-center mt-2">
                  Withdraw Now <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>

              <div className="card-hover p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-text-muted">Total Queries</span>
                  <Zap className="w-5 h-5 text-warning" />
                </div>
                <div className="revenue-number text-3xl mb-1">
                  <CountUp end={259000} separator="," />
                </div>
                <div className="text-sm text-text-muted">
                  @ $1.44 per query
                </div>
              </div>

              <div className="card-hover p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-text-muted">Active Games</span>
                  <Gamepad2 className="w-5 h-5 text-secondary" />
                </div>
                <div className="revenue-number text-3xl mb-1">
                  <CountUp end={3} />
                </div>
                <button className="text-sm text-primary hover:text-white transition-colors flex items-center mt-2">
                  <Plus className="w-4 h-4 mr-1" /> Add Game
                </button>
              </div>
            </div>

            {/* Revenue Trends Chart */}
            <div className="card mb-8 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Revenue Trends</h3>
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-primary rounded-full mr-2" />
                    <span className="text-text-muted">Queries</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-accent rounded-full mr-2" />
                    <span className="text-text-muted">Revenue ($)</span>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorQueries" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00D9FF" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00D9FF" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00FF88" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00FF88" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#252B4D" />
                  <XAxis dataKey="day" stroke="#6B7280" />
                  <YAxis stroke="#6B7280" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1A1F3A', border: '1px solid #00D9FF', borderRadius: '8px' }}
                  />
                  <Area type="monotone" dataKey="queries" stroke="#00D9FF" fill="url(#colorQueries)" />
                  <Area type="monotone" dataKey="revenue" stroke="#00FF88" fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Your Games */}
            <div className="card p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Your Games</h3>
                <button className="btn-secondary text-sm py-2 px-4">
                  <Plus className="w-4 h-4 mr-2 inline" />
                  Register New Game
                </button>
              </div>
              <div className="space-y-4">
                {mockGames.map((game) => (
                  <div
                    key={game.id}
                    className="bg-dark-hover p-4 rounded-xl border border-white/10 hover:border-primary/50 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center">
                          <Gamepad2 className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-bold">{game.name}</h4>
                          <p className="text-sm text-text-muted">{game.type}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-8 mr-8">
                        <div className="text-right">
                          <p className="text-sm text-text-muted">Queries</p>
                          <p className="font-mono text-primary font-semibold">
                            {game.queries.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-text-muted">Revenue</p>
                          <p className="font-mono text-accent font-semibold">
                            ${game.revenue.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-text-muted">Reputation</p>
                          <p className="font-mono text-warning font-semibold">
                            {game.reputation}/1000
                          </p>
                        </div>
                      </div>
                      <button className="text-primary hover:text-white transition-colors">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <button className="card-hover p-6 text-left group">
                <Send className="w-8 h-8 text-primary mb-3 group-hover:scale-110 transition-transform" />
                <h4 className="font-bold mb-2">Submit Result</h4>
                <p className="text-sm text-text-muted">Submit a single match result</p>
              </button>

              <button className="card-hover p-6 text-left group">
                <BarChart3 className="w-8 h-8 text-accent mb-3 group-hover:scale-110 transition-transform" />
                <h4 className="font-bold mb-2">Batch Submit</h4>
                <p className="text-sm text-text-muted">Submit multiple results (60% gas savings)</p>
              </button>

              <button className="card-hover p-6 text-left group">
                <Download className="w-8 h-8 text-warning mb-3 group-hover:scale-110 transition-transform" />
                <h4 className="font-bold mb-2">Withdraw Revenue</h4>
                <p className="text-sm text-text-muted">Claim your $14,400 earnings</p>
              </button>
            </div>
          </motion.div>
        )}

        {/* Prediction Market View */}
        {viewMode === 'market' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {/* Balance Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="card-hover p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-text-muted">Prepaid Balance</span>
                  <DollarSign className="w-5 h-5 text-accent" />
                </div>
                <div className="revenue-number text-3xl mb-1">
                  <CountUp end={115.5} decimals={1} /> BNB
                </div>
                <div className="text-sm text-text-muted">
                  ~$69,300 @ $600/BNB
                </div>
              </div>

              <div className="card-hover p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-text-muted">Bonus Received</span>
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <div className="revenue-number text-3xl mb-1">
                  <CountUp end={15} /> BNB
                </div>
                <div className="text-sm text-accent">
                  15% volume bonus
                </div>
              </div>

              <div className="card-hover p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-text-muted">Free Queries Today</span>
                  <Zap className="w-5 h-5 text-warning" />
                </div>
                <div className="revenue-number text-3xl mb-1">
                  <CountUp end={27} /> / 50
                </div>
                <div className="text-sm text-text-muted">
                  Resets in 8 hours
                </div>
              </div>

              <div className="card-hover p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-text-muted">Total Queries</span>
                  <BarChart3 className="w-5 h-5 text-secondary" />
                </div>
                <div className="revenue-number text-3xl mb-1">
                  <CountUp end={12500} separator="," />
                </div>
                <div className="text-sm text-text-muted">
                  Avg cost: $1.64
                </div>
              </div>
            </div>

            {/* Deposit Calculator */}
            <div className="card p-6 mb-8 glow-box">
              <h3 className="text-xl font-bold mb-6">Deposit Funds</h3>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-sm text-text-muted mb-2">Deposit Amount (BNB)</label>
                  <input
                    type="number"
                    placeholder="100"
                    className="w-full bg-dark-hover border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-xl focus:border-primary outline-none transition-colors"
                  />
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-text-muted">Your deposit:</span>
                      <span className="font-mono text-white">100 BNB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Volume bonus (15%):</span>
                      <span className="font-mono text-accent">+15 BNB</span>
                    </div>
                    <div className="h-px bg-white/10 my-2" />
                    <div className="flex justify-between">
                      <span className="text-text-muted font-semibold">Total credit:</span>
                      <span className="font-mono text-primary text-lg font-bold">115 BNB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Queries enabled:</span>
                      <span className="font-mono text-white">~38,333</span>
                    </div>
                  </div>
                </div>
                <div className="bg-dark-hover rounded-xl p-6 border border-primary/30">
                  <h4 className="font-bold mb-4">Volume Bonus Tiers</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">10+ BNB</span>
                      <span className="text-sm text-accent">+5% bonus</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">50+ BNB</span>
                      <span className="text-sm text-accent">+10% bonus</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold">100+ BNB</span>
                      <span className="text-sm text-accent font-bold">+15% bonus ✨</span>
                    </div>
                  </div>
                  <button className="btn-primary w-full mt-6">
                    Deposit 100 BNB
                  </button>
                </div>
              </div>
            </div>

            {/* Usage Stats */}
            <div className="card p-6 mb-8">
              <h3 className="text-xl font-bold mb-6">Usage Statistics</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={revenueData.slice(0, 15)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#252B4D" />
                  <XAxis dataKey="day" stroke="#6B7280" />
                  <YAxis stroke="#6B7280" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1A1F3A', border: '1px solid #00D9FF', borderRadius: '8px' }}
                  />
                  <Line type="monotone" dataKey="queries" stroke="#00D9FF" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Query History */}
            <div className="card p-6">
              <h3 className="text-xl font-bold mb-6">Recent Queries</h3>
              <div className="space-y-3">
                {mockQueries.map((query) => (
                  <div
                    key={query.id}
                    className="bg-dark-hover p-4 rounded-xl border border-white/10 hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <Clock className="w-5 h-5 text-text-muted" />
                        <div>
                          <p className="font-semibold">{query.game}</p>
                          <p className="text-sm text-text-muted font-mono">{query.matchId}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-6">
                        <div className="text-right">
                          <p className="text-sm text-text-muted">Cost</p>
                          <p className={`font-mono font-semibold ${query.type === 'FREE' ? 'text-accent' : 'text-primary'}`}>
                            {query.cost}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-text-muted">Time</p>
                          <p className="text-sm font-mono">{query.time}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="text-primary hover:text-white transition-colors text-sm mt-4 flex items-center">
                View All History <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
