import { http, createConfig } from 'wagmi'
import { bsc, bscTestnet } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

// Define the chains
export const chains = [bscTestnet, bsc] as const

// Create wagmi config
export const config = createConfig({
  chains,
  connectors: [
    injected(),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || 'YOUR_PROJECT_ID',
    }),
  ],
  transports: {
    [bsc.id]: http(),
    [bscTestnet.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
