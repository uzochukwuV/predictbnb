# Virtual Football Game - Design Document

A provably fair virtual football betting game inspired by Bet9ja Virtuals, built on BNB Chain with Chainlink VRF for randomness.

---

## 🎮 Game Concept

### Overview
- **10 Premier League teams** play in pairs (5 matches) every 30 minutes
- Scores are **randomized using Chainlink VRF** for provable fairness
- Each match produces a clear **winner or draw**
- Results feed into **prediction markets** where users bet on outcomes
- All data is **monetized** through the oracle system ($1.44 per query)

### Match Flow
```
Match Window: Every 30 minutes (48 matches/day)

1. Teams are paired (5 matches per window)
2. Betting opens (5 minutes before)
3. VRF request for randomness
4. Scores calculated using random seed
5. Results published to oracle
6. Prediction markets resolved
7. Winners claim payouts
```

---

## 🏆 Teams & Scoring

### Premier League Teams (10 Teams)
1. Manchester City
2. Arsenal
3. Liverpool
4. Manchester United
5. Chelsea
6. Tottenham
hotspur
7. Newcastle United
8. Brighton
9. Aston Villa
10. West Ham United

### Score Generation Algorithm

Using Chainlink VRF random number to generate realistic scores:

```solidity
// Probability distribution (matches real football)
0-0: 10%    1-0: 15%    2-0: 12%    3-0: 8%     4-0: 3%
0-1: 15%    1-1: 12%    2-1: 10%    3-1: 5%     4-1: 2%
0-2: 12%    1-2: 10%    2-2: 8%     3-2: 3%     4-2: 1%
0-3: 8%     1-3: 5%     2-3: 3%     3-3: 2%
0-4: 3%     1-4: 2%     2-4: 1%

Most common: 1-0, 0-1, 1-1, 2-0, 2-1 (covers ~65%)
High scores rare: 4-0, 4-1, etc. (~5%)
```

### Team Strength Modifiers

Each team has a strength rating (70-95) affecting score probability:

```javascript
const teamStrengths = {
  "Manchester City": 95,
  "Arsenal": 92,
  "Liverpool": 90,
  "Manchester United": 85,
  "Chelsea": 83,
  "Tottenham": 82,
  "Newcastle": 80,
  "Brighton": 78,
  "Aston Villa": 75,
  "West Ham": 73
}

// Stronger teams get bonus to score generation
scoreProbability += (homeTeamStrength - awayTeamStrength) / 10
```

---

## 📊 Prediction Market Integration

### Market Types

1. **Match Result** (1X2)
   - Home Win (1)
   - Draw (X)
   - Away Win (2)

2. **Over/Under Goals**
   - Over 2.5 goals
   - Under 2.5 goals

3. **Both Teams To Score (BTTS)**
   - Yes
   - No

4. **Correct Score**
   - Specific score prediction (e.g., 2-1)
   - Higher payouts

5. **Accumulator (Parlay)**
   - Bet on multiple matches
   - Multiplied odds

### Odds Calculation

Dynamic odds based on:
- Team strength differential
- Current bet distribution (parimutuel)
- Historical results

```solidity
// Example odds for Manchester City vs West Ham
Home Win: 1.40 (implied 71% probability)
Draw: 4.50 (22%)
Away Win: 9.00 (11%)

// Adjusted based on betting:
If 80% bet on Home Win → odds decrease to 1.25
If 10% bet on Away Win → odds increase to 12.00
```

---

## 🎲 Technical Architecture

### Smart Contracts

#### 1. VirtualFootball.sol
```solidity
// Main game contract
- Manages 10 teams
- Schedules matches every 30 minutes
- Requests VRF randomness
- Calculates scores from random seed
- Publishes results to GameRegistry
- Emits match results
```

#### 2. FootballPredictionMarket.sol
```solidity
// Prediction market for virtual football
- Creates markets for each match
- Accepts bets (1X2, O/U, BTTS, Correct Score)
- Calculates dynamic odds
- Resolves markets using oracle data
- Distributes winnings (parimutuel)
- Charges 2% platform fee
```

#### 3. VRFCoordinator Integration
```solidity
// Chainlink VRF for randomness
- Request random words for each match window
- 5 random numbers (one per match)
- Callback with results
- Derives team scores deterministically
```

---

## 🔧 Implementation Details

### Match Scheduling

```solidity
struct MatchWindow {
    uint64 windowId;
    uint64 startTime;
    uint64 endTime;
    Match[5] matches;
    uint256 vrfRequestId;
    bool resultsPublished;
}

struct Match {
    uint8 homeTeamId;
    uint8 awayTeamId;
    uint8 homeScore;
    uint8 awayScore;
    MatchResult result; // HOME_WIN, DRAW, AWAY_WIN
}

// Auto-schedule next window
function scheduleNextWindow() internal {
    uint64 nextStart = currentWindow.endTime;
    uint64 nextEnd = nextStart + 30 minutes;

    // Randomly pair teams
    pairTeams(nextWindowId);

    // Create markets
    createMarketsForWindow(nextWindowId);
}
```

### VRF Integration

```solidity
// Request randomness 5 mins before match
function requestRandomness(uint64 windowId) external {
    require(block.timestamp >= windows[windowId].startTime - 5 minutes);

    uint256 requestId = vrfCoordinator.requestRandomWords(
        keyHash,
        subscriptionId,
        requestConfirmations,
        callbackGasLimit,
        numWords: 5 // 5 matches
    );

    windows[windowId].vrfRequestId = requestId;
    emit RandomnessRequested(windowId, requestId);
}

// VRF callback
function fulfillRandomWords(
    uint256 requestId,
    uint256[] memory randomWords
) internal override {
    uint64 windowId = requestIdToWindow[requestId];

    for (uint i = 0; i < 5; i++) {
        Match storage match = windows[windowId].matches[i];

        // Generate scores from random seed
        (match.homeScore, match.awayScore) = calculateScores(
            randomWords[i],
            match.homeTeamId,
            match.awayTeamId
        );

        // Determine result
        if (match.homeScore > match.awayScore) {
            match.result = MatchResult.HOME_WIN;
        } else if (match.homeScore < match.awayScore) {
            match.result = MatchResult.AWAY_WIN;
        } else {
            match.result = MatchResult.DRAW;
        }
    }

    publishResults(windowId);
}
```

### Score Generation

```solidity
function calculateScores(
    uint256 randomSeed,
    uint8 homeTeamId,
    uint8 awayTeamId
) internal view returns (uint8 homeScore, uint8 awayScore) {
    uint8 homeStrength = teamStrengths[homeTeamId];
    uint8 awayStrength = teamStrengths[awayTeamId];

    // Split random seed
    uint256 homeSeed = uint256(keccak256(abi.encode(randomSeed, "home")));
    uint256 awaySeed = uint256(keccak256(abi.encode(randomSeed, "away")));

    // Generate base scores (0-5 goals)
    homeScore = uint8(homeSeed % 6);
    awayScore = uint8(awaySeed % 6);

    // Apply team strength modifiers
    int8 strengthDiff = int8(homeStrength) - int8(awayStrength);

    if (strengthDiff > 10) {
        // Strong home advantage
        if (homeSeed % 100 < 60) homeScore++; // 60% chance +1
        if (awaySeed % 100 < 20) awayScore = awayScore > 0 ? awayScore - 1 : 0;
    } else if (strengthDiff < -10) {
        // Strong away advantage
        if (awaySeed % 100 < 60) awayScore++;
        if (homeSeed % 100 < 20) homeScore = homeScore > 0 ? homeScore - 1 : 0;
    }

    // Cap at 5 goals
    homeScore = homeScore > 5 ? 5 : homeScore;
    awayScore = awayScore > 5 ? 5 : awayScore;
}
```

---

## 💰 Monetization Model

### Revenue Streams

1. **Oracle Query Fees**
   - Prediction markets query match results
   - $1.44 per query (80% to game developer = you)
   - 5 matches × N markets = multiple queries per window
   - ~240 queries/day = $345/day = **$10,350/month**

2. **Prediction Market Fees**
   - 2% platform fee on all bets
   - If $10,000 bet volume/day = $200/day
   - **$6,000/month**

3. **Premium Features**
   - Live match animations (NFT teams)
   - Historical statistics access
   - API access for third parties
   - **$1,000-5,000/month**

**Total Potential: $17,000-21,000/month**

### User Incentives

All existing incentives apply:
- ✅ **Referral bonuses** (20% for referee, 10% for referrer)
- ✅ **Streak rewards** (daily betting streaks)
- ✅ **Lucky draw** (weekly lottery for bettors)
- ✅ **PREDICT token airdrops** (based on betting volume)

---

## 🎯 User Experience

### Frontend Flow

1. **Home Page**
   ```
   Current Match Window: 14:30 - 15:00

   ⚽ LIVE MATCHES
   [Man City 2 - 1 Arsenal]     FT
   [Liverpool 0 - 0 Chelsea]    45'
   [Man Utd vs Tottenham]       Starting in 5:23

   🎲 PLACE YOUR BETS
   [Man Utd vs Tottenham]
   1  X  2
   2.10  3.20  3.50
   [Bet Now]
   ```

2. **Match Detail Page**
   ```
   Man City vs Arsenal
   Kickoff: 14:30

   MARKETS:
   ✓ Match Result (1X2)
   ✓ Over/Under 2.5
   ✓ Both Teams Score
   ✓ Correct Score

   YOUR BETS:
   Man City Win - 0.1 BNB @ 2.10
   Potential: 0.21 BNB
   ```

3. **Live Animation** (Optional Premium)
   ```
   [Animated 2D football field]
   [Team logos moving]
   [Score updates]
   [Goal celebrations]
   ```

---

## 🚀 Launch Strategy

### Phase 1: MVP (Week 1-2)
- ✅ Deploy VirtualFootball contract
- ✅ Integrate Chainlink VRF
- ✅ Basic match scheduling (every 30 mins)
- ✅ Simple 1X2 prediction market
- ✅ Register with GameRegistry

### Phase 2: Markets (Week 3)
- ✅ Add Over/Under markets
- ✅ Add BTTS markets
- ✅ Add Correct Score markets
- ✅ Dynamic odds calculation

### Phase 3: Polish (Week 4)
- ✅ Frontend with live updates
- ✅ Match history & statistics
- ✅ Accumulator (parlay) bets
- ✅ Mobile optimization

### Phase 4: Marketing (Week 5+)
- ✅ Referral campaign
- ✅ Airdrop to early bettors
- ✅ Partnership with betting communities
- ✅ Influencer promotions

---

## 📈 Growth Projections

### Conservative (3 months)
- 100 daily active users
- $50 average bet/user/day
- 10 bets/user/day
- **$5,000 daily volume = $150,000/month**
- Your cut: ~15% = **$22,500/month**

### Aggressive (6 months)
- 1,000 daily active users
- $100 average bet/user/day
- 15 bets/user/day
- **$100,000 daily volume = $3,000,000/month**
- Your cut: ~15% = **$450,000/month**

### Market Size Reference
- Bet9ja Virtuals: ~$10M daily volume
- Target: 1% of that = **$100K/day** is achievable

---

## 🔐 Security Considerations

### VRF Security
- ✅ Use Chainlink VRF V2 (proven, audited)
- ✅ Subscription model (no per-request payment)
- ✅ Randomness cannot be predicted or manipulated
- ✅ Results are deterministic from seed

### Game Integrity
- ✅ Matches scheduled on-chain (transparent)
- ✅ Results published immediately after VRF
- ✅ No admin override of results
- ✅ All logic open-source and auditable

### Market Security
- ✅ Bets locked before match starts
- ✅ Parimutuel system (no house risk)
- ✅ Emergency pause function
- ✅ Non-custodial (users keep funds)

---

## 🎨 Differentiation from Bet9ja

| Feature | Bet9ja Virtuals | PredictBNB Virtual Football |
|---------|----------------|----------------------------|
| Randomness | Centralized RNG | Chainlink VRF (verifiable) |
| Trust | Trust the platform | Trust the blockchain |
| Transparency | Opaque | Fully transparent |
| Fees | High (15-20%) | Low (2% + gas) |
| Ownership | Centralized | Decentralized |
| Earnings | Platform only | Developers earn too |
| Incentives | None | Referrals, airdrops, rewards |

**Key Advantage**: "The ONLY provably fair virtual football game on blockchain"

---

## 📋 Next Steps

1. **Smart Contract Development** (This week)
   - VirtualFootball.sol
   - FootballPredictionMarket.sol
   - Chainlink VRF integration

2. **Frontend Development** (Next week)
   - Match schedule display
   - Betting interface
   - Live score updates

3. **Testing** (Week 3)
   - Testnet deployment
   - VRF randomness testing
   - Market resolution testing

4. **Mainnet Launch** (Week 4)
   - Deploy to BSC
   - Marketing campaign
   - User onboarding

---

## 💡 Additional Ideas

### Future Enhancements
- 🏆 **Tournaments**: Weekly tournaments with prize pools
- 📊 **Statistics**: Team form, head-to-head records
- 🎮 **Fantasy League**: Pick your team, earn points
- 🌍 **Other Leagues**: La Liga, Serie A, Bundesliga
- ⚽ **Other Sports**: Basketball, Tennis, Racing

### Premium Features
- 🎬 **Replay System**: Watch match highlights
- 📈 **Advanced Stats**: xG, possession, shots
- 🤖 **AI Predictions**: ML-powered bet suggestions
- 🎨 **NFT Teams**: Collect and trade team cards

---

Ready to build this? Let's start with the smart contracts!
