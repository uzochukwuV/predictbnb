"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAccount, useConnect, useDisconnect } from "wagmi"
import { injected } from "wagmi/connectors"

const navItems = [
  { id: "hero", label: "Index", path: "/" },
  { id: "stats", label: "Stats", path: "/" },
  { id: "features", label: "Features", path: "/" },
  { id: "how-it-works", label: "How It Works", path: "/" },
  { id: "revenue", label: "Revenue", path: "/" },
]

const mainNavItems = [
  { label: "Home", path: "/" },
  { label: "Console", path: "/console" },
  { label: "Marketplace", path: "/marketplace" },
  { label: "RPS Game", path: "/game/rps" },
  { label: "VF Game", path: "/game/vfootball" },
  { label: "RPS Predict", path: "/prediction-market" },
  { label: "VF Predict", path: "/predict/vfootball" },
]

const consoleItems = [
   { label: "Home", path: "/" },
  { label: "Choose Role", path: "/console" },
  { label: "Game Provider", path: "/console/game" },
  { label: "Market Consumer", path: "/console/market" },
]

export function SideNav() {
  const [activeSection, setActiveSection] = useState("hero")
  const pathname = usePathname()
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()

  const isConsole = pathname.startsWith("/console")
  const isHome = pathname === "/"

  useEffect(() => {
    if (!isHome) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        })
      },
      { threshold: 0.3 },
    )

    navItems.forEach(({ id }) => {
      const element = document.getElementById(id)
      if (element) observer.observe(element)
    })

    return () => observer.disconnect()
  }, [isHome])

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
    }
  }

  const handleConnectWallet = () => {
    connect({ connector: injected() })
  }

  return (
    <nav className="fixed left-0 top-0 z-50 h-screen w-16 md:w-20 flex flex-col border-r border-border/30 bg-background/80 backdrop-blur-sm">
      {/* Top Section - Main Navigation */}
      <div className="flex-1 flex flex-col justify-center gap-6 px-4">
        {/* Console Navigation */}
        {isConsole &&
          consoleItems.map(({ label, path }) => (
            <Link key={path} href={path} className="group relative flex items-center gap-3">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-all duration-300",
                  pathname === path ? "bg-accent scale-125" : "bg-muted-foreground/40 group-hover:bg-foreground/60",
                )}
              />
              <span
                className={cn(
                  "absolute left-6 font-mono text-[10px] uppercase tracking-widest opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:left-8 whitespace-nowrap",
                  pathname === path ? "text-accent" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </Link>
          ))}

        {/* Home Page Section Navigation */}
        {isHome &&
          navItems.map(({ id, label }) => (
            <button key={id} onClick={() => scrollToSection(id)} className="group relative flex items-center gap-3">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-all duration-300",
                  activeSection === id ? "bg-accent scale-125" : "bg-muted-foreground/40 group-hover:bg-foreground/60",
                )}
              />
              <span
                className={cn(
                  "absolute left-6 font-mono text-[10px] uppercase tracking-widest opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:left-8 whitespace-nowrap",
                  activeSection === id ? "text-accent" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </button>
          ))}

        {/* Other Pages - Show Main Nav */}
        {!isHome &&
          !isConsole &&
          mainNavItems.map(({ label, path }) => (
            <Link key={path} href={path} className="group relative flex items-center gap-3">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-all duration-300",
                  pathname === path ? "bg-accent scale-125" : "bg-muted-foreground/40 group-hover:bg-foreground/60",
                )}
              />
              <span
                className={cn(
                  "absolute left-6 font-mono text-[10px] uppercase tracking-widest opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:left-8 whitespace-nowrap",
                  pathname === path ? "text-accent" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </Link>
          ))}
      </div>

      {/* Bottom Section - Wallet Connection */}
      <div className="px-4 pb-8">
        <div className="border-t border-border/30 pt-6">
          {isConnected ? (
            <button
              onClick={() => disconnect()}
              className="group relative flex items-center gap-3 w-full"
              title="Disconnect Wallet"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              <span className="absolute left-6 font-mono text-[10px] uppercase tracking-widest opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:left-8 whitespace-nowrap text-accent">
                {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Connected"}
              </span>
            </button>
          ) : (
            <button
              onClick={handleConnectWallet}
              className="group relative flex items-center gap-3 w-full"
              title="Connect Wallet"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 group-hover:bg-accent transition-all duration-300" />
              <span className="absolute left-6 font-mono text-[10px] uppercase tracking-widest opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:left-8 whitespace-nowrap text-muted-foreground group-hover:text-accent">
                Connect
              </span>
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}
