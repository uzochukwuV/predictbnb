# Smart Contract Integration Guide

This document explains how to use the smart contract integration for the Rock Paper Scissors game and Prediction Market on BNB Chain.

## Overview

The frontend integrates with two main smart contracts:
1. **RockPaperScissors.sol** - Handles game logic and match execution
2. **RPSPredictionMarket.sol** - Manages prediction markets for game outcomes

## Setup

### 1. Install Dependencies

The required Web3 dependencies are already installed:
- `wagmi` - React hooks for Ethereum
- `viem` - Lightweight Ethereum library
- `@tanstack/react-query` - Data fetching and caching

### 2. Configure Environment Variables

Create a `.env.local` file in the `frontend/` directory:

```bash
cp .env.example .env.local
```

Update the following variables:

```env
# Contract Addresses (update after deployment)
NEXT_PUBLIC_RPS_CONTRACT_ADDRESS=0xYourRPSContractAddress
NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS=0xYourPredictionMarketAddress

# WalletConnect Project ID
NEXT_PUBLIC_WC_PROJECT_ID=your_walletconnect_project_id
```

**To get a WalletConnect Project ID:**
1. Visit https://cloud.walletconnect.com/
2. Sign up/Login
3. Create a new project
4. Copy your Project ID

### 3. Deploy Contracts

Before using the frontend, deploy the contracts to BNB Chain:

```bash
# From the project root directory

# Deploy to BSC Testnet
npm run deploy:testnet

# Or deploy to BSC Mainnet
npm run deploy:mainnet
```

After deployment, update the contract addresses in `.env.local`.

### 4. Export ABIs

The ABIs are automatically exported to `frontend/lib/abis/` when you run:

```bash
node scripts/export-abis.js
```

This exports:
- `RockPaperScissors.json`
- `RPSPredictionMarket.json`
- Additional contract ABIs (GameRegistry, OracleCore, FeeManager)

## Architecture

### Web3 Providers

The app is wrapped with Web3 providers in `app/layout.tsx`:

```tsx
<Web3Providers>
  <SmoothScroll>{children}</SmoothScroll>
</Web3Providers>
```

This provides:
- Wagmi configuration (chains, connectors, transports)
- React Query client for data fetching

### Custom Hooks

#### RPS Game Hooks (`lib/hooks/useRPSContract.ts`)

**Read Hooks:**
- `useGetMatch(matchId)` - Get match details
- `useGetPlayerStats(address)` - Get player win/loss stats
- `useGameId()` - Get the registered game ID
- `useMatchCounter()` - Get total number of matches

**Write Hooks:**
- `useCommitToMatch()` - Commit to a match (generates random cards)
- `useScheduleMatch()` - Schedule a new match (owner only)

**Example:**
```tsx
const { data: matchData } = useGetMatch(matchId)
const { commitToMatch, isPending, isConfirmed } = useCommitToMatch()

// Commit to match
commitToMatch(matchId)
```

#### Prediction Market Hooks (`lib/hooks/usePredictionMarket.ts`)

**Read Hooks:**
- `useGetMarket(marketId)` - Get market details
- `useGetUserBets(marketId, address)` - Get user's bets
- `useGetOdds(marketId)` - Get current odds
- `useMarketCounter()` - Get total markets created

**Write Hooks:**
- `usePlaceBet()` - Place a bet on a market
- `useClaimWinnings()` - Claim winnings from resolved market
- `useResolveMarket()` - Resolve a market after match completes
- `useCreateMarket()` - Create a new prediction market (owner only)

**Example:**
```tsx
const { placeBet, isPending, isConfirmed } = usePlaceBet()

// Place bet
placeBet(marketId, predictedWinner, "0.1") // 0.1 BNB
```

### Helper Functions

**RPS Contract Helpers:**
- `getCardName(card)` - Convert card enum to name
- `getCardEmoji(card)` - Get emoji for card
- `getMatchStatusName(status)` - Get status name

**Prediction Market Helpers:**
- `formatBNB(wei)` - Format wei to BNB string
- `calculateOddsDisplay(totalPool, specificPool)` - Calculate and format odds
- `calculatePotentialPayout(...)` - Calculate potential winnings

## Usage Examples

### Connect Wallet

```tsx
import { useConnect, useDisconnect, useAccount } from 'wagmi'
import { injected } from 'wagmi/connectors'

function WalletButton() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()

  if (isConnected) {
    return (
      <div>
        <p>Connected: {address}</p>
        <button onClick={() => disconnect()}>Disconnect</button>
      </div>
    )
  }

  return (
    <button onClick={() => connect({ connector: injected() })}>
      Connect Wallet
    </button>
  )
}
```

### Play RPS Game

```tsx
import { useGetMatch, useCommitToMatch } from '@/lib/hooks/useRPSContract'

function RPSGame({ matchId }) {
  const { data: matchData } = useGetMatch(matchId)
  const { commitToMatch, isPending, isConfirmed } = useCommitToMatch()

  const handleCommit = () => {
    commitToMatch(matchId)
  }

  return (
    <div>
      {matchData && (
        <div>
          <p>Player 1: {matchData.player1}</p>
          <p>Player 2: {matchData.player2}</p>
          <button
            onClick={handleCommit}
            disabled={isPending || isConfirmed}
          >
            {isPending ? 'Confirming...' : 'Commit to Match'}
          </button>
        </div>
      )}
    </div>
  )
}
```

### Place Bet on Prediction Market

```tsx
import { usePlaceBet, useGetMarket } from '@/lib/hooks/usePredictionMarket'

function BettingInterface({ marketId }) {
  const { data: marketData } = useGetMarket(marketId)
  const { placeBet, isPending } = usePlaceBet()
  const [amount, setAmount] = useState('')

  const handleBet = (predictedWinner) => {
    placeBet(marketId, predictedWinner, amount)
  }

  return (
    <div>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount in BNB"
      />
      <button onClick={() => handleBet(marketData.player1)}>
        Bet on Player 1
      </button>
    </div>
  )
}
```

## Contract Workflow

### RPS Game Flow

1. **Schedule Match** (Owner)
   - Owner calls `scheduleMatch(player1, player2, scheduledTime)`
   - Match ID is generated

2. **Player 1 Commits**
   - When scheduled time arrives, Player 1 calls `commitToMatch(matchId)`
   - 3 random cards are generated using on-chain randomness

3. **Player 2 Commits**
   - Player 2 calls `commitToMatch(matchId)`
   - 3 random cards generated
   - Match auto-executes and determines winner

4. **View Results**
   - Results are stored on-chain
   - Winner info submitted to oracle

### Prediction Market Flow

1. **Create Market** (Owner)
   - Owner calls `createMarket(matchId, gameId, player1, player2, bettingDeadline)`
   - Market ID is generated

2. **Place Bets**
   - Users call `placeBet(marketId, predictedWinner)` with BNB
   - Can predict Player 1, Player 2, or Tie

3. **Resolve Market**
   - After betting deadline, anyone calls `resolveMarket(marketId)`
   - Fetches winner from oracle
   - Market is marked as resolved

4. **Claim Winnings**
   - Winning bettors call `claimWinnings(marketId)`
   - Receive proportional share of pool minus 2% platform fee

## Testing

### Using BSC Testnet

1. Get testnet BNB from faucet: https://testnet.bnbchain.org/faucet-smart
2. Switch MetaMask to BSC Testnet (Chain ID: 97)
3. Connect wallet to the app
4. Interact with deployed contracts

### Local Testing with Hardhat

```bash
# Start local node
npm run node

# Deploy contracts locally
npm run deploy:local

# Update .env.local with local contract addresses
```

## Troubleshooting

### Transaction Failures

- **Insufficient Gas**: Ensure you have enough BNB for gas
- **Wrong Network**: Check you're on the correct chain (BSC Testnet/Mainnet)
- **Betting Closed**: Cannot bet after deadline
- **Not Player**: Only match players can commit

### Connection Issues

- Clear browser cache and reconnect wallet
- Try different wallet connector (MetaMask, WalletConnect)
- Check RPC endpoint in wagmi config

### Contract Address Issues

- Verify contract addresses in `.env.local`
- Ensure contracts are deployed to the current network
- Check contract addresses match the network you're connected to

## Security Considerations

1. **Never commit private keys** - Use `.env.local` (gitignored)
2. **Validate user inputs** - Check amounts, addresses before transactions
3. **Handle errors gracefully** - Display user-friendly error messages
4. **Use read-only calls** - Fetch data with `useReadContract` when possible
5. **Confirm transactions** - Wait for transaction confirmations

## Additional Resources

- [Wagmi Documentation](https://wagmi.sh/)
- [Viem Documentation](https://viem.sh/)
- [BNB Chain Documentation](https://docs.bnbchain.org/)
- [WalletConnect](https://docs.walletconnect.com/)

## Support

For issues or questions:
1. Check contract events in block explorer
2. Review transaction logs
3. Verify contract state with read functions
4. Check console for error messages
