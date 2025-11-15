# PredictBNB User Flow Documentation

## Complete End-to-End Flow: Registration → Match Submission → Result Querying

This document explains the complete user journey through the PredictBNB gaming oracle system, from game registration to data consumption by prediction markets.

---

## Architecture Overview

PredictBNB consists of 5 main contracts working together:

```
┌─────────────────┐
│  GameRegistry   │ ← Registers games & schedules matches
└────────┬────────┘
         │
         │ owned by
         ▼
┌─────────────────┐     uses      ┌──────────────────┐
│  OracleCoreV2   │ ◄──────────── │ GameSchemaRegistry│
└────────┬────────┘               └──────────────────┘
         │
         │ queries
         ▼
┌─────────────────┐
│   FeeManager    │ ← Manages payments & revenue distribution
└────────┬────────┘
         │
         │ consumed by
         ▼
┌─────────────────────────┐
│ ExamplePredictionMarket │ (Consumer contracts)
└─────────────────────────┘
```

---

## User Roles

### 1. **Game Developer**
- Registers games (pays 0.1 BNB stake)
- Schedules matches
- Submits match results
- Earns 80% of query fees

### 2. **Consumer (Prediction Market)**
- Registers with FeeManager (pays min 0.01 BNB)
- Queries match results
- Pays per query (or uses free tier)

### 3. **Disputer (Anyone)**
- Can dispute incorrect results
- Stakes 0.2 BNB to dispute
- Earns reward if dispute is valid

### 4. **Protocol Owner**
- Manages emergency pause
- Resolves disputes
- Updates match statuses

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PHASE 1: GAME REGISTRATION                      │
└─────────────────────────────────────────────────────────────────────────┘

Game Developer
      │
      │ 1. registerGame(gameId, name, gameType)
      │    with 0.1 BNB stake
      ▼
┌─────────────────┐
│  GameRegistry   │
└─────────────────┘
      │
      │ Creates:
      │ - Game struct (developer, stake, reputation=500)
      │ - Maps developer → gameId
      ▼
Game is ACTIVE ✅


┌─────────────────────────────────────────────────────────────────────────┐
│                        PHASE 2: MATCH SCHEDULING                        │
└─────────────────────────────────────────────────────────────────────────┘

Game Developer (same address that registered game)
      │
      │ 2. scheduleMatch(gameId, matchId, scheduledTime, metadata)
      │
      ▼
┌─────────────────┐
│  GameRegistry   │  Validates:
└─────────────────┘  - Game is active
      │              - Caller is game developer
      │              - scheduledTime is in future
      │
      │ Creates unique matchId = keccak256(gameId, matchId, time, timestamp)
      │
      │ Creates Match struct:
      │ - matchId, gameId, scheduledTime
      │ - status = Scheduled
      │ - metadata (JSON with teams, players, etc.)
      ▼
Match is SCHEDULED ✅
      │
      │ Stores:
      │ - matches[matchId] = Match
      │ - gameMatches[gameId].push(matchId)
      │ - allMatchIds.push(matchId)
      ▼
Match awaits game completion...


┌─────────────────────────────────────────────────────────────────────────┐
│                      PHASE 3: RESULT SUBMISSION                         │
└─────────────────────────────────────────────────────────────────────────┘

Game Developer (after match completes in real world)
      │
      │ 3a. Option 1: Legacy submission
      │     submitResult(matchId, resultData)
      │
      │ 3b. Option 2: Schema-based submission (NEW!)
      │     submitResultV2(matchId, gameContract, participants,
      │                      scores, winnerIndex, duration,
      │                      schemaId, customData)
      ▼
┌─────────────────┐
│  OracleCoreV2   │  Validates:
└─────────────────┘  - Match exists in GameRegistry
      │              - Match status = Scheduled or InProgress
      │              - Caller = game developer (from GameRegistry)
      │              - Game is active
      │              - Result not already submitted
      │              - Participants/scores arrays match
      │              - Schema is valid (if using V2)
      │
      │ Computes resultHash = keccak256(all data + timestamp)
      │
      │ Creates GameResult struct:
      │ - matchId, gameContract, timestamp, duration
      │ - participants[], scores[], winnerIndex
      │ - schemaId, customData (optional)
      │ - resultHash, submitter, submittedAt
      │ - disputeDeadline = now + 15 minutes ⏰
      │ - isFinalized = false
      │ - isDisputed = false
      ▼
Result is SUBMITTED ✅ (but not finalized yet!)
      │
      │ Updates GameRegistry:
      │ - match.status = Completed
      │
      │ Emits ResultSubmittedV2 event
      │ Emits SchemaDataValidated event (if using schema)
      ▼
Enters 15-minute dispute window ⏰


┌─────────────────────────────────────────────────────────────────────────┐
│                    PHASE 4: DISPUTE WINDOW (Optional)                   │
└─────────────────────────────────────────────────────────────────────────┘

During 15-minute window, two paths:

PATH A: NO DISPUTE
      │
      │ Wait 15 minutes...
      │
      │ 4a. Anyone calls finalizeResult(matchId)
      ▼
┌─────────────────┐
│  OracleCoreV2   │  Validates:
└─────────────────┘  - Result exists
      │              - Not already finalized
      │              - Not disputed
      │              - block.timestamp >= disputeDeadline
      │
      │ Sets:
      │ - result.isFinalized = true
      │ - result.status = COMPLETED
      │
      │ Updates GameRegistry:
      │ - match.status = Finalized
      ▼
Result is FINALIZED ✅
Prediction markets can now query safely!


PATH B: DISPUTE RAISED
      │
      │ 4b. Disputer calls disputeResult(matchId, reason)
      │     with 0.2 BNB stake
      ▼
┌─────────────────┐
│  OracleCoreV2   │  Validates:
└─────────────────┘  - Result exists
      │              - Not already finalized
      │              - Not already disputed
      │              - Within dispute window
      │              - msg.value == 0.2 BNB
      │
      │ Sets:
      │ - result.isDisputed = true
      │ - result.disputer = msg.sender
      │ - result.disputeStake = 0.2 BNB
      │ - result.status = DISPUTED
      │
      │ Updates GameRegistry:
      │ - match.status = Disputed
      ▼
Result is DISPUTED ⚠️
      │
      │ 4c. Owner/Governance calls resolveDispute(matchId, disputeValid)
      ▼
┌─────────────────┐
│  OracleCoreV2   │  If dispute is VALID:
└─────────────────┘  - Disputer gets 0.2 BNB + 0.05 BNB (slashed from game dev)
      │              - Game dev loses 0.05 BNB stake
      │              - Game reputation decreases by 50 points
      │              - Result remains unfinalizable
      │
      │              If dispute is INVALID:
      │              - Game dev gets 0.2 BNB (disputer's stake)
      │              - Game reputation increases by 10 points
      │              - Result is finalized
      │              - match.status = Finalized
      ▼
Dispute RESOLVED ✅


┌─────────────────────────────────────────────────────────────────────────┐
│                  PHASE 5: CONSUMER REGISTRATION                         │
└─────────────────────────────────────────────────────────────────────────┘

Prediction Market Contract (wants to query results)
      │
      │ 5. registerConsumer()
      │    with minimum 0.01 BNB deposit
      ▼
┌─────────────────┐
│   FeeManager    │  Validates:
└─────────────────┘  - Not already registered
      │              - msg.value >= 0.01 BNB (anti-Sybil)
      │
      │ Calculates volume bonus:
      │ - 10+ BNB → 5% bonus
      │ - 50+ BNB → 10% bonus
      │ - 100+ BNB → 15% bonus
      │
      │ Creates Consumer struct:
      │ - consumerAddress = msg.sender
      │ - balance = deposit + bonus
      │ - totalDeposited = deposit
      │ - totalQueriesMade = 0
      │ - lastQueryReset = now
      │ - dailyQueriesUsed = 0
      │ - isActive = true
      ▼
Consumer is REGISTERED ✅
Now has prepaid balance for queries!


┌─────────────────────────────────────────────────────────────────────────┐
│                      PHASE 6: QUERYING RESULTS                          │
└─────────────────────────────────────────────────────────────────────────┘

Prediction Market Contract
      │
      │ 6. queryResult(matchId)
      ▼
┌─────────────────┐
│   FeeManager    │  Step 1: Validate consumer
└─────────────────┘  - Consumer is registered and active
      │
      │ Step 2: Get match/game info from GameRegistry
      │ - matchData = gameRegistry.getMatch(matchId)
      │ - game = gameRegistry.getGame(matchData.gameId)
      │
      │ Step 3: Update daily free tier counter
      │ - If 24+ hours passed, reset dailyQueriesUsed to 0
      │
      │ Step 4: ⚠️ CRITICAL - CHECK PAYMENT BEFORE DATA ⚠️
      │
      │ If dailyQueriesUsed < 50:
      │   → FREE query
      │   → Increment dailyQueriesUsed
      │   → No balance deduction
      │
      │ Else:
      │   → PAID query (0.003 BNB = ~$1.80)
      │   → Check: balance >= 0.003 BNB
      │   → DEDUCT BALANCE FIRST: balance -= 0.003 BNB
      │   → Distribute revenue:
      │      • Game developer: 80% (0.0024 BNB)
      │      • Protocol treasury: 15% (0.00045 BNB)
      │      • Disputer pool: 5% (0.00015 BNB)
      │
      │ Step 5: Update tracking counters
      │ - consumer.totalQueriesMade++
      │ - matchQueryCounts[matchId]++
      │ - gameQueryCounts[gameId]++
      │
      │ Step 6: 📊 ONLY AFTER PAYMENT, get result from OracleCore
      ▼
┌─────────────────┐
│  OracleCoreV2   │  getResult(matchId) returns:
└─────────────────┘  - resultData (string or custom data)
      │              - resultHash (for verification)
      │              - isFinalized (must be true!)
      │
      │ Returns data to FeeManager
      ▼
┌─────────────────┐
│   FeeManager    │  Validates:
└─────────────────┘  - isFinalized == true (revert if not finalized)
      │
      │ Emits QueryFeePaid event
      │
      │ Returns (resultData, resultHash, isFinalized)
      ▼
Prediction Market Contract receives data ✅
Can now resolve bets!


┌─────────────────────────────────────────────────────────────────────────┐
│                    PHASE 7: REVENUE WITHDRAWAL                          │
└─────────────────────────────────────────────────────────────────────────┘

Game Developer (earned revenue from queries)
      │
      │ 7. withdrawRevenue()
      ▼
┌─────────────────┐
│   FeeManager    │  Validates:
└─────────────────┘  - revenue.pendingWithdrawal > 0
      │
      │ Transfers BNB to developer
      │
      │ Updates:
      │ - revenue.pendingWithdrawal = 0
      │ - revenue.totalWithdrawn += amount
      ▼
Developer receives BNB ✅

```

---

## Key Security Features in the Flow

### 1. **Payment-Before-Data (CRITICAL)**
Located in: `FeeManager.sol:208-260`

```solidity
// ❌ VULNERABLE (Old pattern):
// data = oracle.getResult()  ← GET DATA FIRST
// balance -= fee             ← THEN CHARGE
// return data                ← Attacker can revert here!

// ✅ SECURE (New pattern):
balance -= fee              // CHARGE FIRST
data = oracle.getResult()   // THEN GET DATA
return data                 // Safe to return
```

**Attack prevented**: Malicious contract cannot receive data then revert to avoid payment.

### 2. **Minimum Deposit (Anti-Sybil)**
Located in: `FeeManager.sol:116-152`

```solidity
require(msg.value >= 0.01 ether, "Minimum 0.01 BNB deposit required");
```

**Attack prevented**: Cannot deploy 1000 contracts to get 50,000 free queries/day. Would cost 10 BNB minimum.

### 3. **Emergency Pause**
Located in: `OracleCoreV2.sol:755-771`

All critical functions have `whenNotPaused` modifier:
- `submitResult()`
- `submitResultV2()`
- `batchSubmitResultsV2()`
- `disputeResult()`
- `finalizeResult()`

**Protection**: If critical bug discovered, owner can halt all operations immediately.

### 4. **15-Minute Dispute Window**
Located in: `OracleCoreV2.sol:21`

```solidity
uint256 public constant DISPUTE_WINDOW = 15 minutes;
```

**Balance**: Fast enough for prediction markets, slow enough to catch errors.

### 5. **Developer Stake Slashing**
Located in: `GameRegistry.sol:222-242`

If developer submits fraudulent results:
- Loses 0.05 BNB from stake
- Reputation decreases by 50 points
- If stake < 0.1 BNB, game deactivated

**Incentive alignment**: Developers lose money for bad data.

---

## Data Flow Examples

### Example 1: First-Time Consumer (Using Free Tier)

```
Prediction Market deposits 1.0 BNB
→ Registers as consumer
→ Gets 1.0 BNB balance (no bonus, below 10 BNB tier)

Query #1: FREE (dailyQueriesUsed: 0 → 1)
Query #2: FREE (dailyQueriesUsed: 1 → 2)
...
Query #50: FREE (dailyQueriesUsed: 49 → 50)

Query #51: PAID 0.003 BNB (balance: 1.0 → 0.997 BNB)
  → Game dev earns: 0.0024 BNB
  → Protocol earns: 0.00045 BNB
  → Disputer pool: 0.00015 BNB

After 24 hours:
→ dailyQueriesUsed resets to 0
→ Next 50 queries are FREE again!
```

### Example 2: High-Volume Consumer (Using Volume Bonus)

```
Prediction Market deposits 100 BNB
→ Tier 3 bonus: 15% = 15 BNB bonus
→ Total balance: 115 BNB

Can make: 115 / 0.003 = 38,333 paid queries
Plus: 50 free queries/day

If queries 100/day for a month:
→ Free: 50 × 30 = 1,500 free queries
→ Paid: 50 × 30 = 1,500 paid queries
→ Cost: 1,500 × 0.003 = 4.5 BNB
→ Remaining balance: 115 - 4.5 = 110.5 BNB

Game developers earn: 4.5 × 80% = 3.6 BNB from this consumer!
```

### Example 3: Game Developer Revenue

```
Developer registers "fps-game-001"
→ Stakes 0.1 BNB

Schedules 100 matches over 1 month

Each match averages 50 queries from prediction markets:
→ Total queries: 100 × 50 = 5,000 queries

Assuming 10% are free tier (500 free, 4,500 paid):
→ Paid queries: 4,500
→ Revenue: 4,500 × 0.003 BNB = 13.5 BNB total
→ Developer share: 13.5 × 80% = 10.8 BNB

Developer calls withdrawRevenue()
→ Receives 10.8 BNB
→ Profit: 10.8 - 0.1 (stake) = 10.7 BNB ✅

ROI: 10,700% on 0.1 BNB stake!
```

---

## State Transitions

### Match Status Flow
```
Scheduled → InProgress → Completed → Finalized
                ↓
            Cancelled

            OR

Scheduled → InProgress → Completed → Disputed → Finalized (if dispute invalid)
```

### Result Status Flow
```
(No result) → Submitted (15 min window) → Finalized
                        ↓
                    Disputed → Resolved
```

---

## Smart Contract Interactions

### Contract Ownership & Access Control

```
GameRegistry
    │
    └─── owned by ──→ OracleCoreV2
                           │
                           └─── owned by ──→ Protocol Owner (EOA/Multisig)

FeeManager
    │
    └─── owned by ──→ Protocol Owner (references OracleCoreV2)

GameSchemaRegistry
    │
    └─── owned by ──→ Protocol Owner
```

**Key Point**: `GameRegistry` is owned by `OracleCoreV2` so that oracle can update match statuses.

---

## Gas Costs (Estimated)

| Operation | Gas Cost | BNB Cost (@5 Gwei) | USD Cost (@$600) |
|-----------|----------|---------------------|------------------|
| registerGame | ~100k | 0.0005 BNB | $0.30 |
| scheduleMatch | ~150k | 0.00075 BNB | $0.45 |
| submitResult | ~200k | 0.001 BNB | $0.60 |
| submitResultV2 (with schema) | ~250k | 0.00125 BNB | $0.75 |
| registerConsumer | ~80k | 0.0004 BNB | $0.24 |
| queryResult | ~120k | 0.0006 BNB | $0.36 |
| batchQueryResults (10 items) | ~400k | 0.002 BNB | $1.20 |
| finalizeResult | ~80k | 0.0004 BNB | $0.24 |
| disputeResult | ~120k | 0.0006 BNB | $0.36 |

**Note**: Actual costs depend on BSC gas prices (typically 3-10 Gwei).

---

## Error Handling & Validation

### Common Revert Reasons

**GameRegistry:**
- `"GameRegistry: Empty game ID"` - gameId is empty string
- `"GameRegistry: Game already registered"` - gameId already exists
- `"GameRegistry: Incorrect stake amount"` - msg.value != 0.1 BNB
- `"GameRegistry: Game not active"` - trying to schedule match for inactive game
- `"GameRegistry: Only game developer can schedule"` - msg.sender != game.developer
- `"GameRegistry: Must schedule in future"` - scheduledTime <= block.timestamp

**OracleCoreV2:**
- `"OracleCoreV2: Match does not exist"` - matchId not found in GameRegistry
- `"OracleCoreV2: Only game developer can submit"` - msg.sender != game.developer
- `"OracleCoreV2: Result already submitted"` - trying to submit twice
- `"OracleCoreV2: Validation failed"` - schema invalid or unauthorized
- `"OracleCoreV2: Dispute window closed"` - trying to dispute after 15 minutes
- `"EnforcedPause"` - contract is paused

**FeeManager:**
- `"FeeManager: Minimum 0.01 BNB deposit required"` - deposit < 0.01 BNB
- `"FeeManager: Already registered"` - consumer already exists
- `"FeeManager: Consumer not registered or inactive"` - trying to query without registration
- `"FeeManager: Insufficient balance"` - balance < query fee
- `"FeeManager: Result not finalized yet"` - trying to query unfinalized result

---

## Timing Constraints

| Event | Timing |
|-------|--------|
| Schedule match | Must be in future (scheduledTime > block.timestamp) |
| Submit result | After match time (can submit immediately after) |
| Dispute window | 15 minutes from submission |
| Finalize result | After 15 minutes (if not disputed) |
| Daily free tier reset | 24 hours from last reset |
| Stake withdrawal cooldown | 7 days after deactivating game |

---

## Best Practices for Each Role

### Game Developers
1. ✅ Register game with descriptive name and correct type
2. ✅ Schedule matches at least 1 hour before actual start time
3. ✅ Submit results within 1 hour of match completion
4. ✅ Use schema-based submission (V2) for rich data
5. ✅ Monitor reputation score (keep above 700)
6. ✅ Withdraw revenue regularly
7. ❌ Don't submit fraudulent results (risk stake slashing)

### Consumers (Prediction Markets)
1. ✅ Register with sufficient balance (100+ BNB for high volume)
2. ✅ Monitor balance and top up before running out
3. ✅ Use batch queries for multiple results (saves gas)
4. ✅ Handle "result not finalized" errors gracefully
5. ✅ Wait 16+ minutes after result submission before querying
6. ❌ Don't create multiple contracts to abuse free tier (anti-Sybil)

### Disputers
1. ✅ Only dispute if you have evidence of fraud
2. ✅ Provide detailed reason in dispute
3. ✅ Stake 0.2 BNB (returned if dispute valid)
4. ❌ Don't spam disputes (lose stake if invalid)

### Protocol Owner
1. ✅ Monitor for suspicious activity
2. ✅ Resolve disputes within 24-48 hours
3. ✅ Use emergency pause only for critical bugs
4. ✅ Unpause ASAP after fixing issues
5. ✅ Withdraw protocol treasury regularly

---

## Summary: Complete Happy Path

```
1. Game Developer registers "my-game" with 0.1 BNB stake
2. Developer schedules match "match-001" for tomorrow at 3pm
3. Match happens in real world (not on-chain)
4. Developer submits result with participants, scores, winner
5. 15-minute dispute window starts
6. No disputes raised
7. After 15 minutes, anyone finalizes the result
8. Prediction Market queries result via FeeManager
9. FeeManager deducts 0.003 BNB from prepaid balance
10. FeeManager distributes revenue: 80% to dev, 15% to protocol, 5% to disputer pool
11. FeeManager returns result data to prediction market
12. Prediction market resolves bets
13. Developer withdraws earned revenue
14. Everyone profits! 🎉
```

---

## Architecture Highlights

### Why This Design?

1. **Separation of Concerns**
   - GameRegistry: State management
   - OracleCoreV2: Result verification & disputes
   - FeeManager: Economics & payments
   - Consumers: Application logic

2. **Security-First**
   - Payment before data (prevents exploit)
   - Minimum deposit (anti-Sybil)
   - Emergency pause (circuit breaker)
   - Dispute mechanism (fraud prevention)

3. **Developer-Aligned Economics**
   - 80% revenue share (incentivizes data providers)
   - Volume bonuses (rewards large consumers)
   - Reputation system (builds trust)
   - Stake slashing (punishes fraud)

4. **Fast & Efficient**
   - 15-minute dispute window (vs UMA's 48 hours)
   - Batch operations (gas savings)
   - Free tier (onboarding)
   - Prepaid model (predictable costs)

---

## Next Steps for Integration

### For Game Developers:
1. Deploy game server
2. Register game on-chain
3. Integrate match scheduling API
4. Submit results after matches complete
5. Monitor revenue dashboard

### For Prediction Markets:
1. Register as consumer
2. Deposit prepaid balance
3. Integrate FeeManager.queryResult()
4. Handle result data in betting logic
5. Monitor balance and top up

### For Disputers:
1. Monitor ResultSubmittedV2 events
2. Verify results offchain
3. Call disputeResult() if fraud detected
4. Wait for owner to resolve dispute
5. Claim rewards if dispute valid

---

**This flow ensures data integrity, fair economics, and security for all participants in the PredictBNB ecosystem!** ✅
