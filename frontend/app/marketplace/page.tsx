"use client"

import { useEffect, useRef, useState } from "react"
import { SideNav } from "@/components/side-nav"
import { AnimatedNoise } from "@/components/animated-noise"
import { HighlightText } from "@/components/highlight-text"
import { ScrambleTextOnHover } from "@/components/scramble-text"
import { BitmapChevron } from "@/components/bitmap-chevron"
import gsap from "gsap"

// Mock data - replace with actual API calls
const games = [
  {
    id: 1,
    name: "League of Legends",
    category: "MOBA",
    queries: 2450000,
    revenue: "$3,528,000",
    price: "$1.44",
    tier: "Tier 2",
    description: "Premier MOBA with professional esports data. Match results, player stats, and tournament outcomes.",
    featured: true,
  },
  {
    id: 2,
    name: "Dota 2",
    category: "MOBA",
    queries: 1850000,
    revenue: "$2,664,000",
    price: "$1.44",
    tier: "Tier 2",
    description: "Complex strategy MOBA data. International tournament results and competitive match outcomes.",
    featured: true,
  },
  {
    id: 3,
    name: "CS:GO",
    category: "FPS",
    queries: 980000,
    revenue: "$1,411,200",
    price: "$1.44",
    tier: "Tier 2",
    description: "Tactical shooter data. Match results, tournament outcomes, and competitive league data.",
    featured: false,
  },
  {
    id: 4,
    name: "Rocket League",
    category: "Sports",
    queries: 650000,
    revenue: "$936,000",
    price: "$1.44",
    tier: "Tier 2",
    description: "Vehicular soccer esports data. RLCS tournament results and competitive match data.",
    featured: false,
  },
  {
    id: 5,
    name: "OnChain Chess",
    category: "Strategy",
    queries: 125000,
    revenue: "$180,000",
    price: "$1.44",
    tier: "Tier 1",
    description: "Fully onchain chess matches. Instant resolution with cryptographic proof of every move.",
    featured: false,
  },
  {
    id: 6,
    name: "Valorant",
    category: "FPS",
    queries: 450000,
    revenue: "$648,000",
    price: "$1.44",
    tier: "Tier 2",
    description: "Tactical FPS with character abilities. Professional league and tournament match data.",
    featured: false,
  },
]

const categories = ["All", "MOBA", "FPS", "Sports", "Strategy"]

export default function Marketplace() {
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [searchQuery, setSearchQuery] = useState("")
  const headerRef = useRef<HTMLDivElement>(null)

  const filteredGames = games.filter((game) => {
    const matchesCategory = selectedCategory === "All" || game.category === selectedCategory
    const matchesSearch = game.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  useEffect(() => {
    if (!headerRef.current) return

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".game-card",
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.08,
          duration: 0.6,
          ease: "power2.out",
        },
      )
    }, headerRef)

    return () => ctx.revert()
  }, [selectedCategory, searchQuery])

  return (
    <main className="relative min-h-screen">
      <SideNav />
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />

      <div className="relative z-10 pl-6 md:pl-28 pr-6 md:pr-12 py-16">
        <AnimatedNoise opacity={0.02} />

        {/* Header */}
        <div ref={headerRef} className="mb-16">
          <HighlightText className="font-mono text-xs uppercase tracking-widest text-accent">
            Game Marketplace
          </HighlightText>
          <h1 className="font-[var(--font-bebas)] text-[clamp(2rem,5vw,4rem)] text-foreground mt-4 leading-none">
            Discover Games
          </h1>
          <p className="font-mono text-sm text-muted-foreground mt-6 max-w-2xl leading-relaxed">
            Browse and subscribe to game data feeds. Every query costs $1.44, with 50 free queries per day.
          </p>
        </div>

        {/* Search & Filter */}
        <div className="mb-12 flex flex-col md:flex-row gap-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search games..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-background border border-border/30 px-6 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>
          <div className="flex gap-3 flex-wrap">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-6 py-3 font-mono text-xs uppercase tracking-widest transition-all duration-200 ${
                  selectedCategory === category
                    ? "bg-accent/10 text-accent border border-accent/50"
                    : "border border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30"
                }`}
              >
                <ScrambleTextOnHover text={category} as="span" duration={0.3} />
              </button>
            ))}
          </div>
        </div>

        {/* Featured Games */}
        {selectedCategory === "All" && !searchQuery && (
          <div className="mb-16">
            <h2 className="font-[var(--font-bebas)] text-[clamp(1.5rem,3vw,2.5rem)] text-foreground mb-6">
              Featured Games
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {games
                .filter((game) => game.featured)
                .map((game) => (
                  <div key={game.id} className="game-card border border-accent/30 p-6 relative group">
                    <div className="absolute inset-0 bg-accent/5" />
                    <div className="relative">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-mono text-xl font-medium text-foreground">{game.name}</h3>
                            <span className="inline-block px-2 py-1 font-mono text-[8px] uppercase tracking-widest bg-accent/20 text-accent border border-accent/50">
                              Featured
                            </span>
                          </div>
                          <div className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                            {game.category} • {game.tier}
                          </div>
                        </div>
                      </div>

                      <p className="font-mono text-sm text-muted-foreground leading-relaxed mb-6">{game.description}</p>

                      <div className="grid grid-cols-3 gap-4 mb-6">
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                            Queries/Mo
                          </div>
                          <div className="font-mono text-sm text-foreground">{game.queries.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                            Revenue/Mo
                          </div>
                          <div className="font-mono text-sm text-accent">{game.revenue}</div>
                        </div>
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                            Price/Query
                          </div>
                          <div className="font-mono text-sm text-foreground">{game.price}</div>
                        </div>
                      </div>

                      <button className="w-full group/btn inline-flex items-center justify-center gap-3 border border-accent/50 px-6 py-3 font-mono text-xs uppercase tracking-widest text-accent hover:bg-accent/10 transition-all duration-200">
                        <ScrambleTextOnHover text="Subscribe" as="span" duration={0.4} />
                        <BitmapChevron className="transition-transform duration-[400ms] ease-in-out group-hover/btn:rotate-45" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* All Games Grid */}
        <div>
          <h2 className="font-[var(--font-bebas)] text-[clamp(1.5rem,3vw,2.5rem)] text-foreground mb-6">
            {selectedCategory === "All" ? "All Games" : `${selectedCategory} Games`}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGames.map((game) => (
              <div
                key={game.id}
                className="game-card border border-border/30 p-6 relative group hover:border-accent/30 transition-colors"
              >
                <AnimatedNoise opacity={0.01} />
                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-mono text-base font-medium text-foreground mb-1">{game.name}</h3>
                      <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                        {game.category} • {game.tier}
                      </div>
                    </div>
                  </div>

                  <p className="font-mono text-xs text-muted-foreground leading-relaxed mb-6 line-clamp-3">
                    {game.description}
                  </p>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                        Queries/Mo
                      </div>
                      <div className="font-mono text-sm text-foreground">{game.queries.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                        Price/Query
                      </div>
                      <div className="font-mono text-sm text-accent">{game.price}</div>
                    </div>
                  </div>

                  <button className="w-full border border-border/30 px-4 py-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-accent hover:border-accent/50 transition-all duration-200">
                    <ScrambleTextOnHover text="View Details" as="span" duration={0.4} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredGames.length === 0 && (
            <div className="text-center py-16">
              <p className="font-mono text-sm text-muted-foreground">No games found matching your criteria.</p>
            </div>
          )}
        </div>

        {/* Coming Soon Banner */}
        <div className="mt-16 border border-accent/30 p-8 relative">
          <div className="absolute inset-0 bg-accent/5" />
          <div className="relative text-center">
            <div className="font-mono text-[10px] uppercase tracking-widest text-accent mb-2">Coming Soon</div>
            <h3 className="font-[var(--font-bebas)] text-[clamp(1.5rem,3vw,2.5rem)] text-foreground mb-4">
              Real-World Sports Data
            </h3>
            <p className="font-mono text-sm text-muted-foreground max-w-2xl mx-auto">
              Soon you'll be able to access football, basketball, and other real-world sports data through the same
              monetization model. Stay tuned for updates.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
