# Deployment Guide

This guide explains how to deploy the PredictBNB oracle infrastructure, RPS game, and prediction market.

## What Was Fixed

The original `deployV2.js` script attempted to deploy non-existent V2 contracts:
- ❌ `GameSchemaRegistry` (doesn't exist)
- ❌ `SchemaTemplates` (doesn't exist)
- ❌ `OracleCoreV2` (doesn't exist)

The fixed script now properly deploys:
- ✅ Core infrastructure using UUPS upgradeable proxies
- ✅ RockPaperScissors game contract
- ✅ RPSPredictionMarket contract
- ✅ Automatic contract reference linking
- ✅ Game registration with oracle
- ✅ Frontend `.env.local` generation

## Deployment Scripts

### Option 1: Full Stack Deployment (Recommended)

Deploys everything: oracle infrastructure + RPS game + prediction market

```bash
# Local (Hardhat Network)
npm run deploy:v2:local

# BSC Testnet
npm run deploy:v2:testnet

# BSC Mainnet
npm run deploy:v2:mainnet
```

### Option 2: Core Infrastructure Only

Deploys only the oracle infrastructure (no game contracts)

```bash
# Local
npm run deploy:local

# BSC Testnet
npm run deploy:testnet

# BSC Mainnet
npm run deploy:mainnet
```

## What Gets Deployed

### Core Infrastructure (UUPS Upgradeable)
1. **GameRegistry** - Manages game registration and staking
2. **FeeManager** - Handles query fees and revenue distribution
3. **OracleCore** - Core oracle for result submission and queries
4. **DisputeResolver** - Handles disputes and challenges

### Game Contracts
1. **RockPaperScissors** - On-chain RPS game with verifiable randomness
   - Automatically registered with oracle during deployment

### Prediction Market
1. **RPSPredictionMarket** - Parimutuel betting market for RPS matches
   - Uses oracle data for result resolution
   - 2% platform fee

## Configuration

The deployment uses these default values:

```javascript
MINIMUM_STAKE = 0.1 BNB        // Game registration stake
QUERY_FEE = 0.003 BNB          // Oracle query fee (~$1.80 at $600/BNB)
CHALLENGE_STAKE = 0.2 BNB      // Dispute challenge stake
FREE_TIER = 50 queries/day     // Free oracle queries per consumer
DISPUTE_WINDOW = 15 minutes    // Time to dispute results
PLATFORM_FEE = 2%              // Prediction market fee
```

## After Deployment

The script automatically:

1. ✅ Saves deployment info to `deployments/deployment-v2-{network}-{timestamp}.json`
2. ✅ Generates `frontend/.env.local` with contract addresses
3. ✅ Links all contract references
4. ✅ Registers RPS game with oracle

### Next Steps

#### 1. Export ABIs to Frontend

```bash
node scripts/export-abis.js
```

This copies contract ABIs from `artifacts/` to `frontend/lib/abis/`.

#### 2. Update WalletConnect Project ID

- Visit https://cloud.walletconnect.com/
- Create a project
- Update `NEXT_PUBLIC_WC_PROJECT_ID` in `frontend/.env.local`

#### 3. Verify Contracts on BSCScan

For regular contracts:
```bash
npx hardhat verify --network bscTestnet <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

For UUPS proxies:
```bash
# Use the proxy address (not implementation)
npx hardhat verify --network bscTestnet <PROXY_ADDRESS>
```

Example:
```bash
# RockPaperScissors
npx hardhat verify --network bscTestnet 0x123... 0xGameRegistry 0xOracleCore

# RPSPredictionMarket
npx hardhat verify --network bscTestnet 0x456... 0xOracleCore 0xFeeManager
```

#### 4. Fund Prediction Market for Oracle Queries

The prediction market needs BNB to pay for oracle queries:

```javascript
// In frontend or via contract interaction
await predictionMarket.fundOracleBalance({ value: parseEther("0.1") })
```

Or use the frontend UI's fund oracle balance function.

#### 5. Test the Full Workflow

**a. Schedule an RPS Match (Owner Only)**
```javascript
await rpsGame.scheduleMatch(
  player1Address,
  player2Address,
  scheduledTimestamp
)
```

**b. Create a Prediction Market**
```javascript
await predictionMarket.createMarket(
  matchId,
  gameId,
  player1Address,
  player2Address,
  bettingDeadline
)
```

**c. Users Place Bets**
```javascript
await predictionMarket.placeBet(
  marketId,
  predictedWinner,
  { value: parseEther("0.1") }
)
```

**d. Players Commit to Match**

After scheduled time arrives:
```javascript
await rpsGame.commitToMatch(matchId) // Player 1
await rpsGame.commitToMatch(matchId) // Player 2
```

**e. Resolve Prediction Market**
```javascript
await predictionMarket.resolveMarket(marketId)
```

**f. Winners Claim Winnings**
```javascript
await predictionMarket.claimWinnings(marketId)
```

## Frontend Integration

After deployment, the frontend is ready to use:

```bash
cd frontend
npm run dev
```

The contract addresses are already configured in `.env.local`.

### Available Pages

- `/` - Landing page
- `/game/rps` - Rock Paper Scissors game interface
- `/prediction-market` - Prediction market interface

## Troubleshooting

### "Insufficient Balance" Error

Make sure deployer account has enough BNB:
- Local: Use Hardhat's default funded accounts
- Testnet: Get testnet BNB from https://testnet.bnbchain.org/faucet-smart
- Mainnet: Ensure sufficient BNB for deployment + gas

### "Contract Not Found" Error

Make sure contracts are compiled:
```bash
npm run compile
```

### Deployment Fails on Testnet/Mainnet

Check:
1. `.env` file has correct `PRIVATE_KEY`
2. RPC endpoint is accessible
3. Account has sufficient BNB
4. Network config in `hardhat.config.js` is correct

## Network Configuration

Update `hardhat.config.js` if needed:

```javascript
networks: {
  bscTestnet: {
    url: process.env.BSC_TESTNET_RPC || "https://data-seed-prebsc-1-s1.binance.org:8545",
    chainId: 97,
    accounts: [process.env.PRIVATE_KEY]
  },
  bscMainnet: {
    url: process.env.BSC_MAINNET_RPC || "https://bsc-dataseed.binance.org/",
    chainId: 56,
    accounts: [process.env.PRIVATE_KEY]
  }
}
```

## Security Notes

1. **Never commit private keys** - Use `.env` file (gitignored)
2. **Test on testnet first** - Thoroughly test before mainnet deployment
3. **Verify contracts** - Always verify on BSCScan for transparency
4. **Audit upgradeable contracts** - UUPS upgrades require careful review
5. **Monitor oracle balance** - Ensure prediction market has funds for queries

## Revenue Model

The deployed system implements a sustainable revenue model:

- **Oracle Queries**: 0.003 BNB per query (~$1.80)
- **Free Tier**: 50 queries/day per consumer
- **Volume Bonuses**: 5-15% bonus on large deposits
- **Revenue Split**:
  - 80% to game developers
  - 15% to protocol treasury
  - 5% to dispute resolvers

## Support

For issues or questions:
1. Check deployment logs in `deployments/` directory
2. Verify contract addresses in `.env.local`
3. Review transaction logs on BSCScan
4. Check console for error messages
