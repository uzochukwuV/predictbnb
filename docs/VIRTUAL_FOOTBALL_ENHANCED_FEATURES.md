# Virtual Football - Enhanced Features & Incentives

Building on the core virtual football game with seasonal competitions, voting, copy betting, and more!

---

## 🏆 Season System

### Season Structure

**Duration**: 2 weeks (336 hours)
- **Total Matches**: 336 matches (48 per day × 7 days × 2 weeks)
- **Matches per Team**: 33-34 matches per team
- **Format**: Round-robin (each team plays every other team 3-4 times)

```solidity
struct Season {
    uint32 seasonId;
    uint64 startTime;
    uint64 endTime;
    SeasonStatus status; // UPCOMING, ACTIVE, COMPLETED
    mapping(uint8 => TeamStats) teamStats;
    address[] voters; // Users who voted
    uint8 communityPredictedWinner;
    uint128 votingRewardPool;
}

struct TeamStats {
    uint16 matchesPlayed;
    uint16 wins;
    uint16 draws;
    uint16 losses;
    uint32 goalsScored;
    uint32 goalsConceded;
    int16 points; // 3 for win, 1 for draw
    uint8 position; // League position
}
```

### Season Leaderboard

Real-time league table tracked on-chain:

```
┌─────────────────────────────────────────────┐
│          SEASON 12 - STANDINGS              │
├────┬──────────────┬────┬────┬────┬────┬─────┤
│ #  │ Team         │ MP │ W  │ D  │ L  │ PTS │
├────┼──────────────┼────┼────┼────┼────┼─────┤
│ 1  │ Man City     │ 34 │ 24 │ 6  │ 4  │ 78  │
│ 2  │ Arsenal      │ 34 │ 23 │ 7  │ 4  │ 76  │
│ 3  │ Liverpool    │ 34 │ 22 │ 8  │ 4  │ 74  │
│ 4  │ Man United   │ 34 │ 18 │ 9  │ 7  │ 63  │
│ 5  │ Chelsea      │ 34 │ 17 │ 10 │ 7  │ 61  │
└────┴──────────────┴────┴────┴────┴────┴─────┘
```

---

## 🗳️ Free Voting System

### Season Winner Voting

Users vote for FREE at the start of each season:

```solidity
struct Vote {
    address voter;
    uint8 predictedWinner;
    uint64 votedAt;
    bool claimed;
}

mapping(uint32 => mapping(address => Vote)) public seasonVotes;

function voteForSeasonWinner(uint32 seasonId, uint8 teamId) external {
    require(seasons[seasonId].status == SeasonStatus.UPCOMING, "Voting closed");
    require(seasonVotes[seasonId][msg.sender].voter == address(0), "Already voted");

    seasonVotes[seasonId][msg.sender] = Vote({
        voter: msg.sender,
        predictedWinner: teamId,
        votedAt: uint64(block.timestamp),
        claimed: false
    });

    emit SeasonVoteCast(msg.sender, seasonId, teamId);
}
```

### Voting Rewards

**Reward Pool**: 1% of all season betting volume

**Distribution**:
- **Correct Voters**: Share 80% of pool proportionally
- **Early Voters**: 20% bonus for voting in first 24 hours
- **PREDICT Token Bonus**: 2x airdrop points for correct predictions

**Example**:
```
Season 12 Betting Volume: 100 BNB
Voting Reward Pool: 1 BNB (1%)

Correct Voters: 150 users
Pool per user: 0.0053 BNB (~$3.20)

Early voters (first 24h): 50 users
Bonus: +20% = 0.00106 BNB extra

Total for early correct voter: 0.00636 BNB (~$3.80)
```

**Community Prediction Tracking**:
```solidity
function getCommunityPrediction(uint32 seasonId) public view returns (
    uint8 mostVotedTeam,
    uint256 voteCount,
    uint256 totalVotes
) {
    // Track which team has most votes
    // Display as "Community Prediction: Arsenal (42%)"
}
```

---

## 📋 Copy Betting (Follow the Pros)

### Tipster System

Users can become "tipsters" and others can copy their bets:

```solidity
struct Tipster {
    address tipsterAddress;
    string name;
    uint32 totalBets;
    uint32 winningBets;
    uint128 totalProfit;
    uint128 followersCount;
    uint16 winRate; // percentage
    bool isVerified;
}

struct CopySettings {
    address tipster;
    uint128 maxBetAmount; // Max to copy per bet
    uint128 totalBudget; // Total budget for copying
    bool autoFollow; // Auto-copy all bets
    BetType[] allowedTypes; // Only copy certain bet types
}
```

### How Copy Betting Works

1. **Tipster places bet** → Bet is recorded with tipster tag
2. **Copiers automatically** get notified
3. **Auto-copy enabled** → Bet is placed for copier (same selection, their amount)
4. **Tipster earns** → 2% of copier's winnings

```solidity
function placeBetAsTipster(
    uint64 matchId,
    BetType betType,
    uint8 selection,
    uint128 amount
) external {
    // Place normal bet
    uint256 betId = _placeBet(msg.sender, matchId, betType, selection, amount);

    // Mark as tipster bet
    tipsterBets[betId] = msg.sender;

    // Notify followers
    emit TipsterBetPlaced(msg.sender, betId, matchId, betType, selection);

    // Auto-copy for followers
    _processCopyBets(msg.sender, betId, matchId, betType, selection);
}

function _processCopyBets(
    address tipster,
    uint256 originalBetId,
    uint64 matchId,
    BetType betType,
    uint8 selection
) internal {
    address[] memory copiers = tipsterFollowers[tipster];

    for (uint i = 0; i < copiers.length; i++) {
        CopySettings memory settings = copySettings[copiers[i]];

        if (!settings.autoFollow) continue;
        if (!_isAllowedBetType(settings, betType)) continue;

        uint128 copyAmount = min(settings.maxBetAmount, settings.totalBudget);
        if (copyAmount == 0) continue;

        // Place copy bet
        uint256 copyBetId = _placeBet(copiers[i], matchId, betType, selection, copyAmount);

        // Link to original
        copiedBets[copyBetId] = originalBetId;

        emit BetCopied(copiers[i], tipster, copyBetId, originalBetId);
    }
}
```

### Tipster Leaderboard

```
┌──────────────────────────────────────────────────────────┐
│               TOP TIPSTERS - SEASON 12                   │
├────┬──────────────┬──────┬──────┬────────┬───────────────┤
│ #  │ Tipster      │ Bets │ Win% │ Profit │ Followers     │
├────┼──────────────┼──────┼──────┼────────┼───────────────┤
│ 1  │ ProBetter88  │ 234  │ 68%  │ +45BNB │ 1,234 👥      │
│ 2  │ FootyKing    │ 189  │ 65%  │ +38BNB │ 892 👥       │
│ 3  │ LuckyPunter  │ 301  │ 62%  │ +32BNB │ 654 👥       │
│ 4  │ SharpBets    │ 156  │ 71%  │ +29BNB │ 543 👥       │
│ 5  │ TheOracle    │ 278  │ 59%  │ +25BNB │ 421 👥       │
└────┴──────────────┴──────┴──────┴────────┴───────────────┘

[Follow] [View Bets] [Stats]
```

### Tipster Earnings

Tipsters earn 2% of their followers' winnings:

```
Follower wins 1 BNB
Tipster earns: 0.02 BNB (2%)

If tipster has 100 active followers:
Average follower win: 0.5 BNB/day
Tipster earnings: 1 BNB/day = $600/day = $18,000/month
```

---

## 🎫 Betting Slip (Multi-Bet System)

### Bet Slip Features

```solidity
struct BetSlip {
    uint256 slipId;
    address bettor;
    Bet[] bets;
    BetSlipType slipType; // SINGLE, MULTI, SYSTEM
    uint128 totalStake;
    uint128 potentialWinnings;
    uint16 totalOdds; // Multiplied odds
    BetSlipStatus status; // PENDING, WON, LOST, PARTIAL
}

struct Bet {
    uint64 matchId;
    BetType betType;
    uint8 selection;
    uint16 odds;
    bool isWon;
}
```

### Bet Types

1. **Single Bet**
   - One selection
   - Simple payout

2. **Multi Bet (Accumulator)**
   - Multiple selections (2-10)
   - Odds multiply
   - All must win

3. **System Bet**
   - E.g., "3/5" - pick 5, need 3 to win
   - Partial returns possible
   - More complex payouts

```typescript
// Example Multi-Bet
Bet 1: Man City Win @ 1.5
Bet 2: Arsenal Win @ 1.8
Bet 3: Liverpool Over 2.5 @ 2.0

Total Odds: 1.5 × 1.8 × 2.0 = 5.4
Stake: 0.1 BNB
Potential: 0.54 BNB

If all win: 0.54 BNB
If one loses: 0 BNB
```

### Bet Slip UI

```
┌─────────────────────────────────────────────┐
│            YOUR BET SLIP                    │
├─────────────────────────────────────────────┤
│ 1. Man City vs Arsenal                      │
│    → Man City Win @ 1.50                    │
│    [Remove]                                 │
├─────────────────────────────────────────────┤
│ 2. Liverpool vs Chelsea                     │
│    → Over 2.5 Goals @ 2.00                  │
│    [Remove]                                 │
├─────────────────────────────────────────────┤
│ 3. Man Utd vs Tottenham                     │
│    → Both Teams Score @ 1.75                │
│    [Remove]                                 │
├─────────────────────────────────────────────┤
│ Bet Type: ● Single  ○ Multi  ○ System       │
│                                             │
│ Total Odds: 5.25                            │
│ Stake: [0.1] BNB                            │
│ Potential Win: 0.525 BNB                    │
│                                             │
│ [Place Bet] [Clear Slip] [Save for Later]  │
└─────────────────────────────────────────────┘
```

---

## 🎁 Additional Incentive Ideas

### 1. Streak Betting Bonus

**Daily Betting Streaks** (separate from query streaks):

```solidity
struct BettingStreak {
    uint16 currentStreak;
    uint16 longestStreak;
    uint64 lastBetDay;
    uint128 bonusEarned;
}

// Bonus for consecutive days betting
7 days: +5% on all winnings
14 days: +10% on all winnings
30 days: +15% on all winnings
60 days: +20% on all winnings
90 days: +25% on all winnings + NFT Badge
```

### 2. Loyalty Tiers

**Based on total betting volume**:

```
Bronze: 0-10 BNB volume
  - Base odds
  - Standard features

Silver: 10-50 BNB
  - +2% better odds
  - Priority customer support
  - Exclusive betting tips

Gold: 50-200 BNB
  - +5% better odds
  - Early access to new markets
  - Free betting insurance (1/week)
  - VIP badge

Platinum: 200+ BNB
  - +10% better odds
  - Personal tipster access
  - Cashback on losses (5%)
  - Exclusive tournaments
  - Diamond NFT badge
```

### 3. Betting Insurance

**Protect your bets**:

```solidity
// Pay 10% extra to insure your bet
// If lost, get 50% stake back

function placeBetWithInsurance(
    uint64 matchId,
    BetType betType,
    uint8 selection,
    uint128 amount
) external payable {
    uint128 insuranceFee = amount / 10; // 10%
    require(msg.value >= amount + insuranceFee);

    uint256 betId = _placeBet(msg.sender, matchId, betType, selection, amount);
    insuredBets[betId] = true;

    emit BetInsured(betId, insuranceFee);
}
```

### 4. Jackpot Accumulator

**Weekly Jackpot Challenge**:

```
Pick 10 correct match results in a week
Entry: 0.01 BNB
Jackpot Pool: All entry fees
Winner: First to get all 10 correct

If no winner: Rollover to next week

Example:
Week 1: 1,000 entries = 10 BNB pool
Week 2: 1,500 entries + 10 BNB rollover = 25 BNB pool
Winner gets: 25 BNB (~$15,000)
```

### 5. Social Betting Pools

**Create/Join betting pools**:

```solidity
struct BettingPool {
    uint256 poolId;
    address creator;
    string name;
    uint128 entryFee;
    uint128 prizePool;
    address[] members;
    uint32 seasonId;
    bool isPrivate;
}

// Example: "Office Pool"
Entry: 0.1 BNB
Members: 20
Prize Pool: 2 BNB
Winner: Member with most correct predictions
```

### 6. Achievements & NFT Badges

**Unlock achievements for special actions**:

```
🏆 First Blood - Place your first bet
🎯 Sharp Shooter - Win 10 bets in a row
🔥 Hot Streak - Maintain 30-day betting streak
🎰 Risk Taker - Win a 10-leg accumulator
👑 Season King - Win season prediction 3 times
💎 Whale - Bet over 100 BNB total
🧠 Prophet - Win 75%+ of bets (min 100 bets)

Each unlocks an NFT badge + PREDICT token bonus
```

### 7. Live Bet Multipliers

**Dynamic odds during "match"**:

```
Before match: Liverpool Win @ 2.0
15th minute: Liverpool Win @ 1.8 (if 0-0)
30th minute: Liverpool Win @ 1.5 (if 1-0 Liverpool)

Live betting window: 5 minutes after match starts
Multipliers adjust based on "current score"
```

### 8. Cash Out Feature

**Exit bets early**:

```solidity
function cashOut(uint256 betId) external {
    Bet storage bet = bets[betId];
    require(bet.bettor == msg.sender);
    require(bet.status == BetStatus.PENDING);

    // Calculate current cash out value (70-90% of stake)
    uint128 cashOutAmount = _calculateCashOut(betId);

    bet.status = BetStatus.CASHED_OUT;
    payable(msg.sender).transfer(cashOutAmount);

    emit BetCashedOut(betId, cashOutAmount);
}
```

### 9. Referral Tournament

**Monthly referral competitions**:

```
Top 10 referrers each month:
1st: 10 BNB + Platinum tier
2nd: 5 BNB + Gold tier
3rd: 3 BNB + Silver tier
4th-10th: 1 BNB each

Tracked automatically via referral system
```

### 10. Price Boost Promotions

**Random matches get boosted odds**:

```
"Happy Hour" (3-4pm daily)
Selected match: Arsenal vs Liverpool
Normal: Arsenal Win @ 2.0
Boosted: Arsenal Win @ 2.5 (25% boost)

Limited to 100 BNB total volume
First come, first served
```

---

## 📊 Enhanced Statistics Tracking

### Personal Stats Dashboard

```
YOUR SEASON 12 STATS
────────────────────────────────────────
Total Bets: 234
Win Rate: 62.4%
Profit/Loss: +12.5 BNB ($7,500)
Biggest Win: 5.2 BNB (10-leg accumulator)
Favorite Team: Man City (45 bets)
Best Market: Over/Under (68% win rate)
Betting Streak: 23 days 🔥
Rank: #142 out of 5,420 users
Achievements: 12/20 unlocked
```

### Seasonal Leaderboards

```
1. Global Leaderboard (Most Profit)
2. Win Rate Leaderboard (Min 50 bets)
3. Tipster Leaderboard (Most Followers)
4. Accumulator King (Biggest Multi-Bet Win)
5. Season Prophet (Most Correct Season Predictions)
```

---

## 💰 Revenue Impact

### Additional Revenue Streams

| Feature | Revenue Model | Est. Monthly |
|---------|--------------|--------------|
| Copy Betting (Tipster Fees) | 2% of copier winnings | $2,000 |
| Betting Insurance | 10% premium | $1,500 |
| Jackpot Entry Fees | 10% platform fee | $1,000 |
| Loyalty Tier Upgrades | One-time $50 | $2,500 |
| NFT Badge Sales | $10-50 per badge | $1,000 |
| Social Pool Creation | 2% pool fee | $800 |
| **Total Additional** | | **$8,800/month** |

**Combined with original**: $17,000 + $8,800 = **$25,800/month**

---

## 🚀 Implementation Priority

### Phase 1 (Week 1-2): Core + Seasons
- ✅ Season system with league table
- ✅ Free voting system
- ✅ Voting rewards distribution
- ✅ Basic statistics

### Phase 2 (Week 3): Betting Slip
- ✅ Multi-bet (accumulator)
- ✅ System bets
- ✅ Bet slip UI

### Phase 3 (Week 4): Social Features
- ✅ Copy betting / Tipster system
- ✅ Betting pools
- ✅ Achievements & NFT badges

### Phase 4 (Week 5+): Polish
- ✅ Loyalty tiers
- ✅ Betting insurance
- ✅ Cash out
- ✅ Live multipliers

---

## 🎯 User Retention Strategy

### Daily Engagement Loop

```
Morning:
→ Check yesterday's results
→ Collect winnings
→ See new match schedule

Midday:
→ Vote in jackpot challenge
→ Copy trending tipster
→ Check leaderboard position

Evening:
→ Place bets for next window
→ Build accumulator
→ Join betting pool

Night:
→ Watch live updates
→ Cash out if needed
→ Earn streak bonus
```

### Weekly Engagement

```
Monday: New season starts, cast your vote
Tuesday: Join weekly jackpot challenge
Wednesday: Happy Hour boosted odds
Thursday: Check mid-season standings
Friday: Tipster tournament
Saturday: Social pool finals
Sunday: Season ends, claim rewards
```

Ready to implement these features? I can start with the seasonal system and voting mechanics!
