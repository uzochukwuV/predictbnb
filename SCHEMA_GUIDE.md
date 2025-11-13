# Schema System Guide

Complete guide to using PredictBNB's schema system for rich, flexible game data.

## Table of Contents
- [Overview](#overview)
- [Quick Start](#quick-start)
- [Using Template Schemas](#using-template-schemas)
- [Creating Custom Schemas](#creating-custom-schemas)
- [Submitting Results](#submitting-results)
- [Querying Schema Data](#querying-schema-data)
- [Integration Patterns](#integration-patterns)
- [Best Practices](#best-practices)

---

## Overview

The schema system enables games to submit rich, structured data beyond simple win/loss results. This enables sophisticated prediction markets and analytics.

### Key Benefits

✅ **Flexible**: Any game type can define custom data structures
✅ **Discoverable**: Schemas are registered on-chain for transparency
✅ **Typed**: ABI encoding ensures data integrity
✅ **Composable**: Multiple markets can parse the same data
✅ **Extensible**: Add new fields without breaking existing integrations

### Architecture

```
GameSchemaRegistry  → Stores schema definitions
     ↓
SchemaTemplates    → Pre-built schemas (FPS, MOBA, Racing, etc.)
     ↓
OracleCoreV2       → Validates and stores results with schema data
     ↓
Prediction Markets → Query and decode schema-based results
```

---

## Quick Start

### 1. Choose a Template or Create Custom Schema

**Option A: Use a Template** (Recommended)
```solidity
// Get FPS template schema ID
bytes32 schemaId = schemaTemplates.SCHEMA_FPS_PVP();

// Set it for your game contract
schemaRegistry.setGameSchema(address(this), schemaId);
```

**Option B: Create Custom** (Advanced)
```solidity
bytes32[] memory fieldNames = new bytes32[](2);
fieldNames[0] = keccak256("customField1");
fieldNames[1] = keccak256("customField2");

string[] memory fieldTypes = new string[](2);
fieldTypes[0] = "uint256";
fieldTypes[1] = "bool";

bytes32 schemaId = schemaRegistry.registerSchema(
    "MyGame",
    GameSchemaRegistry.SchemaVersion(1, 0, 0),
    "My custom game schema",
    '[{"name":"customField1","type":"uint256"},{"name":"customField2","type":"bool"}]',
    fieldNames,
    fieldTypes,
    false // not a template
);
```

### 2. Encode Custom Data

```solidity
// For FPS games
bytes memory customData = schemaTemplates.encodeFPSData(
    15,   // kills
    8,    // deaths
    10,   // assists
    7,    // headshots
    2500, // damageDealt
    0     // mvpPlayerId
);
```

### 3. Submit Result

```solidity
// Prepare participants and scores
address[] memory participants = new address[](2);
participants[0] = player1;
participants[1] = player2;

uint256[] memory scores = new uint256[](2);
scores[0] = 16; // Team 1 score
scores[1] = 14; // Team 2 score

// Submit to oracle
oracleCore.submitResultV2(
    matchId,
    address(this),      // game contract
    participants,
    scores,
    0,                  // winner index (Team 1 won)
    2400,               // duration in seconds
    schemaId,
    customData
);
```

---

## Using Template Schemas

### Available Templates

| Template | Schema ID | Use Case | Fields |
|----------|-----------|----------|--------|
| **FPS-PvP** | `SCHEMA_FPS_PVP` | CS:GO, Valorant | kills, deaths, assists, headshots, damage, MVP |
| **Racing** | `SCHEMA_RACING` | Mario Kart, F1 | lapTimes, topSpeed, position, distance, perfectRace |
| **Card-Game** | `SCHEMA_CARD_GAME` | Hearthstone, MTG | turns, cardsPlayed, combo, damage, perfectGame, deck |
| **Sports** | `SCHEMA_SPORTS` | FIFA, NBA 2K | quarterScores, possession, shots, fouls, overtime, MVP |
| **Battle-Royale** | `SCHEMA_BATTLE_ROYALE` | Fortnite, PUBG | kills, damage, survivalTime, rank, distance, victory |
| **MOBA** | `SCHEMA_MOBA` | LoL, Dota 2 | kills, deaths, assists, gold, damage, champion, firstBlood |
| **Turn-Based** | `SCHEMA_TURN_BASED` | Chess, TFT | turns, moves, thinkingTime, perfect, strategy, boardState |
| **Puzzle** | `SCHEMA_PUZZLE` | Tetris, Candy Crush | score, level, moves, combo, timeBonus, threeStars |

### Example: FPS Game

```solidity
contract MyFPSGame {
    SchemaTemplates public templates;
    OracleCoreV2 public oracle;

    function submitMatch(
        bytes32 matchId,
        address player1,
        address player2,
        uint256 score1,
        uint256 score2,
        uint256 kills,
        uint256 deaths,
        uint256 headshots
    ) external {
        // Encode FPS data
        bytes memory customData = templates.encodeFPSData(
            kills,
            deaths,
            0,        // assists
            headshots,
            0,        // damageDealt
            score1 > score2 ? 0 : 1  // mvpPlayerId
        );

        // Prepare standard data
        address[] memory participants = new address[](2);
        participants[0] = player1;
        participants[1] = player2;

        uint256[] memory scores = new uint256[](2);
        scores[0] = score1;
        scores[1] = score2;

        // Submit result
        oracle.submitResultV2(
            matchId,
            address(this),
            participants,
            scores,
            score1 > score2 ? 0 : 1,
            3000, // 50 minute match
            templates.SCHEMA_FPS_PVP(),
            customData
        );
    }
}
```

### Example: MOBA Game

```solidity
function submitMOBAResult(
    bytes32 matchId,
    address[] memory players,
    uint256[] memory goldEarned,
    bool team1Won
) external {
    // Encode MOBA-specific data
    bytes memory customData = templates.encodeMOBAData(
        10,    // kills
        5,     // deaths
        8,     // assists
        goldEarned[0],
        15000, // damageToChampions
        42,    // championId
        true   // firstBlood
    );

    uint256[] memory scores = new uint256[](players.length);
    scores[0] = team1Won ? 1 : 0;
    scores[1] = team1Won ? 0 : 1;

    oracle.submitResultV2(
        matchId,
        address(this),
        players,
        scores,
        team1Won ? 0 : 1,
        1800, // 30 minutes
        templates.SCHEMA_MOBA(),
        customData
    );
}
```

---

## Creating Custom Schemas

### When to Create Custom Schemas

- Your game type isn't covered by templates
- You need additional fields beyond standard template
- You want proprietary game mechanics tracked

### Step-by-Step: Custom Schema

```solidity
// 1. Define your fields
bytes32[] memory fieldNames = new bytes32[](3);
fieldNames[0] = keccak256("buildingCount");
fieldNames[1] = keccak256("unitsProduced");
fieldNames[2] = keccak256("resourcesGathered");

string[] memory fieldTypes = new string[](3);
fieldTypes[0] = "uint256";
fieldTypes[1] = "uint256";
fieldTypes[2] = "uint256";

// 2. Create ABI definition (for off-chain parsing)
string memory abiDef = '[{"name":"buildingCount","type":"uint256"},{"name":"unitsProduced","type":"uint256"},{"name":"resourcesGathered","type":"uint256"}]';

// 3. Register schema
bytes32 schemaId = schemaRegistry.registerSchema(
    "RTS-Game",                           // name
    GameSchemaRegistry.SchemaVersion(1, 0, 0), // version
    "Real-time strategy game statistics",      // description
    abiDef,                                    // ABI definition
    fieldNames,
    fieldTypes,
    false                                      // isTemplate (false for custom)
);

// 4. Associate with your game
schemaRegistry.setGameSchema(address(this), schemaId);

// 5. Encode data when submitting results
bytes memory customData = abi.encode(
    uint256(15),  // buildingCount
    uint256(42),  // unitsProduced
    uint256(8500) // resourcesGathered
);
```

### Versioning Schemas

```solidity
// Create version 1.0.0
bytes32 schemaV1 = schemaRegistry.registerSchema(
    "MyGame",
    GameSchemaRegistry.SchemaVersion(1, 0, 0),
    "Version 1",
    abiV1,
    fieldsV1,
    typesV1,
    false
);

// Later, create version 2.0.0 with new fields
bytes32 schemaV2 = schemaRegistry.registerSchema(
    "MyGame",
    GameSchemaRegistry.SchemaVersion(2, 0, 0),
    "Version 2 with extra fields",
    abiV2,
    fieldsV2,
    typesV2,
    false
);

// Games can choose which version to use
schemaRegistry.setGameSchema(address(this), schemaV2);
```

---

## Submitting Results

### Basic Structure

```solidity
function submitResultV2(
    bytes32 matchId,              // From GameRegistry
    address gameContract,         // Your game contract address
    address[] participants,       // Player addresses
    uint256[] scores,             // Parallel array to participants
    uint8 winnerIndex,            // Index in participants array (255 = draw)
    uint256 duration,             // Game duration in seconds
    bytes32 schemaId,             // Schema ID (0 for no custom data)
    bytes customData              // ABI-encoded custom data
)
```

### Complete Example

```solidity
contract BattleRoyaleGame {
    OracleCoreV2 public oracle;
    SchemaTemplates public templates;
    GameRegistry public gameRegistry;

    function endMatch(bytes32 matchId) external {
        // 1. Get match participants (simplified)
        address winner = msg.sender;
        address[] memory participants = new address[](1);
        participants[0] = winner;

        uint256[] memory scores = new uint256[](1);
        scores[0] = 1; // Winner gets score of 1

        // 2. Encode Battle Royale specific data
        bytes memory customData = templates.encodeBattleRoyaleData(
            12,    // kills
            2800,  // damageDealt
            1800,  // survivalTime (30 minutes)
            1,     // placementRank (1st place)
            15000, // distanceTraveled
            true   // victoryRoyale
        );

        // 3. Submit to oracle
        oracle.submitResultV2(
            matchId,
            address(this),
            participants,
            scores,
            0,     // winner is at index 0
            1800,  // duration
            templates.SCHEMA_BATTLE_ROYALE(),
            customData
        );
    }
}
```

### Backward Compatibility

Still works without schemas:

```solidity
// Legacy method (no schema)
oracleCore.submitResult(
    matchId,
    '{"winner": "TeamA", "score": "16-14"}'
);
```

---

## Querying Schema Data

### From Prediction Markets

```solidity
contract AdvancedPredictionMarket {
    OracleCoreV2 public oracle;
    SchemaTemplates public templates;

    function resolveWithSchema(bytes32 matchId) external {
        // 1. Get full result
        OracleCoreV2.GameResult memory result = oracle.getResultV2(matchId);

        // 2. Check if using FPS schema
        if (result.schemaId == templates.SCHEMA_FPS_PVP()) {
            // 3. Decode custom data
            (
                uint256 kills,
                uint256 deaths,
                uint256 assists,
                uint256 headshots,
                uint256 damageDealt,
                uint8 mvpPlayerId
            ) = abi.decode(
                result.customData,
                (uint256, uint256, uint256, uint256, uint256, uint8)
            );

            // 4. Use decoded data for market resolution
            if (headshots > 10) {
                // Resolve "Over 10 headshots" market
            }

            if (kills > deaths * 2) {
                // Resolve "2.0+ K/D ratio" market
            }
        }

        // 5. Always available: standard fields
        address winner = result.participants[result.winnerIndex];
        uint256 winnerScore = result.scores[result.winnerIndex];
    }
}
```

### Querying Without Schema Knowledge

```solidity
// Get schema definition
GameSchemaRegistry.GameSchema memory schema = schemaRegistry.getSchema(result.schemaId);

// Schema contains:
// - schema.name ("FPS-PvP")
// - schema.fieldNames (array of field name hashes)
// - schema.fieldTypes (["uint256", "uint256", ...])
// - schema.abiDefinition (JSON string for off-chain parsing)

// Can build dynamic decoder based on schema.abiDefinition
```

### Off-Chain (JavaScript)

```javascript
const { ethers } = require("ethers");

// Get result
const result = await oracleCore.getResultV2(matchId);

// Get schema
const schema = await schemaRegistry.getSchema(result.schemaId);

// Parse ABI definition
const abiDef = JSON.parse(schema.abiDefinition);
const types = abiDef.map(field => field.type);

// Decode custom data
const decoded = ethers.utils.defaultAbiCoder.decode(types, result.customData);

// Access fields
console.log("Kills:", decoded[0]);
console.log("Deaths:", decoded[1]);
console.log("Assists:", decoded[2]);
```

---

## Integration Patterns

### Pattern 1: Simple Onchain Game

For fully onchain games (passive income!):

```solidity
contract SimpleChessGame {
    OracleCoreV2 public oracle;
    SchemaTemplates public templates;

    // Players just play, no manual result submission needed
    function makeMove(...) external { ... }

    // Auto-submit to oracle when game ends
    function completeGame(bytes32 matchId) internal {
        bytes memory customData = templates.encodeTurnBasedData(
            turnCount,
            moveCount,
            thinkingTime,
            isPerfectGame,
            strategyType,
            finalBoardState
        );

        oracle.submitResultV2(
            matchId,
            address(this),
            [player1, player2],
            [score1, score2],
            winnerIndex,
            duration,
            templates.SCHEMA_TURN_BASED(),
            customData
        );

        // 💰 Now this game's data can be queried by prediction markets
        //    and the game developer earns 80% of query fees!
    }
}
```

### Pattern 2: Hybrid Game (Web2 + Web3)

For traditional games with off-chain servers:

```solidity
contract TraditionalGameOracle {
    OracleCoreV2 public oracle;
    mapping(address => bool) public authorizedServers;

    function submitFromServer(
        bytes32 matchId,
        bytes memory signedResult
    ) external {
        require(authorizedServers[msg.sender], "Not authorized");

        // Verify signature, decode result, submit to oracle
        // ...
    }
}
```

### Pattern 3: Aggregated Results

For tournaments or leagues:

```solidity
contract TournamentOracle {
    mapping(bytes32 => bytes32[]) public tournamentMatches;

    function submitTournamentResults(bytes32 tournamentId) external {
        // Submit multiple match results
        for (uint i = 0; i < tournamentMatches[tournamentId].length; i++) {
            bytes32 matchId = tournamentMatches[tournamentId][i];
            // ... submit each match
        }
    }
}
```

---

## Best Practices

### ✅ Do's

1. **Use Templates When Possible**
   - Pre-built, tested, and widely understood
   - Better discoverability for prediction markets

2. **Version Schemas Carefully**
   - Use semantic versioning (major.minor.patch)
   - Major version for breaking changes
   - Minor version for new fields
   - Patch for documentation fixes

3. **Provide Rich Metadata**
   - Good schema names: "FPS-PvP-v1", "MOBA-5v5"
   - Clear descriptions
   - Complete ABI definitions for off-chain parsing

4. **Validate Before Encoding**
   - Check ranges (e.g., MVP ID < player count)
   - Ensure logical consistency (kills + assists ≥ 0)

5. **Emit Events**
   - Log when schemas are registered
   - Emit result submitted events
   - Enable off-chain indexing

### ❌ Don'ts

1. **Don't Change Schema After Registration**
   - Schemas are immutable
   - Create new version instead

2. **Don't Skip Winner Index**
   - Always provide correct winner (or 255 for draw)
   - Prediction markets rely on this

3. **Don't Encode Sensitive Data**
   - Everything is public on-chain
   - Don't include player IPs, emails, etc.

4. **Don't Use Bytes Instead of Typed Fields**
   - Use proper ABI encoding
   - Enables type safety and validation

5. **Don't Forget Backward Compatibility**
   - Test with both schema and non-schema consumers
   - Ensure standard fields are always populated

---

## 💰 Batch Operations (Cost Optimization)

### Why Batch?

Submitting match results individually can be expensive when you have many matches. **Batch operations save ~40-60% in gas costs**!

**Perfect for:**
- 🏆 Tournaments (submit all bracket results at once)
- 📅 Daily uploads (accumulate results, submit once per day)
- 📜 Historical data (migrate past matches efficiently)
- 🎯 High-volume games (reduce per-match cost)

### Batch Submit Results

```solidity
/**
 * @notice Batch submit up to 50 results in one transaction
 * @param matchIds Array of match IDs
 * @param gameContract Your game contract address (same for all)
 * @param participants Array of participant arrays
 * @param scores Array of score arrays
 * @param winnerIndices Array of winner indices
 * @param durations Array of durations
 * @param schemaId Schema ID (same for all results)
 * @param customDataArray Array of custom data
 * @return successCount Number of successfully submitted results
 */
function batchSubmitResultsV2(
    bytes32[] calldata matchIds,
    address gameContract,
    address[][] calldata participants,
    uint256[][] calldata scores,
    uint8[] calldata winnerIndices,
    uint256[] calldata durations,
    bytes32 schemaId,
    bytes[] calldata customDataArray
) external returns (uint256 successCount);
```

### Example: Tournament Results

```solidity
contract TournamentOrganizer {
    OracleCoreV2 public oracle;
    SchemaTemplates public templates;

    function submitTournamentResults(
        bytes32[] calldata tournamentMatchIds,
        TournamentResult[] calldata results
    ) external {
        // Prepare arrays
        address[][] memory participants = new address[][](results.length);
        uint256[][] memory scores = new uint256[][](results.length);
        uint8[] memory winnerIndices = new uint8[](results.length);
        uint256[] memory durations = new uint256[](results.length);
        bytes[] memory customDataArray = new bytes[](results.length);

        // Populate arrays from tournament results
        for (uint i = 0; i < results.length; i++) {
            participants[i] = results[i].participants;
            scores[i] = results[i].scores;
            winnerIndices[i] = results[i].winnerIndex;
            durations[i] = results[i].duration;

            // Encode FPS data for each match
            customDataArray[i] = templates.encodeFPSData(
                results[i].kills,
                results[i].deaths,
                results[i].assists,
                results[i].headshots,
                results[i].damage,
                results[i].mvp
            );
        }

        // Submit all results in ONE transaction
        uint256 successCount = oracle.batchSubmitResultsV2(
            tournamentMatchIds,
            address(this),
            participants,
            scores,
            winnerIndices,
            durations,
            templates.SCHEMA_FPS_PVP(),
            customDataArray
        );

        emit TournamentResultsSubmitted(successCount);
    }
}
```

### Batch Finalize Results

After the 15-minute dispute window, finalize all results at once:

```solidity
/**
 * @notice Batch finalize up to 100 results in one transaction
 * @param matchIds Array of match IDs to finalize
 * @return successCount Number of successfully finalized results
 */
function batchFinalizeResults(bytes32[] calldata matchIds)
    external
    returns (uint256 successCount);
```

### Example: Daily Finalization

```solidity
contract DailyBatchFinalizer {
    OracleCoreV2 public oracle;
    bytes32[] public pendingResults;

    // Collect match IDs throughout the day
    function trackResult(bytes32 matchId) external {
        pendingResults.push(matchId);
    }

    // Finalize all at once (after dispute windows passed)
    function finalizeDailyBatch() external {
        require(pendingResults.length > 0, "No pending results");

        uint256 finalized = oracle.batchFinalizeResults(pendingResults);

        // Clear processed results
        delete pendingResults;

        emit DailyBatchFinalized(finalized);
    }
}
```

### Gas Comparison

| Operation | Individual (20 results) | Batch (20 results) | Savings |
|-----------|-------------------------|-------------------|---------|
| **Submit Results** | ~3,000,000 gas | ~1,400,000 gas | **~53%** |
| **Finalize Results** | ~1,600,000 gas | ~800,000 gas | **~50%** |
| **Total Cost** | ~4,600,000 gas | ~2,200,000 gas | **~52%** |

**At 5 gwei gas price:**
- Individual: ~0.023 BNB
- Batch: ~0.011 BNB
- **Saved: ~0.012 BNB per 20 matches**

### Batch Limits

- **Submit**: Max 50 results per transaction
- **Finalize**: Max 100 results per transaction
- Arrays must all be same length
- Schema ID must be same for all results

### Error Handling

Batch operations are **fault-tolerant**:

```solidity
// Submits 20 results, but 3 have issues (already submitted, invalid data, etc.)
uint256 success = oracle.batchSubmitResultsV2(...); // Returns 17

// Event emitted: BatchResultsSubmitted(submitter, 17, 20)
// 17 succeeded, 3 skipped, no revert!
```

**Invalid results are skipped**, not reverted:
- ✅ Already submitted
- ✅ Invalid participants/scores
- ✅ Failed schema validation
- ✅ Non-existent match

This ensures **maximum success rate** even with partial data issues.

### Best Practices

1. **Tournament Organizers**: Submit all bracket results together
   ```javascript
   // After tournament completes
   await oracle.batchSubmitResultsV2(allMatchIds, ...)
   ```

2. **Daily Batch**: Accumulate results during the day
   ```javascript
   // Submit once per day at 00:00 UTC
   cron.schedule('0 0 * * *', async () => {
     await oracle.batchSubmitResultsV2(todaysMatches, ...)
   })
   ```

3. **Historical Migration**: Upload past matches efficiently
   ```javascript
   // Migrate 1000 past matches in batches of 50
   for (let i = 0; i < 1000; i += 50) {
     const batch = pastMatches.slice(i, i + 50)
     await oracle.batchSubmitResultsV2(batch, ...)
   }
   ```

4. **Auto-Finalization**: Run batch finalizer after dispute window
   ```javascript
   // Every 30 minutes, finalize eligible results
   cron.schedule('*/30 * * * *', async () => {
     const eligible = await getEligibleForFinalization()
     if (eligible.length > 0) {
       await oracle.batchFinalizeResults(eligible)
     }
   })
   ```

### Try It Yourself

Run the batch example script:

```bash
npm run demo:batch
```

Or see the code:
- `scripts/batchSubmitExample.js` - Complete tournament example
- `test/BatchOperations.test.js` - Comprehensive tests

---

## FAQ

**Q: Can I update my schema after registering?**
A: No. Schemas are immutable. Create a new version instead.

**Q: Do I have to use a schema?**
A: No. Backward compatible with simple JSON result strings.

**Q: How many schemas can I create?**
A: Unlimited, but each costs gas to register.

**Q: Can multiple games use the same schema?**
A: Yes! That's the power of templates.

**Q: What if my game has 100 data points?**
A: Consider grouping into logical sub-structs or using multiple schemas.

**Q: Can I see what schemas exist?**
A: Yes, call `schemaRegistry.getAllSchemas()` or `getTemplateSchemas()`.

**Q: How do prediction markets discover my schema?**
A: They query your game contract address in the schema registry.

**Q: What's the gas cost?**
A: Schema registration: ~200k gas. Individual result: ~150k gas. Batch result: ~70k gas per result.

**Q: Should I use batch submission?**
A: Yes! If you have 5+ results to submit, batch saves ~40-60% gas. Perfect for tournaments and daily uploads.

**Q: What's the maximum batch size?**
A: Submit: 50 results. Finalize: 100 results. Split larger batches across multiple transactions.

**Q: What happens if some results in a batch are invalid?**
A: Invalid results are skipped (not reverted). You get back the count of successful submissions.

---

## Summary

The schema system enables:

- 🎮 **Game devs**: Rich data monetization
- 📊 **Prediction markets**: Sophisticated betting options
- 🔍 **Analytics**: Deep insights into gaming data
- 🚀 **Composability**: Multiple markets, one data source

**Start with templates, customize when needed, and enjoy passive income from your game data!**

For more examples, see:
- `contracts/examples/OnchainChessGame.sol`
- `test/SchemaRegistry.test.js`
- `test/OracleCoreV2.test.js`

Questions? Check the [GitHub Discussions](https://github.com/uzochukwuV/predictbnb/discussions)
