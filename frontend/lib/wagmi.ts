import { http, createConfig } from 'wagmi'
import { bsc, bscTestnet } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'
import { defineChain } from 'viem'

// Define Tenderly Virtual Mainnet chain
export const tenderlyVirtual = defineChain({
  id: 8, // Using mainnet fork ID
  name: 'Tenderly Virtual Mainnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://virtual.mainnet.eu.rpc.tenderly.co/82c86106-662e-4d7f-a974-c311987358ff'],
    },
    public: {
      http: ['https://virtual.mainnet.eu.rpc.tenderly.co/82c86106-662e-4d7f-a974-c311987358ff'],
    },
  },
  blockExplorers: {
    default: { name: 'Tenderly', url: 'https://dashboard.tenderly.co' },
  },
  testnet: true,
})

// Define the chains
export const chains = [tenderlyVirtual, bscTestnet, bsc] as const

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
    [tenderlyVirtual.id]: http('https://virtual.mainnet.eu.rpc.tenderly.co/82c86106-662e-4d7f-a974-c311987358ff'),
    [bsc.id]: http(),
    [bscTestnet.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
