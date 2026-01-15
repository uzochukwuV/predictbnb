import { HeroSection } from "@/components/hero-section"
import { FeaturesSection } from "@/components/features-section"
import { HowItWorksSection } from "@/components/how-it-works-section"
import { StatsSection } from "@/components/stats-section"
import { RevenueSection } from "@/components/revenue-section"
import { SideNav } from "@/components/side-nav"

export default function Page() {
  return (
    <main className="relative min-h-screen">
      {/* <SideNav /> */}
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />
         <div className="w-full bg-gradient-to-r from-blue-600 to-purple-600 py-4 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          <div className="text-white text-sm font-medium animate-marquee whitespace-nowrap">
            🎉 Welcome to our platform! Coming out soon - latest features • New: Phantasma Sports Book powered by Chainlink VRF • Place bets with provably fair randomness • Try it now!
          </div>
          <button className="text-white hover:text-gray-200 text-sm font-medium">
            Learn More →
          </button>
        </div>
      </div>
    </div>
      <div className="relative z-10">
        <HeroSection />
        <StatsSection />
        <FeaturesSection />
       
        <HowItWorksSection />
        <RevenueSection />
      </div>
    </main>
  )
}


