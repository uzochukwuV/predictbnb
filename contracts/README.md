# PredictBNB Smart Contracts

**The Data Monetization Layer for Gaming**

PredictBNB is a decentralized oracle infrastructure that transforms games into revenue-generating data APIs. Game developers earn passive income by monetizing their game results, while prediction markets get fast, verified data feeds.

## 🏗️ Architecture Overview

```
┌─────────────────┐
│  GameRegistry   │  ← Game registration, staking, reputation
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   OracleCore    │  ← Self-describing results, 15-min finalization
└────────┬────────┘
         │
         ├────→ ┌──────────────────┐
         │      │  FeeManager      │  ← Prepaid balance, revenue split (80/15/5)
         │      └──────────────────┘
         │
         └────→ ┌──────────────────┐
                │ DisputeResolver  │  ← Challenge mechanism, slashing
                └──────────────────┘
```

## 📁 Contract Structure

### Core Contracts

#### **GameRegistry.sol**
Manages game registration, staking, and match scheduling.

**Key Features:**
- 0.1 BNB minimum stake requirement
- Reputation system (0-1000 score)
- Match scheduling system
- Developer verification
- Slashing mechanism for fraud

**Main Functions:**
```solidity
function registerGame(string name, string metadata) external payable returns (bytes32 gameId)
function scheduleMatch(bytes32 gameId, uint64 scheduledTime, string metadata) external returns (bytes32 matchId)
function increaseStake(bytes32 gameId) external payable
```

#### **OracleCore.sol**
Core oracle with self-describing results and flexible encoding.

**Key Innovations:**
- **Self-Describing Results**: Data + decode schema + quick-access fields
- **Universal Encoding**: Developers can use ANY encoding format
- **Quick-Access Fields**: O(1) queries without decoding
- **15-Minute Dispute Window**: 96x faster than UMA

**Main Functions:**
```solidity
function submitResult(
    bytes32 matchId,
    bytes encodedData,
    string decodeSchema,
    bytes32[] quickFieldKeys,
    bytes32[] quickFieldValues
) external

function getResultField(bytes32 matchId, bytes32 fieldHash) external returns (bytes32)
function getFullResult(bytes32 matchId) external returns (bytes, string, bool)
```

#### **FeeManager.sol**
Manages prepaid balances, query fees, and revenue distribution.

**Key Features:**
- Prepaid balance system with volume bonuses (5-15%)
- Free tier: 50 queries/day per consumer
- Revenue split: 80% developers, 15% protocol, 5% disputers
- Usage-based payouts (fair monetization)
- Gas-efficient (pay gas once, query many times)

**Main Functions:**
```solidity
function depositBalance() external payable
function chargeQueryFee(address consumer, bytes32 gameId) external
function withdrawEarnings(bytes32 gameId) external
```

**Volume Bonuses:**
| Deposit | Bonus | Effective Cost | Queries |
|---------|-------|----------------|---------|
| 10 BNB  | 5%    | 0.00285 BNB   | 3,500   |
| 50 BNB  | 10%   | 0.0027 BNB    | 18,333  |
| 100 BNB | 15%   | 0.00255 BNB   | 38,333  |

#### **DisputeResolver.sol**
Handles disputes with economic incentives.

**Key Features:**
- 0.2 BNB challenge stake (spam deterrent)
- 15-minute dispute window
- Multi-sig resolution (decentralized)
- Slashing for fraudulent data (20-50% of stake)
- Reputation impact

**Main Functions:**
```solidity
function createDispute(bytes32 matchId, string reason, bytes32 evidenceHash) external payable
function resolveDispute(bytes32 disputeId, bool accept, uint8 rewardPercentage) external
```

### Helper Libraries

#### **OracleSubmissionHelper.sol**
Convenience library for common encoding patterns.

**Pre-built Encoders:**
```solidity
// Simple winner + scores
encodeSimpleResult(address winner, uint256 score1, uint256 score2)

// FPS games
encodeFPSResult(address winner, uint256 kills, uint256 deaths, uint256 assists)

// MOBA games
encodeMOBAResult(address winner, uint256 kills, uint256 deaths, uint256 assists, uint256 gold, uint256 damage)
```

**Common Field Hashes:**
```solidity
WINNER_FIELD = keccak256("winner")
SCORE1_FIELD = keccak256("score1")
KILLS_FIELD = keccak256("kills")
MVP_FIELD = keccak256("mvp")
```

### Example Contracts

#### **SimplePredictionMarket.sol**
Reference implementation showing how to integrate with PredictBNB.

**Features:**
- Binary "who will win" markets
- Automatic resolution via oracle
- Proportional payout system
- 2% platform fee

## 🚀 Quick Start Guide

### For Game Developers

**1. Register Your Game**
```solidity
// Stake 0.1 BNB to register
bytes32 gameId = gameRegistry.registerGame{value: 0.1 ether}(
    "My Awesome Game",
    '{"genre": "FPS", "website": "https://mygame.com"}'
);
```

**2. Schedule a Match**
```solidity
bytes32 matchId = gameRegistry.scheduleMatch(
    gameId,
    uint64(block.timestamp + 1 hours), // Match starts in 1 hour
    '{"team1": "TeamA", "team2": "TeamB", "tournament": "Summer Cup"}'
);
```

**3. Submit Result (After Match)**
```solidity
// Option A: Use helper library (easiest)
using OracleSubmissionHelper for *;

(bytes memory data, string memory schema, bytes32[] memory keys, bytes32[] memory values) =
    OracleSubmissionHelper.encodeSimpleResult(
        winnerAddress,
        score1,
        score2
    );

oracleCore.submitResult(matchId, data, schema, keys, values);

// Option B: Custom encoding (full flexibility)
bytes memory customData = abi.encode(winner, kills, deaths, mvp, duration);
string memory customSchema = "(address,uint256,uint256,address,uint256)";

bytes32[] memory keys = new bytes32[](2);
keys[0] = keccak256("winner");
keys[1] = keccak256("kills");

bytes32[] memory values = new bytes32[](2);
values[0] = bytes32(uint256(uint160(winner)));
values[1] = bytes32(kills);

oracleCore.submitResult(matchId, customData, customSchema, keys, values);
```

**4. Withdraw Earnings**
```solidity
// Anytime after queries have been made
feeManager.withdrawEarnings(gameId);
// Earn $1.44 per query forever!
```

### For Prediction Markets

**1. Deposit Prepaid Balance**
```solidity
// Deposit with 15% bonus (100+ BNB)
feeManager.depositBalance{value: 100 ether}();
// Get 115 BNB in credits!
```

**2. Query Oracle**
```solidity
// Option A: Quick field (instant, no decoding)
bytes32 winnerField = keccak256("winner");
bytes32 winnerBytes = oracleCore.getResultField(matchId, winnerField);
address winner = address(uint160(uint256(winnerBytes)));

// Option B: Full data (with decode instructions)
(bytes memory fullData, string memory schema, bool finalized) =
    oracleCore.getFullResult(matchId);

// Decode according to schema
if (keccak256(abi.encodePacked(schema)) == keccak256(abi.encodePacked("simple"))) {
    (address winner, uint256 score1, uint256 score2) =
        abi.decode(fullData, (address, uint256, uint256));
}
```

**3. Resolve Your Market**
```solidity
// Use oracle result to settle bets
address winner = queryOracle(matchId);
payoutWinners(winner);
```

## 💰 Economics

### Revenue Distribution (per query)
- **Query Fee**: 0.003 BNB (~$1.80 at $600/BNB)
- **Developer**: 0.0024 BNB (80%) = **$1.44**
- **Protocol**: 0.00045 BNB (15%) = $0.27
- **Disputer Pool**: 0.00015 BNB (5%) = $0.09

### Developer Earnings Examples
| Queries/Month | Monthly Revenue | Annual Revenue |
|---------------|-----------------|----------------|
| 10,000        | $14,400        | $173,000       |
| 100,000       | $144,000       | $1,728,000     |
| 1,000,000     | $1,440,000     | $17,280,000    |

### Free Tier
- **50 free queries/day** per consumer
- **1,500 free queries/month**
- Perfect for testing and small markets

## 🔒 Security Features

### Economic Security
- **Stake Requirements**: 0.1 BNB minimum to register
- **Challenge Stake**: 0.2 BNB to dispute (spam deterrent)
- **Slashing**: 20-50% stake loss for fraud
- **Reputation System**: 0-1000 score, visible to all

### Technical Security
- **UUPS Upgradeable**: Core contracts can be upgraded
- **ReentrancyGuard**: Protection against reentrancy attacks
- **Custom Errors**: Gas-efficient error handling
- **Event Logging**: Complete audit trail
- **Access Control**: Role-based permissions

### Dispute Mechanism
- **15-minute dispute window** after submission
- **Economic deterrent** against frivolous disputes
- **Multi-sig resolution** for complex cases
- **Evidence submission** (IPFS hashes)
- **Automatic finalization** after window expires

## 🧪 Testing

Run the full test suite:
```bash
npx hardhat test
```

Run with coverage:
```bash
npx hardhat coverage
```

Run gas analysis:
```bash
REPORT_GAS=true npx hardhat test
```

## 📦 Deployment

### Local Development
```bash
# Start local node
npx hardhat node

# Deploy (new terminal)
npx hardhat run scripts/deploy.js --network localhost
```

### BNB Testnet
```bash
npx hardhat run scripts/deploy.js --network bscTestnet
```

### BNB Mainnet
```bash
npx hardhat run scripts/deploy.js --network bscMainnet
```

## 🔧 Configuration

Edit `hardhat.config.js` to configure:
- Network settings (RPC URLs, chain IDs)
- Gas prices and limits
- Contract verification (BSCScan API)
- Compiler version and optimization

## 📚 Additional Resources

- **Whitepaper**: [Idea.md](../Idea.md)
- **Frontend**: See `/frontend` directory
- **SDK**: See `/sdk` directory (coming soon)
- **Docs**: Full documentation at docs.predictbnb.com (coming soon)

## 🛠️ Development Tools

**Required:**
- Hardhat (development environment)
- OpenZeppelin Contracts (security)
- Ethers.js (blockchain interaction)

**Optional:**
- Slither (static analysis)
- Echidna (fuzzing)
- Mythril (security scanning)

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

We welcome contributions! Please see CONTRIBUTING.md for guidelines.

## ⚠️ Security

**Bug Bounty Program**: Up to $500K for critical vulnerabilities

Report security issues to: security@predictbnb.com

## 📞 Contact

- Website: https://predictbnb.com
- Twitter: @PredictBNB
- Discord: discord.gg/predictbnb
- Email: hello@predictbnb.com

---

**Built with ❤️ for the future of gaming data monetization**
