# PredictBNB Subgraph Implementation Guide

## Current Status

✅ **What's Working:**
- Schema is comprehensive and well-structured
- Game registration tracking
- Match scheduling tracking
- Consumer balance tracking
- Earnings tracking
- Daily stats framework

❌ **What's Missing:**
1. Query entity tracking (for RECENT_QUERIES_QUERY)
2. gameContract field in events
3. Result entity integration with OracleCore
4. Dispute tracking integration
5. totalQueries in ProtocolStats
6. Missing helper functions

---

## Required Fixes

### 1. Add Query Entity Tracking

**Problem:** The `Query` entity is defined in schema but never created in mappings.

**Location:** `subgraph/src/oracle-core.ts` or `subgraph/src/fee-manager.ts`

**Fix:**

```typescript
// In fee-manager.ts or oracle-core.ts
import { Query, Result, Game } from "../generated/schema";

export function handleQueryFeeCharged(event: QueryFeeCharged): void {
  // Create Query entity
  let queryId = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  let query = new Query(queryId);

  query.consumer = event.params.consumer;
  query.result = event.params.matchId.toHex(); // Assuming matchId is in event
  query.isQuickField = event.params.isQuickField; // Add to event if missing
  query.fee = event.params.fee;
  query.timestamp = event.block.timestamp;

  // Load result to get game reference
  let result = Result.load(event.params.matchId.toHex());
  if (result != null) {
    query.game = result.game;
  }

  query.save();

  // ... existing balance update code ...

  // Update protocol stats queries count
  let stats = ProtocolStats.load("protocol");
  if (stats != null) {
    stats.totalQueries = stats.totalQueries.plus(BigInt.fromI32(1));
    stats.totalRevenue = stats.totalRevenue.plus(event.params.fee);
    stats.updatedAt = event.block.timestamp;
    stats.save();
  }

  // Update daily stats
  let dailyStats = getOrCreateDailyStats(event.block.timestamp);
  dailyStats.queriesMade = dailyStats.queriesMade + 1;
  dailyStats.revenue = dailyStats.revenue.plus(event.params.fee);
  dailyStats.save();
}
```

**Event Changes Needed in FeeManagerV2.sol:**

```solidity
event QueryFeeCharged(
    address indexed consumer,
    bytes32 indexed matchId,  // ADD THIS
    uint256 fee,
    bool usedFreeTier,
    bool isQuickField  // ADD THIS
);
```

---

### 2. Fix GameRegistry Event to Include gameContract

**Problem:** Schema has `gameContract` field but event doesn't emit it.

**Current Event:**
```solidity
event GameRegistered(
    bytes32 indexed gameId,
    address indexed developer,
    string name,
    uint256 stakedAmount,
    uint64 timestamp
);
```

**Fixed Event:**
```solidity
event GameRegistered(
    bytes32 indexed gameId,
    address indexed developer,
    address indexed gameContract,  // ADD THIS
    string name,
    uint256 stakedAmount,
    uint64 timestamp
);
```

**Update Mapping:**
```typescript
export function handleGameRegistered(event: GameRegistered): void {
  let game = new Game(event.params.gameId.toHex());

  game.developer = event.params.developer;
  game.gameContract = event.params.gameContract; // ADD THIS
  game.name = event.params.name;
  // ... rest of code
}
```

---

### 3. Complete OracleCore Mapping

**Problem:** Result submission and finalization not fully implemented.

**File:** `subgraph/src/oracle-core.ts`

**Add Missing Handlers:**

```typescript
import { BigInt } from "@graphprotocol/graph-ts";
import {
  ResultSubmitted,
  ResultFinalized,
  ResultQueried,
} from "../generated/OracleCore/OracleCore";
import { Result, Match, Game, QuickField, ProtocolStats, DailyStats } from "../generated/schema";

export function handleResultSubmitted(event: ResultSubmitted): void {
  let result = new Result(event.params.matchId.toHex());

  result.match = event.params.matchId.toHex();
  result.game = event.params.gameId.toHex();
  result.submitter = event.params.submitter;
  result.encodedData = event.params.encodedData; // If available in event
  result.decodeSchema = ""; // Add to event if needed
  result.submittedAt = event.params.submittedAt;
  result.finalizedAt = null;
  result.isFinalized = false;
  result.isDisputed = false;
  result.createdAt = event.block.timestamp;

  result.save();

  // Update match
  let match = Match.load(event.params.matchId.toHex());
  if (match != null) {
    match.hasResult = true;
    match.save();
  }

  // Update protocol stats
  let stats = getOrCreateProtocolStats();
  stats.totalResults = stats.totalResults + 1;
  stats.updatedAt = event.block.timestamp;
  stats.save();

  // Update daily stats
  let dailyStats = getOrCreateDailyStats(event.block.timestamp);
  dailyStats.resultsSubmitted = dailyStats.resultsSubmitted + 1;
  dailyStats.save();
}

export function handleResultFinalized(event: ResultFinalized): void {
  let result = Result.load(event.params.matchId.toHex());

  if (result != null) {
    result.isFinalized = true;
    result.finalizedAt = event.params.finalizedAt;
    result.save();
  }
}

export function handleQuickFieldSet(
  matchId: string,
  fieldHash: string,
  fieldValue: string,
  timestamp: BigInt
): void {
  let id = matchId + "-" + fieldHash;
  let quickField = new QuickField(id);

  quickField.result = matchId;
  quickField.fieldHash = Bytes.fromHexString(fieldHash);
  quickField.fieldValue = Bytes.fromHexString(fieldValue);
  quickField.createdAt = timestamp;

  quickField.save();
}

// Helper functions
function getOrCreateProtocolStats(): ProtocolStats {
  let stats = ProtocolStats.load("protocol");

  if (stats == null) {
    stats = new ProtocolStats("protocol");
    stats.totalGames = 0;
    stats.totalMatches = 0;
    stats.totalResults = 0;
    stats.totalQueries = BigInt.fromI32(0);
    stats.totalRevenue = BigInt.fromI32(0);
    stats.protocolBalance = BigInt.fromI32(0);
    stats.disputerPoolBalance = BigInt.fromI32(0);
    stats.updatedAt = BigInt.fromI32(0);
  }

  return stats as ProtocolStats;
}

function getOrCreateDailyStats(timestamp: BigInt): DailyStats {
  // Get day start timestamp (midnight UTC)
  let dayTimestamp = timestamp.toI32() / 86400 * 86400;
  let id = dayTimestamp.toString();

  let stats = DailyStats.load(id);

  if (stats == null) {
    stats = new DailyStats(id);
    stats.date = BigInt.fromI32(dayTimestamp);
    stats.gamesRegistered = 0;
    stats.matchesScheduled = 0;
    stats.resultsSubmitted = 0;
    stats.queriesMade = 0;
    stats.revenue = BigInt.fromI32(0);
    stats.timestamp = timestamp;
  }

  return stats as DailyStats;
}
```

---

### 4. Add Dispute Tracking

**File:** `subgraph/src/dispute-resolver.ts`

**Complete Implementation:**

```typescript
import { BigInt } from "@graphprotocol/graph-ts";
import {
  DisputeCreated,
  DisputeResolved,
} from "../generated/DisputeResolver/DisputeResolver";
import { Dispute, Result, Match, Game } from "../generated/schema";

export function handleDisputeCreated(event: DisputeCreated): void {
  let dispute = new Dispute(event.params.disputeId.toHex());

  let matchId = event.params.matchId.toHex();

  dispute.match = matchId;
  dispute.result = matchId;
  dispute.challenger = event.params.challenger;
  dispute.stakeAmount = event.params.stakeAmount;
  dispute.status = "Pending";
  dispute.reason = event.params.reason;
  dispute.evidenceHash = event.params.evidenceHash;
  dispute.resolver = null;
  dispute.createdAt = event.block.timestamp;
  dispute.resolvedAt = null;

  // Get game from match
  let match = Match.load(matchId);
  if (match != null) {
    dispute.game = match.game;

    // Update game dispute count
    let game = Game.load(match.game);
    if (game != null) {
      game.totalDisputes = game.totalDisputes + 1;
      game.updatedAt = event.block.timestamp;
      game.save();
    }
  }

  // Update result
  let result = Result.load(matchId);
  if (result != null) {
    result.isDisputed = true;
    result.save();
  }

  dispute.save();
}

export function handleDisputeResolved(event: DisputeResolved): void {
  let dispute = Dispute.load(event.params.disputeId.toHex());

  if (dispute != null) {
    dispute.status = event.params.accepted ? "Accepted" : "Rejected";
    dispute.resolver = event.params.resolver;
    dispute.resolvedAt = event.block.timestamp;
    dispute.save();
  }
}
```

---

### 5. Update subgraph.yaml

Make sure all event handlers are registered:

```yaml
specVersion: 0.0.5
schema:
  file: ./schema.graphql
dataSources:
  - kind: ethereum
    name: GameRegistry
    network: mantle-sepolia
    source:
      address: "0x7Cf8b09c4949aD928C938f4d147368825dF32106"
      abi: GameRegistry
      startBlock: 1000000
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.7
      language: wasm/assemblyscript
      entities:
        - Game
        - Match
        - ProtocolStats
        - DailyStats
      abis:
        - name: GameRegistry
          file: ./abis/GameRegistry.json
      eventHandlers:
        - event: GameRegistered(indexed bytes32,indexed address,indexed address,string,uint256,uint64)
          handler: handleGameRegistered
        - event: MatchScheduled(indexed bytes32,indexed bytes32,uint64,string,address)
          handler: handleMatchScheduled
        - event: StakeIncreased(indexed bytes32,uint256)
          handler: handleStakeIncreased
        - event: StakeSlashed(indexed bytes32,uint256,uint256)
          handler: handleStakeSlashed
        - event: ReputationUpdated(indexed bytes32,uint16)
          handler: handleReputationUpdated
        - event: GameDeactivated(indexed bytes32)
          handler: handleGameDeactivated
        - event: GameBanned(indexed bytes32)
          handler: handleGameBanned
      file: ./src/game-registry.ts

  - kind: ethereum
    name: OracleCore
    network: mantle-sepolia
    source:
      address: "0x8AcefAE169a8507D6Ed9A8004812929B4D3eABa9"
      abi: OracleCore
      startBlock: 1000000
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.7
      language: wasm/assemblyscript
      entities:
        - Result
        - Match
        - QuickField
        - ProtocolStats
        - DailyStats
      abis:
        - name: OracleCore
          file: ./abis/OracleCore.json
      eventHandlers:
        - event: ResultSubmitted(indexed bytes32,indexed bytes32,indexed address,uint64,uint64)
          handler: handleResultSubmitted
        - event: ResultFinalized(indexed bytes32,indexed bytes32,uint64)
          handler: handleResultFinalized
      file: ./src/oracle-core.ts

  - kind: ethereum
    name: FeeManager
    network: mantle-sepolia
    source:
      address: "0x8E7c0E4f8439988F10e0016deA08e21FEa4204d2"
      abi: FeeManager
      startBlock: 1000000
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.7
      language: wasm/assemblyscript
      entities:
        - ConsumerBalance
        - GameEarnings
        - Query
        - ProtocolStats
        - DailyStats
      abis:
        - name: FeeManager
          file: ./abis/FeeManagerV2.json
      eventHandlers:
        - event: BalanceDeposited(indexed address,uint256,uint256,uint8)
          handler: handleBalanceDeposited
        - event: QueryFeeCharged(indexed address,indexed bytes32,uint256,bool,bool)
          handler: handleQueryFeeCharged
        - event: RevenueDistributed(indexed bytes32,uint256,uint256,uint256)
          handler: handleRevenueDistributed
        - event: EarningsWithdrawn(indexed bytes32,address,uint256)
          handler: handleEarningsWithdrawn
        - event: FreeTierReset(indexed address,uint64)
          handler: handleFreeTierReset
      file: ./src/fee-manager.ts

  - kind: ethereum
    name: DisputeResolver
    network: mantle-sepolia
    source:
      address: "0x42c9D8A4BE1Ca4381772DcDCC4e895FafE01aC1F"
      abi: DisputeResolver
      startBlock: 1000000
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.7
      language: wasm/assemblyscript
      entities:
        - Dispute
        - Result
        - Game
      abis:
        - name: DisputeResolver
          file: ./abis/DisputeResolver.json
      eventHandlers:
        - event: DisputeCreated(indexed bytes32,indexed bytes32,address,uint256,string,bytes32)
          handler: handleDisputeCreated
        - event: DisputeResolved(indexed bytes32,bool,address)
          handler: handleDisputeResolved
      file: ./src/dispute-resolver.ts
```

---

## Query Validation

### ✅ Queries That Will Work:

1. **PROTOCOL_STATS_QUERY** - ✅ Works (assuming ProtocolStats initialized)
2. **ALL_GAMES_QUERY** - ✅ Works
3. **DEVELOPER_GAMES_QUERY** - ✅ Works
4. **GAME_DETAILS_QUERY** - ✅ Works (after adding gameContract field)
5. **CONSUMER_BALANCE_QUERY** - ✅ Works
6. **DISPUTES_QUERY** - ✅ Works (after adding dispute handlers)
7. **DAILY_STATS_QUERY** - ✅ Works
8. **LEADERBOARD_GAMES_QUERY** - ✅ Works

### ⚠️ Queries That Need Fixes:

1. **RECENT_RESULTS_QUERY** - Needs Result entity creation in OracleCore
2. **RECENT_QUERIES_QUERY** - Needs Query entity creation in FeeManager

---

## Implementation Checklist

### Contract Updates Needed:

- [ ] Update `GameRegistered` event to include `gameContract` parameter
- [ ] Update `QueryFeeCharged` event to include `matchId` and `isQuickField`
- [ ] Ensure `ResultSubmitted` event includes all necessary data
- [ ] Ensure `ResultFinalized` event is emitted

### Subgraph Updates Needed:

- [ ] Add `Query` entity creation in `handleQueryFeeCharged`
- [ ] Add `Result` entity creation in `handleResultSubmitted`
- [ ] Add `Result` finalization in `handleResultFinalized`
- [ ] Complete dispute handlers
- [ ] Add helper functions (`getOrCreateProtocolStats`, `getOrCreateDailyStats`)
- [ ] Update event signatures in `subgraph.yaml`
- [ ] Generate types: `graph codegen`
- [ ] Build subgraph: `graph build`

### Testing:

- [ ] Deploy subgraph to local Graph Node
- [ ] Test all queries with sample data
- [ ] Verify relationships (Game -> Matches -> Results)
- [ ] Check daily stats aggregation
- [ ] Verify earnings tracking

---

## Deployment Commands

```bash
# 1. Install dependencies
cd subgraph
npm install

# 2. Generate types from schema
graph codegen

# 3. Build subgraph
graph build

# 4. Create subgraph (first time only)
graph create --node http://localhost:8020/ predictbnb/oracle

# 5. Deploy to local node
graph deploy --node http://localhost:8020/ --ipfs http://localhost:5001 predictbnb/oracle

# 6. Deploy to hosted service (production)
graph auth --product hosted-service <ACCESS_TOKEN>
graph deploy --product hosted-service <GITHUB_USER>/predictbnb-oracle
```

---

## Testing Queries

Once deployed, test queries at: `http://localhost:8000/subgraphs/name/predictbnb/oracle/graphql`

Example test:

```graphql
{
  protocolStats(id: "protocol") {
    totalGames
    totalMatches
    totalResults
  }

  games(first: 5, orderBy: totalMatches, orderDirection: desc) {
    id
    name
    developer
    totalMatches
    earnings {
      totalEarned
      totalQueries
    }
  }
}
```

---

## Summary

**Current Completion: ~70%**

**To reach 100%:**
1. Fix 2 contract events (10 minutes)
2. Complete 3 mapping handlers (30 minutes)
3. Add helper functions (10 minutes)
4. Update subgraph.yaml (5 minutes)
5. Test and deploy (20 minutes)

**Total time needed: ~75 minutes**

All the infrastructure is in place - just needs these final implementations to make all queries functional!
