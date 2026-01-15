"use client"

import { useState } from "react"
import { useAccount, useConnect, useDisconnect, useBalance, useSwitchChain } from "wagmi"
import { injected } from "wagmi/connectors"
import { formatEther } from "viem"
import { ScrambleTextOnHover } from "./scramble-text"

export function WalletWidget() {
  const [isExpanded, setIsExpanded] = useState(false)
  const { address, isConnected, chain,  } = useAccount()
  const { mutateAsync:switchChainAsync} = useSwitchChain()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const { data: balance } = useBalance({
    address: address,
  })

  const handleConnect = () => {
    connect({ connector: injected() })
  }

  const handleDisconnect = () => {
    disconnect()
    setIsExpanded(false)
  }

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      // You could add a toast notification here
    }
  }

  if (!isConnected) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={handleConnect}
          className="group flex items-center gap-3 border border-accent bg-accent/10 px-6 py-3 font-mono text-xs uppercase tracking-widest text-accent hover:bg-accent hover:text-background transition-all duration-200 backdrop-blur-sm"
        >
          <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
          <ScrambleTextOnHover text="Connect Wallet" as="span" duration={0.5} />
        </button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Collapsed State */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="group flex items-center gap-3 border border-accent bg-background/90 px-4 py-3 font-mono text-xs uppercase tracking-widest text-accent hover:border-accent/80 transition-all duration-200 backdrop-blur-sm"
        >
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-foreground">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </span>
        </button>
      )}

      {/* Expanded State */}
      {isExpanded && (
        <div className="border border-border/50 bg-background/95 backdrop-blur-md shadow-2xl min-w-[280px]">
          {/* Header */}
          <div className="p-4 border-b border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="font-mono text-xs uppercase tracking-widest text-accent">
                Connected
              </span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Address */}
          <div className="p-4 border-b border-border/50">
            <div className="font-mono text-xs text-muted-foreground mb-2">Wallet Address</div>
            <button
              onClick={copyAddress}
              className="font-mono text-sm text-foreground hover:text-accent transition-colors group flex items-center gap-2 w-full"
              title="Click to copy"
            >
              <span>{address?.slice(0, 6)}...{address?.slice(-4)}</span>
              <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity">📋</span>
            </button>
          </div>

          {/* Balance */}
          <div className="p-4 border-b border-border/50">
            <div className="font-mono text-xs text-muted-foreground mb-2">Balance</div>
            <div className="font-[var(--font-bebas)] text-2xl text-accent">
              {balance ? parseFloat(formatEther(balance.value)).toFixed(4) : "0.0000"} {balance?.symbol || "BNB"}
            </div>
          </div>

          {/* Network */}
          <div className="p-4 border-b border-border/50">
            <div className="font-mono text-xs text-muted-foreground mb-2">Network</div>
            <div className="flex items-center gap-2">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  chain?.id === 97 ? "bg-yellow-500" : chain?.id === 56 ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className="font-mono text-sm text-foreground">
                {chain?.name || "Unknown Network"}
                
              </span>
              <button onClick={async ()=>{
                await switchChainAsync({chainId: 8})
              }}>
                <ScrambleTextOnHover text="Switch" as="span" duration={0.3} />
              </button>
            </div>
            {chain?.id !== 97 && chain?.id !== 56 && (
              <div className="font-mono text-xs text-red-500 mt-1">
                ⚠️ Please switch to BSC network
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-4">
            <button
              onClick={handleDisconnect}
              className="w-full border border-border px-4 py-2 font-mono text-xs uppercase tracking-widest text-foreground hover:border-red-500 hover:text-red-500 transition-all duration-200"
            >
              <ScrambleTextOnHover text="Disconnect" as="span" duration={0.3} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
