# Dashboard Design & Implementation Plan

## Current State Analysis

### Existing Frontend Structure
```
frontend/app/
├── page.tsx                          # Homepage (Hero, Features, Stats)
├── consumer/page.tsx                 # Consumer Dashboard (mock data)
├── dashboard/
│   ├── games/page.tsx               # Game Provider Dashboard (mock data)
│   └── protocol/page.tsx            # Protocol Overview (mock data)
├── marketplace/page.tsx              # Game marketplace
├── prediction-market/page.tsx        # Prediction market UI
└── game/rps/page.tsx                # Rock Paper Scissors demo
```

### Current Issues
1. ❌ **No unified console/role selection** - Direct navigation to dashboards
2. ❌ **All data is mocked** - Not connected to smart contracts
3. ❌ **Unclear user roles** - Consumer vs Game Provider separation not clear
4. ⚠️ **Dashboards exist but need real data** - Good UI structure, needs blockchain integration

---

## Proposed UX Flow

```
┌─────────────────────────────────────────────────────────────┐
│  HOME PAGE (/)                                              │
│  - Hero section                                             │
│  - Features overview                                        │
│  - Stats                                                    │
│  - [GO TO CONSOLE] button (prominent CTA)                  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  CONSOLE (/console)  [NEW PAGE]                            │
│                                                             │
│  ┌─────────────────────┐    ┌─────────────────────┐       │
│  │  GAME PROVIDER      │    │  MARKET CONSUMER    │       │
│  │                     │    │                     │       │
│  │  Build games and    │    │  Query results and  │       │
│  │  submit results     │    │  run prediction     │       │
│  │  to oracle          │    │  markets            │       │
│  │                     │    │                     │       │
│  │  [LAUNCH DASHBOARD] │    │  [LAUNCH DASHBOARD] │       │
│  └─────────────────────┘    └─────────────────────┘       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
       ↓                              ↓
  ┌────────────────┐          ┌────────────────┐
  │ GAME PROVIDER  │          │ MARKET CONSUMER│
  │   DASHBOARD    │          │   DASHBOARD    │
  │ (/console/game)│          │(/console/market)│
  └────────────────┘          └────────────────┘
```

---

## Data Sources from Smart Contracts

### 1. **FeeManagerV2** - Financial Metrics

#### For Game Providers (Developers):
```solidity
// Developer earnings tracking
struct DeveloperEarnings {
    uint128 totalEarned;      // Lifetime earnings
    uint128 pendingEarnings;  // Available to withdraw
    uint64 lastWithdrawTime;
    uint32 totalQueries;      // Queries served
}
mapping(bytes32 => DeveloperEarnings) public developerEarnings; // gameId => earnings

// View functions
function getDeveloperEarnings(bytes32 gameId) external view returns (DeveloperEarnings memory);
function getQueryFee(bytes32 gameId) external view returns (uint256); // Base + premium fee
function getGamePremium(bytes32 gameId) external view returns (uint8); // 0-30%
```

**Metrics to Display**:
- 💰 Total Earnings (lifetime)
- 💵 Pending Earnings (withdrawable)
- 📊 Total Queries Served
- 🎯 Query Fee (with premium %)
- 📅 Last Withdrawal Date

#### For Market Consumers:
```solidity
// Consumer balance tracking
struct ConsumerBalance {
    uint128 realBalance;      // Real BNB deposited
    uint128 bonusBalance;     // Bonus credits (virtual)
    uint64 lastResetTime;
    uint32 freeQueriesUsed;   // Free queries used today
    uint32 totalQueries;      // Lifetime queries
    uint8 bonusTier;          // Volume bonus tier (0-3)
}
mapping(address => ConsumerBalance) public consumerBalances;

// Referral tracking
struct ReferralData {
    address referrer;
    uint32 referralCount;
    uint128 earningsFromRefs;
    bool hasUsedReferral;
}
mapping(address => ReferralData) public referralData;

// Streak rewards
struct StreakData {
    uint64 lastActiveDay;
    uint16 currentStreak;
    uint16 longestStreak;
    uint128 totalRewards;
}
mapping(address => StreakData) public streakData;

// View functions
function getTotalBalance(address user) external view returns (uint256);
function getStreakInfo(address user) external view returns (...);
function getReferralInfo(address user) external view returns (...);
```

**Metrics to Display**:
- 💰 Account Balance (real + bonus)
- 🎁 Bonus Tier (volume-based)
- 🔥 Current Streak
- 📊 Total Queries Made
- 👥 Referrals Earned
- 🎟️ Free Trial Queries Left

---

### 2. **GameRegistry** - Game Management

```solidity
struct Game {
    bytes32 gameId;
    address developer;
    string name;
    string metadata;
    uint256 stake;
    uint64 registeredAt;
    bool isActive;
    GameType gameType;       // ONCHAIN / TRADITIONAL
}

struct Match {
    bytes32 matchId;
    bytes32 gameId;
    uint64 scheduledTime;
    bool resultSubmitted;
    bool isFinalized;
}

// View functions
function getGame(bytes32 gameId) external view returns (Game memory);
function getMatch(bytes32 matchId) external view returns (Match memory);
function getDeveloperGames(address developer) external view returns (bytes32[] memory);
function isGameInGoodStanding(bytes32 gameId) external view returns (bool);
```

**For Game Providers**:
- 🎮 List of my games
- 📅 Registration dates
- 💎 Stake amounts
- ✅ Game status (active/inactive)
- 🏆 Good standing status
- 📊 Total matches scheduled

**For Market Consumers**:
- 🎮 Available games to query
- 🔍 Game metadata
- ⏰ Recent matches

---

### 3. **OracleCore** - Result Management

```solidity
struct Result {
    bytes32 matchId;
    bytes32 gameId;
    address submitter;
    bytes encodedData;
    string decodeSchema;
    uint64 submittedAt;
    uint64 finalizedAt;
    bool isFinalized;
    bool isDisputed;
}

// Counters (public variables)
uint256 public totalResults;
uint256 public totalDisputed;
uint256 public totalFinalized;

// View functions
function peekResultField(bytes32 matchId, bytes32 fieldHash) external view returns (bytes32);
function getFullResult(bytes32 matchId) external view returns (...); // Charges fee
```

**For Game Providers**:
- 📊 Total results submitted
- ⏱️ Average finalization time
- ⚠️ Dispute rate (disputed/total)
- 📈 Submission trends

**For Market Consumers**:
- 🔍 Recent finalized results
- ⏰ Pending results (in dispute window)
- 💰 Query costs history

---

## Dashboard Designs

### **Game Provider Dashboard** (`/console/game`)

#### Key Metrics Cards (Top Row)
```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ MY GAMES     │ TOTAL QUERIES│ TOTAL EARNED │ PENDING      │
│    5         │    125,450   │  $9,875.50   │  $1,234.00   │
│ +2 this month│ +18% growth  │   80% share  │  Available   │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

#### My Games Table
| Game Name | Type | Stake | Queries | Revenue | Premium | Status | Actions |
|-----------|------|-------|---------|---------|---------|--------|---------|
| Virtual Football | Traditional | 0.1 BNB | 45K | $3.2K | 5% | ✅ Active | View / Withdraw |
| Chess Arena | Onchain | 0.1 BNB | 38K | $2.9K | 8% | ✅ Active | View / Withdraw |

#### Recent Match Results
| Match ID | Game | Submitted | Finalized | Status | Disputed |
|----------|------|-----------|-----------|--------|----------|
| 0x7a8b...92c3 | Virtual Football | 2 min ago | Pending | ⏳ Window | No |
| 0x4d2e...81f5 | Chess Arena | 15 min ago | ✅ Yes | ✅ Final | No |

#### Revenue Chart
- Line chart showing daily/weekly earnings
- Breakdown by game

---

### **Market Consumer Dashboard** (`/console/market`)

#### Key Metrics Cards (Top Row)
```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ BALANCE      │ BONUS TIER   │ TOTAL QUERIES│ STREAK       │
│ 12.5 BNB     │  Tier 2      │   16,500     │  🔥 7 days   │
│ +2.3 bonus   │  10% discount│ This month   │  Best: 14    │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

#### Query Subscriptions
| Game | Queries Used | Cost/Query | This Month | Actions |
|------|-------------|------------|------------|---------|
| Virtual Football | 3,450 | $1.44 | $4,968 | Query / Details |
| Chess Arena | 2,100 | $1.44 | $3,024 | Query / Details |

#### Recent Queries
| Game | Match ID | Query Type | Time | Cost | Status |
|------|----------|------------|------|------|--------|
| Virtual Football | 0x7a8b...92c3 | Match Result | 2 min | $1.44 | ✅ Success |
| Chess Arena | 0x4d2e...81f5 | Match Result | 5 min | $1.44 | ✅ Success |

#### Referral & Rewards
```
👥 Referrals: 5 users
💰 Earned: $125 in bonus credits
🎟️ Free trial: 2/5 queries used
```

---

## Implementation Steps

### Phase 1: Create Console Page ✨
**File**: `frontend/app/console/page.tsx`

```tsx
// Role selection landing page
- Two large cards: "Game Provider" and "Market Consumer"
- Brief description of each role
- CTA buttons to respective dashboards
- Wallet connection required
```

### Phase 2: Smart Contract Integration 🔗
**File**: `frontend/lib/contracts.ts`

```typescript
// Contract instances and ABIs
- FeeManagerV2 ABI + address
- GameRegistry ABI + address
- OracleCore ABI + address
- Helper functions for reading data
```

### Phase 3: Game Provider Dashboard 🎮
**File**: `frontend/app/console/game/page.tsx`

**Data fetching**:
1. Connect wallet
2. Call `GameRegistry.getDeveloperGames(address)` → get gameIds[]
3. For each gameId:
   - `GameRegistry.getGame(gameId)` → name, stake, type
   - `FeeManagerV2.getDeveloperEarnings(gameId)` → earnings, queries
   - `FeeManagerV2.getQueryFee(gameId)` → current fee
4. Calculate totals and display

### Phase 4: Market Consumer Dashboard 💹
**File**: `frontend/app/console/market/page.tsx`

**Data fetching**:
1. Connect wallet
2. `FeeManagerV2.consumerBalances(address)` → balance, tier, queries
3. `FeeManagerV2.getStreakInfo(address)` → streak data
4. `FeeManagerV2.getReferralInfo(address)` → referral earnings
5. `FeeManagerV2.lifetimeTrialQueries(address)` → free trial status
6. Display query history (could use events or subgraph)

### Phase 5: Update Homepage 🏠
**File**: `frontend/app/page.tsx`

Add prominent CTA:
```tsx
<Link href="/console">
  <Button size="lg">GO TO CONSOLE</Button>
</Link>
```

---

## Technical Requirements

### Smart Contract Functions Needed ✅
All required view functions already exist in the contracts:
- ✅ FeeManagerV2: `consumerBalances`, `developerEarnings`, `getTotalBalance`, etc.
- ✅ GameRegistry: `getGame`, `getDeveloperGames`, `getMatch`
- ✅ OracleCore: `peekResultField` (free preview), `totalResults`, `totalFinalized`

### Frontend Libraries
```json
{
  "ethers": "^6.x",           // Already installed
  "wagmi": "^2.x",            // Wallet connection
  "@rainbow-me/rainbowkit": "^2.x", // Wallet UI
  "swr": "^2.x"               // Data fetching/caching
}
```

### Environment Variables
```env
NEXT_PUBLIC_FEE_MANAGER_ADDRESS=0x...
NEXT_PUBLIC_GAME_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_ORACLE_CORE_ADDRESS=0x...
NEXT_PUBLIC_CHAIN_ID=97  # BNB Testnet
```

---

## Data Flow Diagram

```
┌──────────────┐
│   User       │
│  Connects    │
│  Wallet      │
└──────┬───────┘
       │
       ├─────────────────┐
       │                 │
┌──────▼────────┐  ┌────▼──────────┐
│ Game Provider │  │Market Consumer│
│   Dashboard   │  │   Dashboard   │
└──────┬────────┘  └────┬──────────┘
       │                │
       │  Reads from:   │  Reads from:
       │                │
       ├─► GameRegistry.getDeveloperGames()
       ├─► FeeManagerV2.developerEarnings()
       ├─► FeeManagerV2.getQueryFee()
       │                │
       │                ├─► FeeManagerV2.consumerBalances()
       │                ├─► FeeManagerV2.getStreakInfo()
       │                └─► FeeManagerV2.getReferralInfo()
       │
       └────────┬───────┘
                │
       ┌────────▼────────┐
       │  OracleCore     │
       │  .totalResults  │
       │  .totalFinalized│
       └─────────────────┘
```

---

## Next Steps

1. ✅ Create `/console` page (role selection)
2. ✅ Set up Web3 provider & wallet connection
3. ✅ Create contract helper functions
4. ✅ Implement Game Provider dashboard with real data
5. ✅ Implement Market Consumer dashboard with real data
6. ✅ Add console CTA to homepage
7. ⏳ Deploy contracts to testnet
8. ⏳ Test with real transactions
9. ⏳ Add event listening for real-time updates
10. ⏳ Polish UI/UX

---

## Mock vs Real Data Migration

| Component | Current | Target |
|-----------|---------|--------|
| Consumer balance | `useState(2456.8)` | `FeeManagerV2.consumerBalances(address).realBalance` |
| Total queries | `useState(16500)` | `FeeManagerV2.consumerBalances(address).totalQueries` |
| Game earnings | Mock array | `FeeManagerV2.developerEarnings(gameId)` |
| Active games | Mock count | `GameRegistry.getDeveloperGames(address).length` |
| Subscription data | Mock array | Contract queries + state |

