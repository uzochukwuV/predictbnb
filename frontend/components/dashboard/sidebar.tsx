"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { useAccount, useConnect, useDisconnect } from "wagmi"
import { injected } from "wagmi/connectors"
import { cn } from "@/lib/utils"
import { ScrambleTextOnHover } from "@/components/scramble-text"
import { PulsingDot } from "@/components/animations/floating-elements"
import {
  Gamepad2,
  BarChart3,
  Wallet,
  Settings,
  ChevronRight,
  Home,
  TrendingUp,
  Trophy,
  Users,
  Bell,
  Menu,
  X,
  Zap,
  Target,
  Activity,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const dashboardNavItems = [
  {
    label: "Overview",
    path: "/dashboard",
    icon: Home,
    description: "Protocol overview",
  },
  {
    label: "Games",
    path: "/dashboard/games",
    icon: Gamepad2,
    description: "Registered games",
  },
  {
    label: "Markets",
    path: "/dashboard/markets",
    icon: TrendingUp,
    description: "Prediction markets",
  },
  {
    label: "Protocol",
    path: "/dashboard/protocol",
    icon: Activity,
    description: "Network stats",
  },
  {
    label: "Leaderboard",
    path: "/dashboard/leaderboard",
    icon: Trophy,
    description: "Top performers",
  },
]

const quickActions = [
  { label: "Register Game", icon: Gamepad2, action: "register" },
  { label: "Create Market", icon: Target, action: "create" },
  { label: "Deposit", icon: Wallet, action: "deposit" },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const [isHovered, setIsHovered] = useState<string | null>(null)

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border/30 bg-background/95 backdrop-blur-xl">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-border/30 px-6">
        <div className="w-8 h-8 border border-accent/50 flex items-center justify-center">
          <Zap className="w-4 h-4 text-accent" />
        </div>
        <span className="font-mono text-sm uppercase tracking-widest text-foreground">PredictBNB</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3 px-3">
          Dashboard
        </div>
        {dashboardNavItems.map((item) => {
          const isActive = pathname === item.path
          return (
            <Link
              key={item.path}
              href={item.path}
              onMouseEnter={() => setIsHovered(item.path)}
              onMouseLeave={() => setIsHovered(null)}
              className="group relative block"
            >
              <motion.div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 transition-all duration-300",
                  isActive
                    ? "bg-accent/10 text-accent"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                whileHover={{ x: 4 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <item.icon className="w-4 h-4" />
                <span className="font-mono text-xs uppercase tracking-wider">{item.label}</span>
                {isActive && (
                  <motion.div
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-accent"
                    layoutId="activeIndicator"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
                <ChevronRight 
                  className={cn(
                    "w-3 h-3 ml-auto transition-all duration-300",
                    isActive || isHovered === item.path ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
                  )} 
                />
              </motion.div>
            </Link>
          )
        })}

        {/* Quick Actions */}
        <div className="pt-6">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3 px-3">
            Quick Actions
          </div>
          {quickActions.map((action) => (
            <motion.button
              key={action.action}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
            >
              <action.icon className="w-4 h-4" />
              <span className="font-mono text-xs uppercase tracking-wider">{action.label}</span>
            </motion.button>
          ))}
        </div>
      </nav>

      {/* Wallet Section */}
      <div className="border-t border-border/30 p-4">
        {isConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <PulsingDot />
              <span className="font-mono text-xs text-accent">Connected</span>
            </div>
            <div className="font-mono text-xs text-muted-foreground truncate">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full font-mono text-xs uppercase tracking-widest"
              onClick={() => disconnect()}
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <Button 
            className="w-full font-mono text-xs uppercase tracking-widest"
            onClick={() => connect({ connector: injected() })}
          >
            <Wallet className="w-4 h-4 mr-2" />
            Connect Wallet
          </Button>
        )}
      </div>
    </aside>
  )
}

export function DashboardHeader() {
  const pathname = usePathname()
  const { isConnected } = useAccount()
  const [notificationOpen, setNotificationOpen] = useState(false)

  const currentPage = dashboardNavItems.find((item) => item.path === pathname)

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/30 bg-background/95 backdrop-blur-xl px-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
          Dashboard
        </span>
        <ChevronRight className="w-3 h-3 text-muted-foreground" />
        <span className="font-mono text-xs text-foreground uppercase tracking-widest">
          {currentPage?.label || "Overview"}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <Sheet open={notificationOpen} onOpenChange={setNotificationOpen}>
          <SheetTrigger asChild>
            <motion.button 
              className="relative p-2 text-muted-foreground hover:text-foreground transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" />
            </motion.button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
              Notifications
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="p-3 border border-border/30 hover:border-accent/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="accent" className="text-[10px]">New</Badge>
                    <span className="font-mono text-[10px] text-muted-foreground">2h ago</span>
                  </div>
                  <p className="font-mono text-xs text-foreground">Match result finalized for Game #{i}</p>
                </motion.div>
              ))}
            </div>
          </SheetContent>
        </Sheet>

        {/* Settings */}
        <motion.button 
          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          whileHover={{ scale: 1.05, rotate: 90 }}
          whileTap={{ scale: 0.95 }}
        >
          <Settings className="w-5 h-5" />
        </motion.button>
      </div>
    </header>
  )
}

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden fixed top-4 left-4 z-50">
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <div className="flex h-16 items-center gap-2 border-b border-border/30 px-6">
          <div className="w-8 h-8 border border-accent/50 flex items-center justify-center">
            <Zap className="w-4 h-4 text-accent" />
          </div>
          <span className="font-mono text-sm uppercase tracking-widest text-foreground">PredictBNB</span>
        </div>
        <nav className="p-4 space-y-1">
          {dashboardNavItems.map((item) => {
            const isActive = pathname === item.path
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 transition-colors",
                  isActive
                    ? "bg-accent/10 text-accent"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-mono text-sm uppercase tracking-wider">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
