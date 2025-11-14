'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, Sparkles, Calculator } from 'lucide-react';
import Link from 'next/link';

const gameTypes = [
  { value: 'esports', label: 'Esports', queriesPerMatch: 300, color: 'primary' },
  { value: 'onchain', label: 'Onchain', queriesPerMatch: 50, color: 'secondary' },
  { value: 'mobile', label: 'Mobile', queriesPerMatch: 30, color: 'accent' },
  { value: 'web2', label: 'Web2', queriesPerMatch: 150, color: 'primary' },
];

export default function RevenueCalculator() {
  const [gameType, setGameType] = useState(gameTypes[0]);
  const [dailyMatches, setDailyMatches] = useState(500);
  const [queriesPerMatch, setQueriesPerMatch] = useState(gameTypes[0].queriesPerMatch);

  const monthlyQueries = dailyMatches * queriesPerMatch * 30;
  const revenuePerQuery = 1.44; // $1.44 per query
  const monthlyRevenue = Math.round(monthlyQueries * revenuePerQuery);
  const yearlyRevenue = monthlyRevenue * 12;

  const handleGameTypeChange = (type: typeof gameTypes[0]) => {
    setGameType(type);
    setQueriesPerMatch(type.queriesPerMatch);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="card-gradient shadow-soft-xl relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-100 rounded-full filter blur-3xl opacity-30 -z-10" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary-100 rounded-full filter blur-3xl opacity-30 -z-10" />

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 rounded-2xl bg-primary-100">
              <Calculator className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-neutral-900">Revenue Calculator</h3>
              <p className="text-neutral-600">Estimate your potential earnings</p>
            </div>
          </div>

          {/* Game Type Selection */}
          <div className="mb-8">
            <label className="block text-sm font-semibold text-neutral-700 mb-4">
              Select Your Game Type
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {gameTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => handleGameTypeChange(type)}
                  className={`px-4 py-3 rounded-xl font-medium transition-all ${
                    gameType.value === type.value
                      ? 'bg-gradient-primary text-white shadow-soft-md'
                      : 'bg-white text-neutral-600 border-2 border-neutral-200 hover:border-primary-300 hover:bg-primary-50'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Daily Matches Slider */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <label className="text-sm font-semibold text-neutral-700">
                Daily Matches
              </label>
              <span className="text-2xl font-mono font-bold text-primary-600">
                {dailyMatches.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="10000"
              step="10"
              value={dailyMatches}
              onChange={(e) => setDailyMatches(Number(e.target.value))}
              className="w-full h-2 bg-neutral-200 rounded-full appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-neutral-500 mt-2">
              <span>10</span>
              <span>10,000</span>
            </div>
          </div>

          {/* Queries Per Match Slider */}
          <div className="mb-10">
            <div className="flex justify-between items-center mb-4">
              <label className="text-sm font-semibold text-neutral-700">
                Queries Per Match
              </label>
              <span className="text-2xl font-mono font-bold text-secondary-600">
                {queriesPerMatch.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="1000"
              step="10"
              value={queriesPerMatch}
              onChange={(e) => setQueriesPerMatch(Number(e.target.value))}
              className="w-full h-2 bg-neutral-200 rounded-full appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-neutral-500 mt-2">
              <span>10</span>
              <span>1,000</span>
            </div>
          </div>

          {/* Results */}
          <motion.div
            key={monthlyRevenue}
            initial={{ scale: 0.98, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="bg-gradient-to-br from-primary-500 to-secondary-500 rounded-3xl p-8 md:p-10 shadow-soft-2xl relative overflow-hidden"
          >
            {/* Sparkle decoration */}
            <div className="absolute top-4 right-4">
              <Sparkles className="w-8 h-8 text-white/30" />
            </div>

            <div className="text-center mb-8">
              <p className="text-sm text-white/80 uppercase tracking-wider font-semibold mb-3">
                Your Monthly Revenue
              </p>
              <div className="text-6xl md:text-7xl lg:text-8xl font-mono font-bold text-white mb-2">
                ${monthlyRevenue.toLocaleString()}
              </div>
              <p className="text-white/70 text-sm">
                Based on {monthlyQueries.toLocaleString()} queries/month
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="text-center p-5 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20">
                <p className="text-sm text-white/70 mb-2 font-medium">Monthly Queries</p>
                <p className="text-3xl font-mono font-bold text-white">
                  {(monthlyQueries / 1000).toFixed(1)}K
                </p>
              </div>
              <div className="text-center p-5 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20">
                <p className="text-sm text-white/70 mb-2 font-medium">Yearly Revenue</p>
                <p className="text-3xl font-mono font-bold text-white">
                  ${(yearlyRevenue / 1000000).toFixed(1)}M
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/dashboard"
                className="flex-1 bg-white text-primary-600 font-bold py-4 px-6 rounded-2xl text-center hover:bg-neutral-50 hover:shadow-soft-xl hover:-translate-y-0.5 transition-all flex items-center justify-center group"
              >
                <DollarSign className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                Register Your Game
              </Link>
              <Link
                href="/games"
                className="flex-1 bg-white/10 backdrop-blur-xl border-2 border-white/30 text-white font-bold py-4 px-6 rounded-2xl text-center hover:bg-white/20 hover:-translate-y-0.5 transition-all flex items-center justify-center group"
              >
                <TrendingUp className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                View All Games
              </Link>
            </div>
          </motion.div>

          {/* Fine Print */}
          <p className="text-xs text-neutral-500 text-center mt-6 leading-relaxed">
            * Calculations based on $1.44 per query (80% of $1.80 total fee).
            Actual revenue varies based on query volume. Popular games earn more with our usage-based model!
          </p>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
          border: 3px solid white;
        }

        .slider::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);
          cursor: pointer;
          border: 3px solid white;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }

        .slider::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }

        .slider::-moz-range-thumb:hover {
          transform: scale(1.1);
        }
      `}</style>
    </div>
  );
}
