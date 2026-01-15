# Deployment Checklist & Quick Start Guide

## ✅ Completed Setup

### 1. Smart Contracts
- ✅ Core infrastructure (GameRegistry, OracleCore, FeeManagerV2, DisputeResolver)
- ✅ RockPaperScissors game + RPSPredictionMarket
- ✅ VirtualFootballGame + VirtualFootballMarket
- ✅ Automation script for Virtual Football

### 2. Frontend
- ✅ RPS game page ([/game/rps](../frontend/app/game/rps/page.tsx))
- ✅ Virtual Football game page ([/game/vfootball](../frontend/app/game/vfootball/page.tsx))
- ✅ RPS prediction market ([/prediction-market](../frontend/app/prediction-market/page.tsx))
- ✅ VF prediction market ([/predict/vfootball](../frontend/app/predict/vfootball/page.tsx))
- ✅ Console dashboards (Game Provider, Market Consumer)
- ✅ Global navigation with wallet connection

### 3. Deployment Scripts
- ✅ Full stack deployment script ([scripts/deployFullStack.js](../scripts/deployFullStack.js))
- ✅ Automation bot ([scripts/automateVirtualFootball.js](../scripts/automateVirtualFootball.js))
- ✅ ABI export script ([scripts/export-abis.js](../scripts/export-abis.js))

---

## 🚀 Deployment to BSC Testnet

### Prerequisites

1. **Fund Deployer Wallet**
   - Minimum: 1 BNB (covers deployment gas + incentive pools)
   - Get testnet BNB from [BSC Testnet Faucet](https://testnet.bnbchain.org/faucet-smart)

2. **Set Environment Variables**
   ```bash
   # Create .env in project root
   PRIVATE_KEY=your_private_key_here
   BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
   BSCSCAN_API_KEY=your_bscscan_api_key_here  # For verification
   ```

### Deployment Steps

#### Step 1: Compile Contracts
```bash
npm run compile
```

#### Step 2: Deploy Full Stack
```bash
npm run deploy:full:testnet
```

This will:
- Deploy all core contracts (GameRegistry, OracleCore, FeeManagerV2, etc.)
- Deploy RPS game + market
- Deploy Virtual Football game + market
- Register games with oracle
- Fund incentive pools
- Generate `frontend/.env.local` with all addresses
- Save deployment info to `deployments/` directory

**Expected Output**:
```
🎉 FULL STACK DEPLOYMENT COMPLETE!

📦 Core Infrastructure:
GameRegistry:        0x...
OracleCore:          0x...
FeeManagerV2:        0x...

🎮 RPS Game:
RockPaperScissors:   0x...
RPSPredictionMarket: 0x...

⚽ Virtual Football:
VirtualFootballGame: 0x...
VirtualFootballMarket: 0x...
```

#### Step 3: Export ABIs
```bash
npm run export-abis
```

This exports contract ABIs to `frontend/lib/abis/` for frontend integration.

#### Step 4: Verify Contracts (Optional but Recommended)

```bash
# Verify each non-proxy contract
npx hardhat verify --network bscTestnet <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>

# Example for RPS
npx hardhat verify --network bscTestnet 0x... 0x<GameRegistry> 0x<OracleCore>

# Example for VF Game
npx hardhat verify --network bscTestnet 0x... 0x<OracleCore> 0x<GameRegistry>

# Example for VF Market
npx hardhat verify --network bscTestnet 0x... 0x<VFGame> 0x<OracleCore> 0x<FeeManager>
```

For upgradeable contracts (UUPS proxies), verify the implementation:
```bash
# Get implementation address from BscScan
# Then verify implementation contract
```

---

## 🤖 Start Automation Bot

The Virtual Football game needs a bot to automatically simulate matches.

### Local Testing
```bash
VIRTUAL_FOOTBALL_GAME_ADDRESS=0x... \
AUTO_CREATE_SEASONS=true \
npm run automate:vf
```

### Production (PM2)
```bash
# Install PM2
npm install -g pm2

# Start bot
pm2 start ecosystem.config.js

# Monitor
pm2 logs vf-automation
pm2 monit

# Auto-start on reboot
pm2 startup
pm2 save
```

See [AUTOMATION_GUIDE.md](./AUTOMATION_GUIDE.md) for detailed setup.

---

## 🌐 Frontend Deployment

### Step 1: Check Environment Variables

The deployment script should have created `frontend/.env.local`:

```bash
cat frontend/.env.local
```

Verify all addresses are present:
- ✅ `NEXT_PUBLIC_VIRTUAL_FOOTBALL_GAME_ADDRESS`
- ✅ `NEXT_PUBLIC_VIRTUAL_FOOTBALL_MARKET_ADDRESS`
- ✅ `NEXT_PUBLIC_RPS_CONTRACT_ADDRESS`
- ✅ `NEXT_PUBLIC_RPS_PREDICTION_MARKET_ADDRESS`
- ✅ `NEXT_PUBLIC_ORACLE_CORE_ADDRESS`
- ✅ `NEXT_PUBLIC_GAME_REGISTRY_ADDRESS`
- ✅ `NEXT_PUBLIC_FEE_MANAGER_ADDRESS`

### Step 2: Install Frontend Dependencies
```bash
cd frontend
npm install
```

### Step 3: Start Development Server
```bash
npm run dev
```

Visit http://localhost:3000

### Step 4: Test Full Workflow

#### Virtual Football Testing:

1. **Create Season** ([/game/vfootball](http://localhost:3000/game/vfootball))
   - Click "Create Season"
   - Set start time (1 hour from now recommended)
   - Wait for transaction

2. **Vote for Winner** ([/predict/vfootball](http://localhost:3000/predict/vfootball))
   - Go to "Season Voting" tab
   - Select a team
   - Vote (FREE - no cost)

3. **Start Season** ([/game/vfootball](http://localhost:3000/game/vfootball))
   - When start time arrives, click "Start Season"
   - This creates all 20 matches
   - Each match is 10 minutes apart

4. **Place Bets** ([/predict/vfootball](http://localhost:3000/predict/vfootball))
   - Go to "Match Betting" tab
   - Select match, bet type, outcome
   - Enter amount and place bet

5. **Simulate Matches** ([/game/vfootball](http://localhost:3000/game/vfootball))
   - When matches reach kickoff time, click "Simulate Match"
   - Or let automation bot handle it

6. **Claim Winnings** ([/predict/vfootball](http://localhost:3000/predict/vfootball))
   - Go to "My Bets" tab
   - Click "Settle Bet" (queries oracle)
   - If won, click "Claim Winnings"

7. **Claim Vote Rewards**
   - After season completes, go to "Season Voting" tab
   - If your team won, click "Claim Rewards"

---

## 📊 Testing Checklist

### Smart Contract Tests
```bash
# Run all tests
npm test

# Run specific tests
npm run test:verbose

# Test Virtual Football specifically
npx hardhat test test/VirtualFootballGame.test.js
npx hardhat test test/VirtualFootballMarket.test.js
```

### Frontend Testing

#### 1. Wallet Connection
- [ ] Connect MetaMask
- [ ] Switch to BSC Testnet
- [ ] Disconnect wallet
- [ ] Wallet shows in side navigation

#### 2. Virtual Football Game
- [ ] Season creation works
- [ ] Season start generates 20 matches
- [ ] League table displays correctly
- [ ] Match simulation works
- [ ] Season ending works
- [ ] Owner actions hidden for non-owners

#### 3. VF Prediction Market
- [ ] Season voting (FREE) works
- [ ] Vote shows after casting
- [ ] Match betting (3 types) works
- [ ] Bet amount validation
- [ ] My Bets tab shows user bets
- [ ] Settlement works after match finalization
- [ ] Claim winnings works for won bets
- [ ] Claim vote rewards works after season

#### 4. RPS Game
- [ ] Match scheduling works
- [ ] Players can commit cards
- [ ] Match resolution works
- [ ] Results display correctly

#### 5. RPS Prediction Market
- [ ] Market creation for matches
- [ ] Bet placement works
- [ ] Market resolution works
- [ ] Claiming winnings works

#### 6. Console Dashboards
- [ ] Game Provider dashboard shows stats
- [ ] Market Consumer dashboard shows balance
- [ ] Earnings display correctly
- [ ] Streak tracking works

---

## 🔧 Common Issues & Solutions

### Issue 1: "Insufficient funds"
**Solution**: Fund your wallet with testnet BNB from faucet

### Issue 2: "Transaction underpriced"
**Solution**: Increase gas price in MetaMask or wait for network congestion to clear

### Issue 3: Frontend shows "Contract not found"
**Solution**:
- Check `.env.local` has correct addresses
- Ensure you're on correct network (BSC Testnet)
- Restart dev server: `npm run dev`

### Issue 4: Automation bot not simulating
**Solution**:
- Check bot wallet has gas
- Verify `VIRTUAL_FOOTBALL_GAME_ADDRESS` is set
- Check match kickoff times: `await game.getMatch(matchId)`
- See [AUTOMATION_GUIDE.md](./AUTOMATION_GUIDE.md)

### Issue 5: "Match not finalized" when settling bet
**Solution**:
- Match must be simulated first
- Check match status in game page
- Wait for simulation or run manually

### Issue 6: ABIs not found in frontend
**Solution**:
```bash
npm run export-abis
cd frontend && npm run dev  # Restart
```

---

## 📈 Production Deployment

### Recommended Stack

**Smart Contracts**:
- BSC Mainnet (or Polygon, Arbitrum for lower fees)
- Verify all contracts on BscScan
- Multi-sig wallet for ownership

**Automation Bot**:
- AWS EC2 / DigitalOcean / Heroku
- PM2 for process management
- Monitoring with PM2 Plus or custom alerts
- Separate wallet for bot (not owner wallet)

**Frontend**:
- Vercel / Netlify (recommended)
- Custom domain
- Environment variables via platform UI
- Enable analytics (Vercel Analytics, Google Analytics)

### Mainnet Differences

1. **Gas Costs**:
   - BSC Mainnet gas ~3-5 gwei (much cheaper than Ethereum)
   - Budget ~0.6 BNB/month for VF automation

2. **Security**:
   - Use multi-sig for contract ownership
   - Audit smart contracts before mainnet
   - Start with low stake amounts
   - Gradually increase as confidence grows

3. **Incentive Pools**:
   - Fund with real BNB for marketing/streaks
   - Start with modest amounts (1-5 BNB)
   - Top up based on usage

4. **WalletConnect**:
   - Get free Project ID from [cloud.walletconnect.com](https://cloud.walletconnect.com/)
   - Update in `.env.local`

---

## 📞 Support & Resources

### Documentation
- [VIRTUAL_FOOTBALL_FRONTEND_SUMMARY.md](./VIRTUAL_FOOTBALL_FRONTEND_SUMMARY.md)
- [AUTOMATION_GUIDE.md](./AUTOMATION_GUIDE.md)
- [GAME_FRONTEND_IMPLEMENTATION_PLAN.md](./GAME_FRONTEND_IMPLEMENTATION_PLAN.md)

### Useful Links
- BSC Testnet Faucet: https://testnet.bnbchain.org/faucet-smart
- BSCScan Testnet: https://testnet.bscscan.com/
- WalletConnect: https://cloud.walletconnect.com/
- Hardhat Docs: https://hardhat.org/
- Wagmi Docs: https://wagmi.sh/

### Deployment Artifacts
After deployment, you'll find:
- Deployment info: `deployments/deployment-fullstack-<network>-<timestamp>.json`
- Frontend env: `frontend/.env.local`
- ABIs: `frontend/lib/abis/*.json`

---

## ✅ Final Checklist

Before going live:

### Smart Contracts
- [ ] All contracts compiled successfully
- [ ] Full stack deployed to testnet
- [ ] Games registered with oracle
- [ ] Incentive pools funded
- [ ] Contracts verified on BscScan

### Automation
- [ ] VF automation bot running
- [ ] Bot can create/start/simulate/end seasons
- [ ] Bot has sufficient gas funds
- [ ] Logs are monitored

### Frontend
- [ ] All ABIs exported
- [ ] Environment variables set
- [ ] Wallet connection works
- [ ] All game flows tested
- [ ] All market flows tested
- [ ] Mobile responsive

### Production Readiness
- [ ] Smart contracts audited (if mainnet)
- [ ] Multi-sig setup (if mainnet)
- [ ] Monitoring/alerts configured
- [ ] Backup/recovery plan
- [ ] Documentation complete

---

## 🎉 You're Ready!

Your PredictBNB platform is now fully deployed and operational!

**Quick Start Commands**:
```bash
# Deploy everything
npm run deploy:full:testnet

# Export ABIs
npm run export-abis

# Start automation
npm run automate:vf

# Start frontend
cd frontend && npm run dev
```

**Next Steps**:
1. Create your first Virtual Football season
2. Test the full betting cycle
3. Monitor automation bot
4. Invite users to test
5. Gather feedback and iterate

Happy building! 🚀⚽🎮
