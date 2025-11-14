'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, Zap, Gamepad2, TrendingUp, Activity as ActivityIcon } from 'lucide-react';

interface Activity {
  id: string;
  type: 'earn' | 'query' | 'register' | 'withdraw';
  message: string;
  time: string;
  amount?: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const generateMockActivities = (): Activity[] => {
  const developers = ['Developer Alpha', 'GameStudio X', 'Team Velocity', 'Esports Pro', 'IndieDev'];
  const games = ['CS:GO Finals', 'OnchainChess', 'Racing League', 'MOBA Championship', 'Battle Royale'];

  const activities: Activity[] = [];

  for (let i = 0; i < 5; i++) {
    const types: Activity['type'][] = ['earn', 'query', 'register', 'withdraw'];
    const type = types[Math.floor(Math.random() * types.length)];
    const dev = developers[Math.floor(Math.random() * developers.length)];
    const game = games[Math.floor(Math.random() * games.length)];
    const amount = Math.floor(Math.random() * 10000) + 100;
    const queries = Math.floor(Math.random() * 500) + 10;

    let message = '';
    let icon: React.ReactNode = null;
    let color = '';
    let bgColor = '';

    switch (type) {
      case 'earn':
        message = `${dev} earned $${amount.toLocaleString()} from ${queries} queries`;
        icon = <DollarSign className="w-5 h-5" />;
        color = 'text-accent-600';
        bgColor = 'bg-accent-100';
        break;
      case 'query':
        message = `${queries} queries to ${game}`;
        icon = <Zap className="w-5 h-5" />;
        color = 'text-primary-600';
        bgColor = 'bg-primary-100';
        break;
      case 'register':
        message = `New game registered: "${game}"`;
        icon = <Gamepad2 className="w-5 h-5" />;
        color = 'text-secondary-600';
        bgColor = 'bg-secondary-100';
        break;
      case 'withdraw':
        message = `${dev} withdrew $${amount.toLocaleString()}`;
        icon = <TrendingUp className="w-5 h-5" />;
        color = 'text-warning-600';
        bgColor = 'bg-warning-100';
        break;
    }

    activities.push({
      id: `${Date.now()}-${i}`,
      type,
      message,
      time: `${Math.floor(Math.random() * 60)}s ago`,
      amount: type === 'earn' || type === 'withdraw' ? `$${amount.toLocaleString()}` : undefined,
      icon,
      color,
      bgColor,
    });
  }

  return activities;
};

export default function LiveFeed() {
  const [activities, setActivities] = useState<Activity[]>(generateMockActivities());

  useEffect(() => {
    const interval = setInterval(() => {
      const newActivity = generateMockActivities()[0];
      setActivities((prev) => [newActivity, ...prev.slice(0, 4)]);
    }, 5000); // New activity every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="card shadow-soft-xl relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary-100">
            <ActivityIcon className="w-5 h-5 text-primary-600" />
          </div>
          <h3 className="text-2xl font-bold text-neutral-900">Live Activity</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-2.5 h-2.5 bg-accent-500 rounded-full animate-pulse" />
            <div className="absolute inset-0 w-2.5 h-2.5 bg-accent-500 rounded-full animate-ping" />
          </div>
          <span className="text-sm text-neutral-600 font-medium">Live Updates</span>
        </div>
      </div>

      {/* Activity List */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {activities.map((activity) => (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              transition={{ duration: 0.3, type: "spring", stiffness: 500, damping: 30 }}
              className="group flex items-center justify-between p-4 bg-gradient-to-br from-white to-neutral-50 border-2 border-neutral-200 rounded-2xl hover:border-primary-300 hover:shadow-soft-md transition-all"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className={`flex-shrink-0 p-2.5 rounded-xl ${activity.bgColor} ${activity.color} group-hover:scale-110 transition-transform`}>
                  {activity.icon}
                </div>
                <p className="text-sm text-neutral-700 flex-1 font-medium line-clamp-1">
                  {activity.message}
                </p>
              </div>

              <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                {activity.amount && (
                  <span className="font-mono text-accent-600 font-bold text-base">
                    {activity.amount}
                  </span>
                )}
                <span className="text-xs text-neutral-500 whitespace-nowrap bg-neutral-100 px-2.5 py-1 rounded-full font-medium">
                  {activity.time}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Footer Note */}
      <div className="mt-6 pt-6 border-t border-neutral-200">
        <p className="text-xs text-neutral-500 text-center">
          Real-time activity from the PredictBNB network. Updates every 5 seconds.
        </p>
      </div>
    </div>
  );
}
