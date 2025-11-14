'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Zap,
  DollarSign,
  TrendingUp,
  Shield,
  Clock,
  Users,
  ArrowRight,
  BarChart3,
  Gamepad2,
  Check,
  Sparkles,
  Target,
} from 'lucide-react';
import CountUp from '@/components/CountUp';
import RevenueCalculator from '@/components/RevenueCalculator';
import LiveFeed from '@/components/LiveFeed';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export default function HomePage() {
  return (
    <div className="overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-200/30 rounded-full filter blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary-200/30 rounded-full filter blur-3xl" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-mesh -z-10" />
        </div>

        <div className="container-custom">
          <motion.div
            className="max-w-5xl mx-auto text-center"
            initial="initial"
            animate="animate"
            variants={stagger}
          >
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-50 border border-primary-200 text-primary-700 font-medium mb-8">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm">Built for BNB Chain Gaming</span>
            </motion.div>

            <motion.h1 variants={fadeInUp} className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 tracking-tight">
              Turn Your Game Data Into{' '}
              <span className="gradient-text block mt-2">
                $72 Million Revenue
              </span>
            </motion.h1>

            <motion.p variants={fadeInUp} className="section-subtitle mb-12">
              The first gaming oracle infrastructure that pays developers $1.44 per query.
              Built for esports, prediction markets, and Web3 gaming.
            </motion.p>

            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4 justify-center mb-20">
              <Link href="/dashboard" className="btn-primary group">
                Get Started Free
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="#calculator" className="btn-secondary">
                Calculate Revenue
                <DollarSign className="ml-2 w-5 h-5" />
              </Link>
            </motion.div>

            {/* Stats */}
            <motion.div
              variants={stagger}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto"
            >
              <motion.div variants={fadeInUp} className="stat-card">
                <div className="flex items-center justify-center mb-3">
                  <div className="p-3 rounded-2xl bg-accent-100">
                    <DollarSign className="w-6 h-6 text-accent-600" />
                  </div>
                </div>
                <div className="text-4xl font-bold mb-2 gradient-accent">
                  $<CountUp end={14400000 / 1000000} decimals={1} />M
                </div>
                <p className="text-neutral-600 font-medium">Paid to Developers</p>
              </motion.div>

              <motion.div variants={fadeInUp} className="stat-card">
                <div className="flex items-center justify-center mb-3">
                  <div className="p-3 rounded-2xl bg-primary-100">
                    <Zap className="w-6 h-6 text-primary-600" />
                  </div>
                </div>
                <div className="text-4xl font-bold mb-2 gradient-text">
                  <CountUp end={10.5} decimals={1} />M
                </div>
                <p className="text-neutral-600 font-medium">Queries Processed</p>
              </motion.div>

              <motion.div variants={fadeInUp} className="stat-card">
                <div className="flex items-center justify-center mb-3">
                  <div className="p-3 rounded-2xl bg-secondary-100">
                    <Gamepad2 className="w-6 h-6 text-secondary-600" />
                  </div>
                </div>
                <div className="text-4xl font-bold mb-2 text-secondary-600">
                  <CountUp end={127} />
                </div>
                <p className="text-neutral-600 font-medium">Games Integrated</p>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="section-padding bg-neutral-50">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="section-title">How PredictBNB Works</h2>
            <p className="section-subtitle">
              Three simple steps to start earning from your game data
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Step 1 */}
            <div className="feature-card text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-100 mb-6 group-hover:bg-primary-500 transition-colors">
                <Gamepad2 className="w-8 h-8 text-primary-600 group-hover:text-white transition-colors" />
              </div>
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-500 text-white font-bold text-sm mb-4">
                1
              </div>
              <h3 className="text-2xl font-bold mb-4">Register Your Game</h3>
              <p className="text-neutral-600 mb-6">
                Stake 0.1 BNB to register your game on the oracle. Define your data schema and start submitting results.
              </p>
              <div className="inline-flex items-center text-sm font-medium text-primary-600">
                <Check className="w-4 h-4 mr-2" />
                One-time setup
              </div>
            </div>

            {/* Step 2 */}
            <div className="feature-card text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-100 mb-6 group-hover:bg-accent-500 transition-colors">
                <BarChart3 className="w-8 h-8 text-accent-600 group-hover:text-white transition-colors" />
              </div>
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-accent-500 text-white font-bold text-sm mb-4">
                2
              </div>
              <h3 className="text-2xl font-bold mb-4">Submit Game Results</h3>
              <p className="text-neutral-600 mb-6">
                Use our SDK or submit directly onchain. Batch submissions available for gas savings.
              </p>
              <div className="inline-flex items-center text-sm font-medium text-accent-600">
                <Check className="w-4 h-4 mr-2" />
                99% gas savings
              </div>
            </div>

            {/* Step 3 */}
            <div className="feature-card text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-secondary-100 mb-6 group-hover:bg-secondary-500 transition-colors">
                <DollarSign className="w-8 h-8 text-secondary-600 group-hover:text-white transition-colors" />
              </div>
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-secondary-500 text-white font-bold text-sm mb-4">
                3
              </div>
              <h3 className="text-2xl font-bold mb-4">Earn Per Query</h3>
              <p className="text-neutral-600 mb-6">
                Earn $1.44 for every query made to your game data. Withdraw anytime with no minimum.
              </p>
              <div className="inline-flex items-center text-sm font-medium text-secondary-600">
                <Check className="w-4 h-4 mr-2" />
                Instant payouts
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Revenue Calculator */}
      <section id="calculator" className="section-padding">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="section-title gradient-text">
              Calculate Your Potential Revenue
            </h2>
            <p className="section-subtitle">
              See how much you could earn based on your game's popularity
            </p>
          </div>

          <RevenueCalculator />
        </div>
      </section>

      {/* Features */}
      <section className="section-padding bg-neutral-50">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="section-title">Why Developers Choose PredictBNB</h2>
            <p className="section-subtitle">
              The most powerful gaming oracle infrastructure on BNB Chain
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="feature-card">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-100 mb-4">
                <Clock className="w-6 h-6 text-primary-600" />
              </div>
              <h3 className="text-xl font-bold mb-3">96x Faster Resolution</h3>
              <p className="text-neutral-600">
                15-minute dispute window vs 24-hour industry standard. Get paid faster, build better products.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="feature-card">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent-100 mb-4">
                <DollarSign className="w-6 h-6 text-accent-600" />
              </div>
              <h3 className="text-xl font-bold mb-3">Usage-Based Revenue</h3>
              <p className="text-neutral-600">
                Earn $1.44 per query. Popular games earn millions, fair distribution based on actual usage.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="feature-card">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-secondary-100 mb-4">
                <Zap className="w-6 h-6 text-secondary-600" />
              </div>
              <h3 className="text-xl font-bold mb-3">99% Gas Savings</h3>
              <p className="text-neutral-600">
                Prepaid balance model means prediction markets save 99% on gas. More queries = more revenue for you.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="feature-card">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-100 mb-4">
                <Shield className="w-6 h-6 text-primary-600" />
              </div>
              <h3 className="text-xl font-bold mb-3">Secure & Verified</h3>
              <p className="text-neutral-600">
                Optimistic oracle with stake/slash mechanism. 15-min dispute window ensures data accuracy.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="feature-card">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent-100 mb-4">
                <TrendingUp className="w-6 h-6 text-accent-600" />
              </div>
              <h3 className="text-xl font-bold mb-3">Volume Bonuses</h3>
              <p className="text-neutral-600">
                Markets get 5-15% bonus on deposits. More incentive to query, more revenue for developers.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="feature-card">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-secondary-100 mb-4">
                <Target className="w-6 h-6 text-secondary-600" />
              </div>
              <h3 className="text-xl font-bold mb-3">Free Tier Available</h3>
              <p className="text-neutral-600">
                50 free queries per day for prediction markets. Low barrier to entry drives more adoption.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Live Activity */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="section-title">Live Activity Feed</h2>
            <p className="section-subtitle">
              See real-time earnings and activity across the network
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <LiveFeed />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-padding bg-gradient-to-br from-primary-500 to-secondary-500 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-mesh opacity-30" />

        <div className="container-custom relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Ready to Monetize Your Game Data?
            </h2>
            <p className="text-xl md:text-2xl mb-12 text-white/90">
              Join 127+ games earning millions from prediction markets
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold bg-white text-primary-600 rounded-2xl shadow-soft-xl hover:shadow-soft-2xl hover:-translate-y-0.5 transition-all duration-300"
              >
                Launch Dashboard
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <Link
                href="/games"
                className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold bg-white/10 backdrop-blur-xl text-white border-2 border-white/30 rounded-2xl hover:bg-white/20 hover:-translate-y-0.5 transition-all duration-300"
              >
                Browse Games
                <Gamepad2 className="ml-2 w-5 h-5" />
              </Link>
            </div>

            <div className="mt-12 flex items-center justify-center gap-8 text-sm text-white/80">
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5" />
                <span>Setup in 5 minutes</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5" />
                <span>Free tier available</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
