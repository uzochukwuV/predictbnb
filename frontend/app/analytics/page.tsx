'use client';

import { motion } from 'framer-motion';
import {
  TrendingUp,
  DollarSign,
  Zap,
  Users,
  Gamepad2,
  Award,
  BarChart3,
  Activity,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import CountUp from '@/components/CountUp';

// Mock data for growth chart
const growthData = [
  { date: 'Jan', queries: 1200000, volume: 2160000, developers: 45 },
  { date: 'Feb', queries: 1850000, volume: 3330000, developers: 62 },
  { date: 'Mar', queries: 2400000, volume: 4320000, developers: 78 },
  { date: 'Apr', queries: 3100000, volume: 5580000, developers: 94 },
  { date: 'May', queries: 4200000, volume: 7560000, developers: 108 },
  { date: 'Jun', queries: 5800000, volume: 10440000, developers: 127 },
  { date: 'Jul', queries: 7200000, volume: 12960000, developers: 143 },
  { date: 'Aug', queries: 8900000, volume: 16020000, developers: 156 },
  { date: 'Sep', queries: 10500000, volume: 18900000, developers: 172 },
];

// Top earning developers
const topDevelopers = [
  {
    rank: 1,
    name: 'Elite Gaming Co',
    game: 'Battle Royale Elite',
    earnings: 4608000,
    queries: 3200000,
    growth: 42,
  },
  {
    rank: 2,
    name: 'Valve Gaming',
    game: 'CS:GO Championship',
    earnings: 3528000,
    queries: 2450000,
    growth: 38,
  },
  {
    rank: 3,
    name: 'Arena Games Inc',
    game: 'MOBA Arena Championship',
    earnings: 2664000,
    queries: 1850000,
    growth: 35,
  },
  {
    rank: 4,
    name: 'Sports Gaming Global',
    game: 'Soccer Manager League',
    earnings: 1612800,
    queries: 1120000,
    growth: 28,
  },
  {
    rank: 5,
    name: 'Speedster Games',
    game: 'Racing League Global',
    earnings: 1281600,
    queries: 890000,
    growth: 22,
  },
  {
    rank: 6,
    name: 'Combat Sports Gaming',
    game: 'Fighting Game Championship',
    earnings: 1036800,
    queries: 720000,
    growth: 19,
  },
  {
    rank: 7,
    name: 'Mobile Esports Ltd',
    game: 'Mobile Legends Tournament',
    earnings: 979200,
    queries: 680000,
    growth: 31,
  },
  {
    rank: 8,
    name: 'Card Masters Inc',
    game: 'Poker Championship Series',
    earnings: 777600,
    queries: 540000,
    growth: 25,
  },
];

// Most queried games
const topGames = [
  { rank: 1, name: 'Battle Royale Elite', type: 'Esports', queries: 3200000, markets: 312 },
  { rank: 2, name: 'CS:GO Championship', type: 'Esports', queries: 2450000, markets: 203 },
  { rank: 3, name: 'MOBA Arena Championship', type: 'Esports', queries: 1850000, markets: 145 },
  { rank: 4, name: 'Soccer Manager League', type: 'Web2', queries: 1120000, markets: 127 },
  { rank: 5, name: 'Racing League Global', type: 'Web2', queries: 890000, markets: 98 },
  { rank: 6, name: 'Fighting Game Championship', type: 'Esports', queries: 720000, markets: 89 },
  { rank: 7, name: 'Mobile Legends Tournament', type: 'Mobile', queries: 680000, markets: 76 },
  { rank: 8, name: 'Poker Championship Series', type: 'Web2', queries: 540000, markets: 61 },
];

// Monthly comparison data
const monthlyData = [
  { month: 'Jul', thisYear: 7200000, lastYear: 2400000 },
  { month: 'Aug', thisYear: 8900000, lastYear: 3100000 },
  { month: 'Sep', thisYear: 10500000, lastYear: 4200000 },
];

export default function AnalyticsPage() {
  const totalQueries = 10500000;
  const totalVolume = 18900000;
  const totalEarnings = 15120000;
  const activeGames = 127;

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
            <span className="gradient-text">Protocol Analytics</span>
          </h1>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto">
            Real-time insights into PredictBNB's gaming oracle ecosystem
          </p>
        </motion.div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
            className="card glow-box p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <Zap className="w-10 h-10 text-primary" />
              <div className="text-sm text-accent font-bold">+23% MoM</div>
            </div>
            <div className="text-4xl font-mono font-bold mb-2">
              <CountUp end={totalQueries} duration={2} />
            </div>
            <p className="text-text-secondary">Total Queries Processed</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card glow-box p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="w-10 h-10 text-accent" />
              <div className="text-sm text-accent font-bold">+31% MoM</div>
            </div>
            <div className="text-4xl font-mono font-bold mb-2">
              $<CountUp end={totalVolume / 1000000} duration={2} />M
            </div>
            <p className="text-text-secondary">Total Volume (USD)</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card glow-box p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-10 h-10 text-secondary" />
              <div className="text-sm text-accent font-bold">+28% MoM</div>
            </div>
            <div className="text-4xl font-mono font-bold mb-2">
              $<CountUp end={totalEarnings / 1000000} duration={2} />M
            </div>
            <p className="text-text-secondary">Paid to Developers</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card glow-box p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <Gamepad2 className="w-10 h-10 text-warning" />
              <div className="text-sm text-accent font-bold">+18 New</div>
            </div>
            <div className="text-4xl font-mono font-bold mb-2">
              <CountUp end={activeGames} duration={2} />
            </div>
            <p className="text-text-secondary">Active Games</p>
          </motion.div>
        </div>

        {/* Growth Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card p-6 mb-12"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Protocol Growth</h2>
              <p className="text-text-secondary">Query volume and developer earnings over time</p>
            </div>
            <Activity className="w-8 h-8 text-primary" />
          </div>

          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData}>
                <defs>
                  <linearGradient id="queriesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00D9FF" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00D9FF" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF00FF" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FF00FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#252B4D" />
                <XAxis dataKey="date" stroke="#6B7280" />
                <YAxis stroke="#6B7280" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1A1F3A',
                    border: '1px solid #00D9FF',
                    borderRadius: '8px',
                  }}
                  formatter={(value: any) => [value.toLocaleString(), '']}
                />
                <Area
                  type="monotone"
                  dataKey="queries"
                  stroke="#00D9FF"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#queriesGradient)"
                  name="Queries"
                />
                <Area
                  type="monotone"
                  dataKey="volume"
                  stroke="#FF00FF"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#volumeGradient)"
                  name="Volume ($)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center space-x-8 mt-6">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-primary rounded" />
              <span className="text-sm text-text-secondary">Query Volume</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-secondary rounded" />
              <span className="text-sm text-text-secondary">Volume (USD)</span>
            </div>
          </div>
        </motion.div>

        {/* Year-over-Year Comparison */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card p-6 mb-12"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Year-over-Year Growth</h2>
              <p className="text-text-secondary">Comparing this year to last year</p>
            </div>
            <BarChart3 className="w-8 h-8 text-accent" />
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252B4D" />
                <XAxis dataKey="month" stroke="#6B7280" />
                <YAxis stroke="#6B7280" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1A1F3A',
                    border: '1px solid #00FF88',
                    borderRadius: '8px',
                  }}
                  formatter={(value: any) => [value.toLocaleString(), '']}
                />
                <Line
                  type="monotone"
                  dataKey="thisYear"
                  stroke="#00FF88"
                  strokeWidth={3}
                  dot={{ fill: '#00FF88', r: 5 }}
                  name="2024"
                />
                <Line
                  type="monotone"
                  dataKey="lastYear"
                  stroke="#6B7280"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: '#6B7280', r: 3 }}
                  name="2023"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Growth Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="text-center p-4 bg-dark-hover rounded-lg">
              <p className="text-sm text-text-muted mb-1">Growth Rate</p>
              <p className="text-2xl font-mono font-bold text-accent">+150%</p>
            </div>
            <div className="text-center p-4 bg-dark-hover rounded-lg">
              <p className="text-sm text-text-muted mb-1">Sep Queries</p>
              <p className="text-2xl font-mono font-bold">10.5M</p>
            </div>
            <div className="text-center p-4 bg-dark-hover rounded-lg">
              <p className="text-sm text-text-muted mb-1">vs Last Year</p>
              <p className="text-2xl font-mono font-bold text-accent">+6.3M</p>
            </div>
          </div>
        </motion.div>

        {/* Leaderboards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Top Earning Developers */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="card p-6"
          >
            <div className="flex items-center space-x-3 mb-6">
              <Award className="w-8 h-8 text-warning" />
              <div>
                <h2 className="text-2xl font-bold">Top Earning Developers</h2>
                <p className="text-text-secondary text-sm">Ranked by total revenue</p>
              </div>
            </div>

            <div className="space-y-3">
              {topDevelopers.map((dev) => (
                <div
                  key={dev.rank}
                  className="flex items-center justify-between p-4 bg-dark-hover rounded-lg hover:bg-dark-card transition-colors border border-transparent hover:border-accent/30"
                >
                  <div className="flex items-center space-x-4 flex-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        dev.rank === 1
                          ? 'bg-warning/20 text-warning'
                          : dev.rank === 2
                          ? 'bg-text-muted/20 text-text-muted'
                          : dev.rank === 3
                          ? 'bg-accent/20 text-accent'
                          : 'bg-primary/20 text-primary'
                      }`}
                    >
                      {dev.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{dev.name}</p>
                      <p className="text-sm text-text-muted truncate">{dev.game}</p>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-mono font-bold text-accent">
                      ${(dev.earnings / 1000000).toFixed(2)}M
                    </p>
                    <p className="text-xs text-text-muted">{dev.queries.toLocaleString()} queries</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 text-center">
              <button className="text-primary hover:text-primary/80 font-medium text-sm">
                View Full Leaderboard →
              </button>
            </div>
          </motion.div>

          {/* Most Queried Games */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 }}
            className="card p-6"
          >
            <div className="flex items-center space-x-3 mb-6">
              <TrendingUp className="w-8 h-8 text-primary" />
              <div>
                <h2 className="text-2xl font-bold">Most Queried Games</h2>
                <p className="text-text-secondary text-sm">Ranked by query volume</p>
              </div>
            </div>

            <div className="space-y-3">
              {topGames.map((game) => (
                <div
                  key={game.rank}
                  className="flex items-center justify-between p-4 bg-dark-hover rounded-lg hover:bg-dark-card transition-colors border border-transparent hover:border-primary/30"
                >
                  <div className="flex items-center space-x-4 flex-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        game.rank === 1
                          ? 'bg-warning/20 text-warning'
                          : game.rank === 2
                          ? 'bg-text-muted/20 text-text-muted'
                          : game.rank === 3
                          ? 'bg-accent/20 text-accent'
                          : 'bg-secondary/20 text-secondary'
                      }`}
                    >
                      {game.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{game.name}</p>
                      <p className="text-sm text-text-muted">{game.type}</p>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-mono font-bold text-primary">
                      {(game.queries / 1000000).toFixed(2)}M
                    </p>
                    <p className="text-xs text-text-muted">{game.markets} markets</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 text-center">
              <button className="text-primary hover:text-primary/80 font-medium text-sm">
                Browse All Games →
              </button>
            </div>
          </motion.div>
        </div>

        {/* Additional Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="card p-8 text-center"
        >
          <h2 className="text-3xl font-bold mb-8 gradient-text">
            Ecosystem Statistics
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <Users className="w-8 h-8 text-accent mx-auto mb-3" />
              <div className="text-3xl font-mono font-bold mb-1">4,823</div>
              <p className="text-text-muted text-sm">Active Users</p>
            </div>
            <div>
              <Zap className="w-8 h-8 text-primary mx-auto mb-3" />
              <div className="text-3xl font-mono font-bold mb-1">15.2s</div>
              <p className="text-text-muted text-sm">Avg Query Time</p>
            </div>
            <div>
              <BarChart3 className="w-8 h-8 text-secondary mx-auto mb-3" />
              <div className="text-3xl font-mono font-bold mb-1">1,847</div>
              <p className="text-text-muted text-sm">Active Markets</p>
            </div>
            <div>
              <DollarSign className="w-8 h-8 text-warning mx-auto mb-3" />
              <div className="text-3xl font-mono font-bold mb-1">$1.44</div>
              <p className="text-text-muted text-sm">Avg Revenue/Query</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
