"use client"

import { DashboardSidebar, DashboardHeader, MobileNav } from "@/components/dashboard/sidebar"
import { AnimatedNoise } from "@/components/animated-noise"
import { GlowingGrid } from "@/components/animations/floating-elements"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <GlowingGrid className="opacity-20" />
        <AnimatedNoise opacity={0.02} />
      </div>

      {/* Mobile nav */}
      <MobileNav />

      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <DashboardSidebar />
      </div>

      {/* Main content */}
      <div className="md:ml-64 min-h-screen flex flex-col">
        <DashboardHeader />
        <main className="flex-1 p-6 relative z-10">
          {children}
        </main>
      </div>
    </div>
  )
}
