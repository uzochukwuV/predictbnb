# Game & Prediction Market Frontend Implementation Plan

## Overview

We have **2 complete game ecosystems**, each with a game contract and prediction market:

1. **Rock Paper Scissors (RPS)** - Simple 1v1 card game
2. **Virtual Football** - Automated season-based football simulation

Each system has distinct flows for **Game Side** and **Prediction Market Side**.

---

## 🎮 System 1: Rock Paper Scissors

### Contract Architecture

```
┌─────────────────────────┐         ┌──────────────────────────┐
│  RockPaperScissors.sol  │ ──────▶ │    OracleCore.sol        │
│  (Game Contract)        │ Submit  │    (Result Storage)      │
│                         │  Result │                          │
└─────────────────────────┘         └──────────────────────────┘
                                              ▲
                                              │ Query
                                    ┌─────────┴────────────────┐
                                    │ RPSPredictionMarket.sol  │
                                    │ (Betting Contract)       │
                                    └──────────────────────────┘
```

### Game Side Flow (RockPaperScissors.sol)

#### **Current State**: Already implemented at `/game/rps`

**How It Works**:
1. **Match Scheduling**: Owner schedules match between two players at future time
2. **Player 1 Commits**: First player commits moves (gets 3 random cards)
3. **Player 2 Commits**: Second player commits moves (gets 3 random cards)
4. **Auto-Resolution**: Cards are revealed, winner determined, result submitted to oracle
5. **Oracle Storage**: Match result stored in OracleCore

**Key Functions**:
```solidity
scheduleMatch(address player1, address player2, uint64 scheduledTime)
commitPlayer1(bytes32 matchId) // Generates random cards for P1
commitPlayer2(bytes32 matchId) // Generates random cards for P2, resolves match
```

**Data Structures**:
```solidity
struct RPSMatch {
    bytes32 matchId;
    address player1;
    address player2;
    Card[3] player1Cards;  // 3 cards: ROCK, PAPER, SCISSORS
    Card[3] player2Cards;
    address winner;        // address(0) = tie
    uint8 player1Wins;
    uint8 player2Wins;
    MatchStatus status;
}
```

---

### Prediction Market Side Flow (RPSPredictionMarket.sol)

**How It Works**:
1. **Market Creation**: Market created for an RPS match (links to oracle matchId)
2. **Betting Phase**: Users bet on Player 1, Player 2, or Tie (before deadline)
3. **Match Plays**: Game contract plays match and submits to oracle
4. **Market Resolution**: Market queries oracle for result
5. **Claim Winnings**: Winners claim proportional share of pool (minus 2% fee)

**Key Functions**:
```solidity
createMarket(bytes32 matchId, address player1, address player2, uint64 deadline)
placeBet(uint256 marketId, address predictedWinner) payable
resolveMarket(uint256 marketId) // Queries oracle
claimWinnings(uint256 marketId)
```

**Data Structures**:
```solidity
struct Market {
    bytes32 matchId;
    address player1;
    address player2;
    uint256 totalPool;
    uint256 player1Pool;   // Bets on player 1
    uint256 player2Pool;   // Bets on player 2
    uint256 tiePool;       // Bets on tie
    bool isResolved;
    address winner;
}

struct Bet {
    address bettor;
    address predictedWinner;  // address(0) = tie
    uint256 amount;
    bool claimed;
}
```

---

## ⚽ System 2: Virtual Football

### Contract Architecture

```
┌──────────────────────────┐         ┌──────────────────────────┐
│  VirtualFootballGame.sol │ ──────▶ │    OracleCore.sol        │
│  (Game Contract)         │ Submit  │    (Result Storage)      │
│  - Creates seasons       │  Result │                          │
│  - Simulates matches     │         │                          │
└──────────────────────────┘         └──────────────────────────┘
                                              ▲
                                              │ Query
                                    ┌─────────┴───────────────────┐
                                    │ VirtualFootballMarket.sol   │
                                    │ (Betting + Voting Contract) │
                                    │ - Match betting             │
                                    │ - Season voting             │
                                    │ - Tipster system            │
                                    └─────────────────────────────┘
```

### Game Side Flow (VirtualFootballGame.sol)

**How It Works**:
1. **Game Registration**: Register with PredictBNB (pay 0.1 BNB stake)
2. **Season Creation**: Create season with start time
3. **Season Start**: Generate 20 matches (10-min intervals, 1-day season)
   - Schedules ALL matches with oracle upfront
4. **Match Simulation**: Anyone can call `simulateMatch()` after kickoff
   - Generates random scores (0-5 goals each)
   - Submits result to oracle
   - Updates team stats (wins, points, goals)
5. **Season End**: Determine winner (team with most points)

**Key Functions**:
```solidity
registerGame() payable // One-time, 0.1 BNB stake
createSeason(uint64 startTime) returns (uint32 seasonId)
startSeason(uint32 seasonId) // Generates 20 matches
simulateMatch(uint64 matchId) // Simulates and submits result
endSeason(uint32 seasonId) // Calculates winner
```

**Data Structures**:
```solidity
struct Season {
    uint32 seasonId;
    uint64 startTime;
    uint64 endTime;
    SeasonStatus status; // UPCOMING, ACTIVE, COMPLETED
    uint16 totalMatches;
    uint8 winner;
}

struct Match {
    uint64 matchId;
    uint32 seasonId;
    uint8 homeTeam;      // 0-9 (team index)
    uint8 awayTeam;
    uint64 kickoffTime;
    uint8 homeScore;
    uint8 awayScore;
    bytes32 oracleMatchId;
    bool isFinalized;
}

struct TeamStats {
    uint8 teamId;
    uint8 wins;
    uint8 draws;
    uint8 losses;
    uint8 goalsFor;
    uint8 goalsAgainst;
    int16 points; // 3 per win, 1 per draw
}
```

**Teams** (10 Premier League teams):
- Manchester City, Arsenal, Liverpool, Man United, Chelsea
- Tottenham, Newcastle, Brighton, Aston Villa, West Ham

---

### Prediction Market Side Flow (VirtualFootballMarket.sol)

**How It Works**:

#### **A. Season Voting (FREE)**
1. **Before Season**: Users vote for which team will win the season (FREE)
2. **Early Voter Bonus**: Vote >1 day before start → 20% bonus
3. **Season Completes**: Determine actual winner
4. **Claim Rewards**: Correct voters share 1% of total season betting volume

#### **B. Match Betting (PAID)**
1. **View Matches**: See upcoming matches with teams and kickoff times
2. **Place Bet**: Choose bet type and selection:
   - **MATCH_WINNER**: Home Win (0), Draw (1), Away Win (2)
   - **OVER_UNDER**: Under 2.5 goals (0), Over 2.5 (1)
   - **BOTH_TEAMS_SCORE**: No (0), Yes (1)
3. **Dynamic Odds**: Parimutuel odds based on pool distribution
4. **Match Plays**: Game contract simulates and submits to oracle
5. **Settle Bet**: Query oracle for result, determine win/loss
6. **Claim Winnings**: Winners claim payout (amount × odds - 5% fee)

#### **C. Tipster System (OPTIONAL)**
1. **Register as Tipster**: Create tipster profile with name
2. **Place Bets**: Tipsters place public bets others can copy
3. **Follow Tipster**: Users follow tipsters to see their bets
4. **Copy Bet**: Followers can copy tipster's bets
5. **Commission**: Tipsters earn 2% of copier's winnings

**Key Functions**:
```solidity
// Voting
voteForSeasonWinner(uint32 seasonId, uint8 teamId)
claimVotingReward(uint32 seasonId)

// Betting
placeBet(uint64 matchId, BetType betType, uint8 selection, uint128 amount) payable
settleBet(uint256 betId) // Queries oracle
claimBet(uint256 betId) // Claims winnings

// Tipster
registerAsTipster(string name)
followTipster(address tipster)
placeBetAsTipster(...)
copyBet(uint256 tipsterBetId, uint128 amount) payable
```

**Data Structures**:
```solidity
struct SingleBet {
    uint256 betId;
    uint64 gameMatchId;
    BetType betType;
    uint8 selection;
    uint128 amount;
    uint16 odds;  // Dynamic, calculated on placement
    bool isSettled;
    bool isWon;
    bool isClaimed;
}

struct Vote {
    uint8 predictedWinner;
    bool isEarlyVoter;
    bool claimed;
}

struct Tipster {
    string name;
    uint32 totalBets;
    uint32 winningBets;
    int128 totalProfit;
    uint32 followersCount;
    uint16 winRate; // Basis points
}
```

---

## 📱 Frontend Implementation Plan

### Phase 1: Rock Paper Scissors System ✅ (Partially Done)

**Current**: `/game/rps` already exists

**Enhancements Needed**:

#### 1. Game Page Improvements (`/game/rps`)
- [ ] Better match scheduling UI
- [ ] Show match history
- [ ] Display player stats (wins/losses)
- [ ] Show upcoming scheduled matches
- [ ] Real-time status updates

#### 2. RPS Prediction Market (`/predict/rps`)
**New Page Required**

**Features**:
- **Active Markets List**:
  - Show all open betting markets
  - Display Player 1 vs Player 2
  - Show betting deadline countdown
  - Show pool sizes (P1, P2, Tie)

- **Place Bet Modal**:
  - Select prediction (Player 1, Player 2, Tie)
  - Enter bet amount
  - Show potential payout
  - Confirm transaction

- **My Bets Section**:
  - List user's active bets
  - Show resolved bets (won/lost)
  - Claim winnings button
  - Total winnings tracker

- **Market Resolution**:
  - Resolve button (anyone can call)
  - Show winning outcome
  - Display final pool distribution

**Pages Structure**:
```
/game/rps              # ✅ Game side (existing)
/predict/rps           # ❌ Market side (NEW)
```

---

### Phase 2: Virtual Football System (MVP Focus)

#### 1. Virtual Football Game Dashboard (`/game/vfootball`)
**New Page Required**

**Features**:

**Season Management** (Owner only):
- Create new season button
- Start season button
- Current season info (ID, status, dates)

**Current Season View**:
- **League Table**:
  ```
  Pos | Team              | Played | W  | D  | L  | GF | GA | Pts
  1   | Manchester City   | 8      | 6  | 1  | 1  | 18 | 7  | 19
  2   | Arsenal           | 8      | 5  | 2  | 1  | 15 | 8  | 17
  ...
  ```

- **Upcoming Matches** (next 5):
  ```
  Kickoff          | Match
  14:30 (2 min)    | Man City vs Arsenal
  14:40 (12 min)   | Liverpool vs Chelsea
  ```

- **Live/Recent Matches** (last 5):
  ```
  Time      | Match                    | Score  | Status
  14:20     | Tottenham vs Newcastle   | 2-1    | ✅ Final
  14:10     | Brighton vs West Ham     | 1-1    | ✅ Final
  ```

- **Simulate Match Button**:
  - Clickable for matches past kickoff
  - Shows transaction pending
  - Updates table after simulation

**Match Details Modal**:
- Team names and logos
- Kickoff time
- Current score (if played)
- Oracle submission status
- Link to prediction market

---

#### 2. Virtual Football Prediction Market (`/predict/vfootball`)
**New Page Required**

**Features**:

**A. Season Voting Tab**:
- **Vote for Winner** (before season):
  - Grid of 10 teams
  - Click to vote (FREE transaction)
  - Show vote counts per team
  - Early voter badge if >1 day before

- **My Votes**:
  - Show seasons voted on
  - Display prediction
  - Claim reward button (if won)
  - Reward amount

- **Leaderboard**:
  - Most voted team
  - Community prediction
  - Total voters

**B. Match Betting Tab**:
- **Upcoming Matches Grid**:
  ```
  ┌──────────────────────────────────────────┐
  │  Man City vs Arsenal                     │
  │  Kickoff: 14:30 (in 25 min)             │
  │  ├─ Match Winner: 2.1 / 3.2 / 2.8       │
  │  ├─ Over 2.5: 1.8 / 2.0                 │
  │  └─ Both Score: 1.9 / 1.9               │
  │  [PLACE BET]                             │
  └──────────────────────────────────────────┘
  ```

- **Place Bet Modal**:
  - Select match
  - Choose bet type (Match Winner, Over/Under, Both Score)
  - Choose selection
  - Enter amount
  - See dynamic odds
  - Confirm bet

- **My Bets List**:
  - Active bets (unsettled)
  - Pending settlement (match finished)
  - Settled bets (won/lost)
  - Claim button for winners

- **Settle & Claim**:
  - Settle bet button (queries oracle)
  - Claim winnings button
  - Show payout calculation

**C. Tipster Tab** (Advanced):
- **Become Tipster**:
  - Register with name
  - Public profile

- **Follow Tipsters**:
  - Leaderboard (by win rate)
  - Stats: Total bets, Win rate, Profit
  - Follow button

- **Copy Bets**:
  - See tipster's recent bets
  - Copy bet with custom amount
  - Tipster earns 2% commission

**D. My Stats**:
- Total bets placed
- Win rate
- Total wagered
- Total won
- Net profit/loss
- Recent bet history

---

### Page Structure (Final)

```
Current Frontend Structure:
/                              # Homepage
/console                       # Role selection
  /game                        # Game Provider dashboard
  /market                      # Market Consumer dashboard
/marketplace                   # Game marketplace

New Game Pages:
/game
  /rps                         # ✅ RPS Game (existing)
  /vfootball                   # ❌ Virtual Football Game (NEW)

New Prediction Market Pages:
/predict
  /rps                         # ❌ RPS Betting (NEW)
  /vfootball                   # ❌ Virtual Football Betting (NEW)
```

---

## 🎨 Component Breakdown

### Shared Components

#### 1. `BettingCard.tsx`
- Reusable bet placement UI
- Props: market, betOptions, onBet
- Shows odds, pool sizes, bet input

#### 2. `MarketCard.tsx`
- Display market overview
- Countdown timer
- Pool visualization
- Status badges

#### 3. `BetHistoryTable.tsx`
- User's bet list
- Filters: Active, Settled, Won, Lost
- Claim buttons
- Pagination

#### 4. `LeagueTable.tsx` (Virtual Football)
- Sortable table
- Live updates
- Team logos/colors
- Points calculation

#### 5. `MatchCard.tsx` (Virtual Football)
- Match info display
- Countdown timer
- Bet now CTA
- Live score display

---

## 🔄 Data Flow Architecture

### Rock Paper Scissors

```
┌─────────────────────────────────────────────────────────────┐
│  GAME SIDE (/game/rps)                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │ Schedule     │ -> │ Player 1     │ -> │ Player 2     │ │
│  │ Match        │    │ Commits      │    │ Commits      │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
│                              │                              │
│                              ▼                              │
│                      ┌──────────────┐                       │
│                      │ Submit to    │                       │
│                      │ Oracle       │                       │
│                      └──────────────┘                       │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  MARKET SIDE (/predict/rps)                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │ Create       │ -> │ Users Bet on │ -> │ Resolve      │ │
│  │ Market       │    │ Outcome      │    │ via Oracle   │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
│                                                   │          │
│                                                   ▼          │
│                                          ┌──────────────┐   │
│                                          │ Winners      │   │
│                                          │ Claim        │   │
│                                          └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Virtual Football

```
┌─────────────────────────────────────────────────────────────┐
│  GAME SIDE (/game/vfootball)                                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │ Create       │ -> │ Start Season │ -> │ Simulate     │ │
│  │ Season       │    │ (20 matches) │    │ Matches      │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
│                              │                   │          │
│                              │                   ▼          │
│                              │          ┌──────────────┐   │
│                              │          │ Submit to    │   │
│                              │          │ Oracle       │   │
│                              │          └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  MARKET SIDE (/predict/vfootball)                           │
│                                                              │
│  TAB 1: VOTING (before season)                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │ Vote for     │ -> │ Season Ends  │ -> │ Claim Reward │ │
│  │ Winner (FREE)│    │ (winner set) │    │ if Correct   │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
│                                                              │
│  TAB 2: BETTING (during season)                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │ Place Bet on │ -> │ Match Plays  │ -> │ Settle Bet   │ │
│  │ Match        │    │ (game side)  │    │ via Oracle   │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
│                                                   │          │
│                                                   ▼          │
│                                          ┌──────────────┐   │
│                                          │ Claim if Won │   │
│                                          └──────────────┘   │
│                                                              │
│  TAB 3: TIPSTERS (optional)                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │ Follow       │ -> │ Copy Bets    │ -> │ Share Wins   │ │
│  │ Tipster      │    │              │    │ (2% to tip)  │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Implementation Phases

### **Phase 1: RPS Prediction Market** (Simplest)
**Estimated Time**: 2-3 hours

**Tasks**:
1. Create `/predict/rps` page
2. Build `RPSMarketCard` component
3. Implement bet placement
4. Show user bets
5. Resolve & claim flow

**Priority**: Medium (RPS game already works)

---

### **Phase 2: Virtual Football Game** (Core Feature)
**Estimated Time**: 4-5 hours

**Tasks**:
1. Create `/game/vfootball` page
2. Build `LeagueTable` component
3. Build `MatchList` component
4. Implement season management (owner)
5. Implement match simulation
6. Real-time updates

**Priority**: HIGH (This is the flagship feature)

---

### **Phase 3: Virtual Football Betting** (Complex)
**Estimated Time**: 6-8 hours

**Tasks**:
1. Create `/predict/vfootball` page
2. Implement tabbed interface
3. **Tab 1**: Season voting
   - Team selection grid
   - Vote submission
   - Reward claiming
4. **Tab 2**: Match betting
   - Match list with bet types
   - Dynamic odds display
   - Bet placement modal
   - Settlement & claiming
5. **Tab 3**: Tipster system
   - Tipster registration
   - Follow/unfollow
   - Copy bets
6. My bets dashboard

**Priority**: HIGH (Core revenue feature)

---

### **Phase 4: Virtual Football Tipsters** (Advanced)
**Estimated Time**: 3-4 hours

**Tasks**:
1. Tipster registration UI
2. Tipster leaderboard
3. Tipster profile pages
4. Copy bet flow
5. Commission tracking

**Priority**: LOW (Can be added later)

---

## 📊 Key Metrics to Display

### RPS System
- Total matches played
- Active markets
- Total betting volume
- Your win rate (as player)
- Your win rate (as bettor)

### Virtual Football System

**Game Side**:
- Current season ID
- Season status
- Matches completed / total
- League leader
- Top scorer

**Market Side**:
- Season betting volume
- Total bets placed
- Active voters
- Your total wagered
- Your win rate
- Net profit/loss

---

## 🎯 User Journeys

### Journey 1: RPS Bettor
1. Visit `/predict/rps`
2. See active markets (upcoming matches)
3. Select a market
4. Choose prediction (P1, P2, or Tie)
5. Place bet (send BNB)
6. Wait for match to complete
7. Return to market page
8. Click "Resolve Market"
9. See if bet won
10. Click "Claim Winnings"

### Journey 2: Virtual Football Voter
1. Visit `/predict/vfootball`
2. Go to "Voting" tab
3. See upcoming season
4. Click team to vote (FREE)
5. Confirm transaction
6. Wait for season to complete
7. Return to check if won
8. Claim reward (1% of betting volume)

### Journey 3: Virtual Football Bettor
1. Visit `/predict/vfootball`
2. Go to "Betting" tab
3. Browse upcoming matches
4. Select match
5. Choose bet type (Winner, O/U, BTTS)
6. Enter amount
7. See dynamic odds
8. Place bet
9. Wait for match simulation
10. Return to "My Bets"
11. Click "Settle Bet" (queries oracle)
12. If won, click "Claim"

### Journey 4: Tipster
1. Visit `/predict/vfootball`
2. Go to "Tipsters" tab
3. Click "Become Tipster"
4. Enter name
5. Place bets as tipster
6. Others follow you
7. They copy your bets
8. You earn 2% of their winnings

---

## 🔧 Technical Implementation Details

### Contract Interactions

#### RPS Prediction Market
```typescript
// Create market
const tx = await rpsMarket.createMarket(
  matchId,
  player1Address,
  player2Address,
  deadline
)

// Place bet
const betTx = await rpsMarket.placeBet(
  marketId,
  predictedWinnerAddress, // or ethers.ZeroAddress for tie
  { value: betAmount }
)

// Resolve market
const resolveTx = await rpsMarket.resolveMarket(marketId)

// Claim winnings
const claimTx = await rpsMarket.claimWinnings(marketId)
```

#### Virtual Football Market
```typescript
// Vote for season winner (FREE)
const voteTx = await vfMarket.voteForSeasonWinner(seasonId, teamId)

// Place match bet
const betTx = await vfMarket.placeBet(
  matchId,
  betType,    // 0=MATCH_WINNER, 1=OVER_UNDER, 2=BOTH_TEAMS_SCORE
  selection,  // 0,1,2 depending on bet type
  amount,
  { value: amount }
)

// Settle bet (queries oracle)
const settleTx = await vfMarket.settleBet(betId)

// Claim winnings
const claimTx = await vfMarket.claimBet(betId)

// Claim voting reward
const rewardTx = await vfMarket.claimVotingReward(seasonId)
```

---

## ✅ Success Criteria

### Phase 1 Complete When:
- [ ] Can create RPS markets
- [ ] Can place bets on RPS
- [ ] Can resolve markets via oracle
- [ ] Can claim winnings
- [ ] UI shows pool sizes and odds

### Phase 2 Complete When:
- [ ] Can view league table
- [ ] Can see upcoming matches
- [ ] Can simulate matches
- [ ] Table updates after simulation
- [ ] Season lifecycle works

### Phase 3 Complete When:
- [ ] Can vote for season winner
- [ ] Can place match bets (all 3 types)
- [ ] Can settle bets via oracle
- [ ] Can claim winnings
- [ ] Dynamic odds display correctly
- [ ] Can claim voting rewards

### Phase 4 Complete When:
- [ ] Can register as tipster
- [ ] Can follow tipsters
- [ ] Can copy tipster bets
- [ ] Tipster leaderboard works
- [ ] Commission tracking works

---

## 📝 Next Immediate Steps

1. **Decide Priority**: Which game system to implement first?
   - **Option A**: RPS Prediction Market (simpler, faster)
   - **Option B**: Virtual Football (flagship feature, more complex)

2. **Create Base Components**:
   - `BettingCard.tsx`
   - `MarketCard.tsx`
   - `BetHistoryTable.tsx`

3. **Set Up Routes**:
   - `/predict/rps`
   - `/game/vfootball`
   - `/predict/vfootball`

4. **Contract Integration**:
   - Add RPS & VF market contracts to `lib/contracts.ts`
   - Create hooks for common operations

**Recommendation**: Start with **Virtual Football** as it's the main feature and more impressive for demos.

