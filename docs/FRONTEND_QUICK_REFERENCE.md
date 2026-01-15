# Frontend Quick Reference - New Contract Functions

## TL;DR - What Changed

**All match-related functions now require `gameId` parameter for validation** (as you requested).

Before: `getMatch(matchId)`
After: `getGameMatch(gameId, matchId)`

This prevents bugs and ensures you always know which game a match belongs to.

---

## Quick Function Lookup

### 📊 Dashboard Stats

```typescript
// Get developer's games
const gameIds = await gameRegistry.read.getDeveloperGames([address]);

// Get oracle stats for a game
const stats = await oracleCore.read.getGameStats([gameId]);
// Returns: { totalResults, finalizedResults, disputedResults }

// Calculate finalization rate
const rate = (stats.finalizedResults / stats.totalResults) * 100;
```

### 🎮 Game Detail Page

```typescript
// Get all matches for a game
const matchIds = await gameRegistry.read.getGameMatches([gameId]);

// Or get paginated (better for large datasets)
const matchIds = await gameRegistry.read.getGameMatchesPaginated([
  gameId,
  0,   // page * pageSize
  20   // pageSize
]);

// Get match details (with gameId validation)
const match = await gameRegistry.read.getGameMatch([gameId, matchId]);
```

### 📈 Batch Operations (Reduce RPC Calls)

```typescript
// Instead of this (N calls):
const matches = await Promise.all(
  matchIds.map(id => gameRegistry.read.getMatch([id]))
);

// Do this (1 call):
const matches = await gameRegistry.read.getMatchesBatch([matchIds]);
```

### 🎲 RPS Game Page

```typescript
// Get recent 10 matches
const matches = await rps.read.getRecentMatches([10]);

// Get player's match history
const playerMatchIds = await rps.read.getPlayerMatches([playerAddress]);

// Get game stats
const stats = await rps.read.getGameStats();
// Returns: { totalMatches, completedMatches, activeMatches }
```

---

## Function Signatures

### GameRegistry

```typescript
// Match tracking
getGameMatches(gameId: bytes32): bytes32[]
getGameMatchesPaginated(gameId: bytes32, offset: uint256, limit: uint256): bytes32[]
getGameMatch(gameId: bytes32, matchId: bytes32): Match
matchExists(gameId: bytes32, matchId: bytes32): bool

// Batch operations
getMatchesBatch(matchIds: bytes32[]): Match[]
getGamesBatch(gameIds: bytes32[]): Game[]

// Statistics
getDeveloperStats(developer: address): {
  totalGames: uint256,
  totalMatches: uint256,
  totalDisputes: uint256,
  averageReputation: uint256
}

// Pagination
getAllGames(offset: uint256, limit: uint256): Game[]
getActiveGames(): bytes32[]
```

### OracleCore

```typescript
// Per-game stats
getGameStats(gameId: bytes32): {
  totalResults: uint256,
  finalizedResults: uint256,
  disputedResults: uint256
}

// Results
getGameResults(gameId: bytes32): bytes32[]
getGameResult(gameId: bytes32, matchId: bytes32): Result

// Global stats
getGlobalStats(): {
  totalResults: uint256,
  totalFinalized: uint256,
  totalDisputed: uint256
}

// Batch & queries
getResultsBatch(matchIds: bytes32[]): Result[]
getPendingResults(gameId: bytes32, limit: uint256): bytes32[]
```

### RockPaperScissors

```typescript
// Match retrieval
getAllMatches(): bytes32[]
getRecentMatches(limit: uint256): RPSMatch[]
getPlayerMatches(player: address): bytes32[]
getGameMatch(gameId: bytes32, matchId: bytes32): RPSMatch

// Statistics
getGameStats(): {
  totalMatches: uint256,
  completedMatches: uint256,
  activeMatches: uint256
}

// Batch
getMatchesBatch(matchIds: bytes32[]): RPSMatch[]
```

---

## Migration Guide

### Old Code → New Code

#### 1. Getting match details

**Before:**
```typescript
const match = await gameRegistry.read.getMatch([matchId]);
```

**After:**
```typescript
const match = await gameRegistry.read.getGameMatch([gameId, matchId]);
```

**Why?** Validates match belongs to game, prevents bugs.

---

#### 2. Getting all matches for a game

**Before:**
```typescript
// Not possible! Had to use events or external indexer
```

**After:**
```typescript
const matchIds = await gameRegistry.read.getGameMatches([gameId]);
```

**Why?** Direct on-chain tracking, no indexer needed.

---

#### 3. Getting oracle stats

**Before:**
```typescript
// Not possible! Stats were only global
```

**After:**
```typescript
const stats = await oracleCore.read.getGameStats([gameId]);
console.log(`Finalization rate: ${stats.finalizedResults}/${stats.totalResults}`);
```

**Why?** Per-game statistics for detailed dashboards.

---

#### 4. Batch fetching (optimization)

**Before:**
```typescript
const matches = [];
for (const id of matchIds) {
  const match = await gameRegistry.read.getMatch([id]);
  matches.push(match);
}
// N RPC calls!
```

**After:**
```typescript
const matches = await gameRegistry.read.getMatchesBatch([matchIds]);
// 1 RPC call!
```

**Why?** Faster, fewer RPC calls, better UX.

---

## Complete Dashboard Example

```typescript
export async function fetchDashboardData(developerAddress: Address) {
  // 1. Get all games for developer
  const gameIds = await gameRegistry.read.getDeveloperGames([developerAddress]);

  if (gameIds.length === 0) {
    return { games: [], stats: null };
  }

  // 2. Batch get game details
  const games = await gameRegistry.read.getGamesBatch([gameIds]);

  // 3. For each game, get comprehensive data
  const gameData = await Promise.all(
    gameIds.map(async (gameId, index) => {
      // Oracle stats
      const oracleStats = await oracleCore.read.getGameStats([gameId]);

      // Earnings
      const earnings = await feeManager.read.developerEarnings([gameId]);

      // Recent matches (paginated)
      const recentMatchIds = await gameRegistry.read.getGameMatchesPaginated([
        gameId,
        0,
        10,
      ]);

      // Pending results
      const pendingResults = await oracleCore.read.getPendingResults([
        gameId,
        10,
      ]);

      return {
        gameId,
        game: games[index],
        oracleStats: {
          totalResults: Number(oracleStats.totalResults),
          finalizedResults: Number(oracleStats.finalizedResults),
          disputedResults: Number(oracleStats.disputedResults),
          finalizationRate:
            Number(oracleStats.totalResults) > 0
              ? (Number(oracleStats.finalizedResults) /
                  Number(oracleStats.totalResults)) *
                100
              : 0,
          disputeRate:
            Number(oracleStats.totalResults) > 0
              ? (Number(oracleStats.disputedResults) /
                  Number(oracleStats.totalResults)) *
                100
              : 0,
        },
        earnings: {
          total: formatEther(earnings.totalEarned),
          pending: formatEther(earnings.pendingEarnings),
          queries: Number(earnings.totalQueries),
        },
        recentMatchIds,
        pendingCount: pendingResults.length,
      };
    })
  );

  // 4. Get developer-level stats
  const developerStats = await gameRegistry.read.getDeveloperStats([
    developerAddress,
  ]);

  return {
    games: gameData,
    stats: {
      totalGames: Number(developerStats._totalGames),
      totalMatches: Number(developerStats._totalMatches),
      totalDisputes: Number(developerStats._totalDisputes),
      averageReputation: Number(developerStats.averageReputation),
    },
  };
}
```

---

## Game Detail Page Example

```typescript
export async function fetchGameDetailData(gameId: Bytes32) {
  // 1. Get game info
  const game = await gameRegistry.read.getGame([gameId]);

  // 2. Get oracle stats
  const oracleStats = await oracleCore.read.getGameStats([gameId]);

  // 3. Get all match IDs (for count)
  const allMatchIds = await gameRegistry.read.getGameMatches([gameId]);

  // 4. Get recent matches (paginated)
  const recentMatchIds = await gameRegistry.read.getGameMatchesPaginated([
    gameId,
    0,
    20, // First 20
  ]);

  // 5. Batch get match details
  const matches = await gameRegistry.read.getMatchesBatch([recentMatchIds]);

  // 6. Get pending results
  const pendingResults = await oracleCore.read.getPendingResults([gameId, 10]);

  // 7. Get earnings
  const earnings = await feeManager.read.developerEarnings([gameId]);

  return {
    game: {
      name: game.name,
      developer: game.developer,
      reputation: Number(game.reputation),
      stake: formatEther(game.stakedAmount),
      active: game.isActive,
      totalMatches: Number(game.totalMatches),
    },
    oracleStats: {
      totalResults: Number(oracleStats.totalResults),
      finalizedResults: Number(oracleStats.finalizedResults),
      disputedResults: Number(oracleStats.disputedResults),
    },
    matches: {
      total: allMatchIds.length,
      recent: matches,
      pending: pendingResults.length,
    },
    earnings: {
      total: formatEther(earnings.totalEarned),
      pending: formatEther(earnings.pendingEarnings),
      queries: Number(earnings.totalQueries),
    },
  };
}
```

---

## RPS Game Page Example

```typescript
export async function fetchRPSGameData(
  rpsAddress: Address,
  playerAddress?: Address
) {
  const rps = getRPSContract(rpsAddress);

  // 1. Get game ID
  const gameId = await rps.read.gameId();

  // 2. Get recent matches
  const recentMatches = await rps.read.getRecentMatches([10]);

  // 3. Get game stats
  const stats = await rps.read.getGameStats();

  // 4. If player address provided, get their history
  const playerData = playerAddress
    ? {
        matchIds: await rps.read.getPlayerMatches([playerAddress]),
        stats: await rps.read.getPlayerStats([playerAddress]),
      }
    : null;

  return {
    gameId,
    recentMatches: recentMatches.map((match) => ({
      matchId: match.matchId,
      player1: match.player1,
      player2: match.player2,
      scheduledTime: Number(match.scheduledTime),
      status: match.status,
      winner: match.winner,
      player1Wins: match.player1Wins,
      player2Wins: match.player2Wins,
    })),
    stats: {
      total: Number(stats.totalMatches),
      completed: Number(stats.completedMatches),
      active: Number(stats.activeMatches),
    },
    player: playerData
      ? {
          matches: playerData.matchIds.length,
          wins: Number(playerData.stats.wins),
          totalMatches: Number(playerData.stats.totalMatches),
        }
      : null,
  };
}
```

---

## Performance Tips

### 1. **Use Pagination**
```typescript
// ✅ Good - loads 20 at a time
const matchIds = await gameRegistry.read.getGameMatchesPaginated([gameId, 0, 20]);

// ❌ Bad - loads all (could be thousands)
const matchIds = await gameRegistry.read.getGameMatches([gameId]);
```

### 2. **Batch When Possible**
```typescript
// ✅ Good - 1 call
const matches = await gameRegistry.read.getMatchesBatch([matchIds]);

// ❌ Bad - N calls
const matches = await Promise.all(
  matchIds.map(id => gameRegistry.read.getGameMatch([gameId, id]))
);
```

### 3. **Cache Static Data**
```typescript
// Game details rarely change - cache for 5 minutes
const game = await cache.remember(
  `game-${gameId}`,
  300,
  () => gameRegistry.read.getGame([gameId])
);

// Stats change frequently - don't cache or cache for 10 seconds
const stats = await cache.remember(
  `stats-${gameId}`,
  10,
  () => oracleCore.read.getGameStats([gameId])
);
```

### 4. **Parallel Fetching**
```typescript
// ✅ Good - fetch in parallel
const [game, stats, matches, earnings] = await Promise.all([
  gameRegistry.read.getGame([gameId]),
  oracleCore.read.getGameStats([gameId]),
  gameRegistry.read.getGameMatches([gameId]),
  feeManager.read.developerEarnings([gameId]),
]);

// ❌ Bad - sequential fetching (4x slower)
const game = await gameRegistry.read.getGame([gameId]);
const stats = await oracleCore.read.getGameStats([gameId]);
const matches = await gameRegistry.read.getGameMatches([gameId]);
const earnings = await feeManager.read.developerEarnings([gameId]);
```

---

## Error Handling

```typescript
try {
  // This will revert if match doesn't belong to game
  const match = await gameRegistry.read.getGameMatch([gameId, matchId]);
} catch (error) {
  if (error.message.includes("Match not from this game")) {
    console.error("Match ID doesn't belong to this game");
  }
}

try {
  // This will revert if result doesn't belong to game
  const result = await oracleCore.read.getGameResult([gameId, matchId]);
} catch (error) {
  if (error.message.includes("Result not from this game")) {
    console.error("Result doesn't belong to this game");
  }
}
```

---

## Summary

### What You Need to Know:
1. **Always pass `gameId` when querying matches/results**
2. **Use batch functions to reduce RPC calls**
3. **Use pagination for large datasets**
4. **All old functions still work** (backward compatible)

### Most Important Functions:
- `getGameMatches(gameId)` - Get all matches for a game
- `getGameStats(gameId)` - Get oracle stats per game
- `getMatchesBatch(matchIds)` - Batch get match details
- `getDeveloperStats(address)` - Aggregated developer stats

### Next Steps:
1. Update your contract ABIs
2. Replace old function calls with new ones
3. Test with the provided examples
4. Deploy and enjoy better data access!
