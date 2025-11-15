# Pre-Deployment Fixes Required for PredictBNB

## 🚨 CRITICAL ISSUES (Must Fix Before Deployment)

### 1. **FeeManager Contract References Wrong Oracle Version** ⛔
**Severity**: CRITICAL
**File**: `contracts/FeeManager.sol:7`

**Issue**:
```solidity
import "./OracleCore.sol";  // ❌ Importing V1
```

But deployment script and tests use `OracleCoreV2`:
```javascript
// scripts/deployV2.js:63
const FeeManager = await hre.ethers.getContractFactory("FeeManager");
const feeManager = await FeeManager.deploy(gameRegistryAddress, oracleCoreAddress);
// oracleCoreAddress is OracleCoreV2!
```

**Fix Required**:
```solidity
// contracts/FeeManager.sol
- import "./OracleCore.sol";
+ import "./OracleCoreV2.sol";

// Line 16:
- OracleCore public oracleCore;
+ OracleCoreV2 public oracleCore;

// Constructor Line 109:
- oracleCore = OracleCore(_oracleCore);
+ oracleCore = OracleCoreV2(_oracleCore);
```

**Impact**: Without this fix, FeeManager will fail to deploy or work incorrectly with OracleCoreV2.

---

### 2. **Deployment Script Has Incorrect Constants** ⚠️
**Severity**: HIGH (Documentation issue)
**File**: `scripts/deployV2.js:88-95`

**Issue**:
```javascript
// scripts/deployV2.js says:
constants: {
  BASE_QUERY_FEE: "0.0005 BNB",      // ❌ WRONG - contract has 0.003
  FREE_DAILY_QUERIES: 100             // ❌ WRONG - contract has 50
}
```

But actual contract values are:
```solidity
// contracts/FeeManager.sol:19-20
uint256 public constant BASE_QUERY_FEE = 0.003 ether;     // $1.80 per query
uint256 public constant FREE_DAILY_QUERIES = 50;
```

**Fix Required**:
```javascript
// scripts/deployV2.js:88-95
constants: {
  REGISTRATION_STAKE: "0.1 BNB",
  DISPUTE_STAKE: "0.2 BNB",
  DISPUTE_WINDOW: "15 minutes",
  BASE_QUERY_FEE: "0.003 BNB",        // ✅ Fixed
  FREE_DAILY_QUERIES: 50,              // ✅ Fixed
  DEPOSIT_TIER_1: "10 BNB",           // Add volume bonus tiers
  DEPOSIT_TIER_2: "50 BNB",
  DEPOSIT_TIER_3: "100 BNB",
  BONUS_TIER_1: "5%",
  BONUS_TIER_2: "10%",
  BONUS_TIER_3: "15%",
  REVENUE_SPLIT: "80% dev / 15% protocol / 5% disputer pool"
}
```

**Impact**: Deployment info will show incorrect constants, confusing developers.

---

### 3. **Missing cancelMatch Function** ⚠️
**Severity**: HIGH
**Files**: Tests reference `cancelMatch()` but function doesn't exist

**Issue**:
```javascript
// test/ExamplePredictionMarket.test.js:391, 401, 414
await oracleCore.connect(gameDev).cancelMatch(matchId);
```

But this function doesn't exist in:
- ❌ `OracleCore.sol`
- ❌ `OracleCoreV2.sol`

**Fix Required - Option A (Add function to OracleCoreV2):**
```solidity
// contracts/OracleCoreV2.sol
/**
 * @notice Cancel a match (e.g., postponed, technical issues)
 * @param _matchId The match to cancel
 */
function cancelMatch(bytes32 _matchId) external nonReentrant whenNotPaused {
    GameRegistry.Match memory matchData = gameRegistry.getMatch(_matchId);
    require(matchData.scheduledTime > 0, "OracleCoreV2: Match does not exist");

    GameRegistry.Game memory game = gameRegistry.getGame(matchData.gameId);
    require(game.developer == msg.sender, "OracleCoreV2: Only game developer can cancel");

    require(
        results[_matchId].submittedAt == 0,
        "OracleCoreV2: Cannot cancel match with submitted result"
    );

    // Update match status in registry
    gameRegistry.updateMatchStatus(_matchId, GameRegistry.MatchStatus.Cancelled);
}
```

**Fix Required - Option B (Fix tests to not use cancelMatch):**
Remove the refund tests that depend on `cancelMatch()` or modify them to use a different scenario.

**Impact**: Tests will fail to compile/run. Feature may be needed for production.

---

## ⚠️ HIGH PRIORITY ISSUES (Should Fix Before Deployment)

### 4. **Tests Haven't Been Executed** 🧪
**Severity**: HIGH
**Issue**: Couldn't run `npx hardhat test` due to network restrictions preventing Solidity compiler download.

**Required Actions**:
1. Run full test suite in environment with network access
2. Verify all 62+ tests pass
3. Check for compilation errors
4. Validate gas costs are reasonable

**Command**:
```bash
npx hardhat test
npx hardhat test --grep "Emergency Pause"
npx hardhat test --grep "Payment-Before-Data"
npx hardhat test --grep "Reentrancy"
```

**Expected Results**:
- ✅ All tests pass
- ✅ No compilation errors
- ✅ Gas costs < 300k for critical functions

---

### 5. **Potential Interface Mismatch Between FeeManager and OracleCoreV2** 🔌
**Severity**: MEDIUM-HIGH
**Issue**: FeeManager calls `oracleCore.getResult(matchId)` but OracleCoreV2 has both:
- `getResult()` - backward compatible version
- `getResultV2()` - new schema-based version

**Verification Needed**:
Check that `OracleCoreV2.getResult()` returns the same interface as `OracleCore.getResult()`:

```solidity
// OracleCoreV2.sol should have:
function getResult(bytes32 _matchId)
    external
    view
    returns (
        string memory resultData,
        bytes32 resultHash,
        bool isFinalized
    )
```

**Action**: Read `OracleCoreV2.sol` lines 680+ to verify compatibility.

---

## 📋 MEDIUM PRIORITY ISSUES (Recommended to Fix)

### 6. **Missing Integration with FeeManager in OracleCoreV2** 🔗
**Issue**: Tests call `oracleCore.setFeeManager()` but this function doesn't exist in OracleCoreV2.

**Evidence**:
```javascript
// test/FeeManager.test.js:43
await oracleCore.setFeeManager(await feeManager.getAddress());
```

But:
```bash
$ grep "setFeeManager" contracts/OracleCoreV2.sol
# No results
```

**Fix Required (if needed for access control)**:
```solidity
// contracts/OracleCoreV2.sol
address public feeManager;

function setFeeManager(address _feeManager) external onlyOwner {
    require(_feeManager != address(0), "OracleCoreV2: Invalid fee manager");
    feeManager = _feeManager;
}

// Optional: Add modifier
modifier onlyFeeManager() {
    require(msg.sender == feeManager, "OracleCoreV2: Only fee manager");
    _;
}
```

**Note**: Check if OracleCoreV2 needs to restrict any functions to FeeManager only. Currently `getResult()` is public view, so may not be needed.

---

### 7. **Deployment Script Missing setFeeManager Call** 📝
**File**: `scripts/deployV2.js`

**Issue**: After deploying FeeManager, should call `oracleCore.setFeeManager()` if that function exists.

**Fix Required** (add after line 66):
```javascript
// Set FeeManager in OracleCore (if function exists)
console.log("\n🔗 Configuring FeeManager in OracleCoreV2...");
await oracleCore.setFeeManager(feeManagerAddress);
console.log("✅ FeeManager configured");
```

---

### 8. **Frontend May Need Updates** 🌐
**File**: `frontend/` directory

**Issue**: Frontend was built for the old UI. After security fixes and contract updates, frontend may need:
1. Update contract addresses
2. Update ABI imports
3. Handle new error messages
4. Support OracleCoreV2 schema features

**Required Actions**:
1. Check `frontend/lib/contracts.ts` or similar for contract addresses
2. Update ABIs after recompilation
3. Test frontend with deployed contracts on testnet

---

## 🔍 LOW PRIORITY ISSUES (Nice to Have)

### 9. **Missing Emergency Pause Tests for FeeManager**
**Issue**: Emergency pause tests only cover OracleCoreV2, but FeeManager also handles critical operations.

**Recommendation**: Add pause functionality to FeeManager or document that it's not paused (relies on OracleCore pause).

---

### 10. **Gas Optimization Opportunities**
**Findings** (from code review):
1. `batchQueryResults()` loops could be optimized
2. `_distributeRevenue()` makes multiple storage writes
3. Array operations in schema validation

**Action**: Run `npx hardhat test --gas-report` and optimize if needed.

---

## ✅ PRE-DEPLOYMENT CHECKLIST

### Critical (Must Complete)
- [ ] **Fix FeeManager to import OracleCoreV2**
- [ ] **Update deployment script constants**
- [ ] **Add cancelMatch function OR fix tests**
- [ ] **Run full test suite successfully**
- [ ] **Verify all 62+ tests pass**

### High Priority (Strongly Recommended)
- [ ] **Verify OracleCoreV2.getResult() interface compatibility**
- [ ] **Add setFeeManager to OracleCoreV2 (if needed)**
- [ ] **Update deployment script to call setFeeManager**
- [ ] **Test deployment on BSC Testnet**
- [ ] **Verify contracts on BSCScan**

### Medium Priority (Recommended)
- [ ] **Update frontend contract addresses/ABIs**
- [ ] **Run gas report and optimize if needed**
- [ ] **Test emergency pause end-to-end**
- [ ] **Document all contract interactions**

### Before Mainnet
- [ ] **Full security audit by external firm**
- [ ] **Bug bounty program**
- [ ] **Multi-sig wallet for owner**
- [ ] **Gradual rollout (whitelist first)**
- [ ] **Monitor for 1 week on testnet with real usage**

---

## 🛠️ QUICK FIX COMMANDS

```bash
# 1. Fix FeeManager import
sed -i 's/OracleCore.sol/OracleCoreV2.sol/g' contracts/FeeManager.sol
sed -i 's/OracleCore public/OracleCoreV2 public/g' contracts/FeeManager.sol

# 2. Try to compile
npx hardhat compile

# 3. Run tests
npx hardhat test

# 4. Deploy to testnet
npx hardhat run scripts/deployV2.js --network bscTestnet

# 5. Verify on BSCScan
npx hardhat verify --network bscTestnet <ADDRESS> <CONSTRUCTOR_ARGS>
```

---

## 📊 RISK ASSESSMENT

| Issue | Severity | Deployment Blocker | Fix Difficulty | ETA |
|-------|----------|-------------------|----------------|-----|
| FeeManager wrong import | CRITICAL | YES ✋ | Easy | 5 min |
| Deployment script constants | HIGH | NO | Easy | 5 min |
| Missing cancelMatch | HIGH | YES ✋ | Medium | 30 min |
| Tests not run | HIGH | YES ✋ | N/A | 10 min |
| Interface compatibility | MEDIUM | NO | Easy | 10 min |
| Missing setFeeManager | MEDIUM | NO | Easy | 15 min |
| Frontend updates | MEDIUM | NO | Medium | 2 hours |
| Gas optimization | LOW | NO | Medium | 4 hours |

**Total Estimated Fix Time**: ~3-4 hours
**Blocker Count**: 3 critical issues

---

## 🎯 RECOMMENDED FIX ORDER

1. **Fix FeeManager import** (5 min) - Unblocks compilation
2. **Add cancelMatch function** (30 min) - Unblocks tests
3. **Run full test suite** (10 min) - Validates fixes
4. **Update deployment script** (10 min) - Accurate documentation
5. **Test deploy to testnet** (20 min) - End-to-end validation
6. **Fix any issues found** (varies) - Iterate
7. **Verify on BSCScan** (30 min) - Production ready
8. **Update frontend** (2 hours) - Full integration

**Total**: ~4 hours to deployment-ready state

---

## 📞 SUPPORT NEEDED

If blocked on any of these issues:
1. Check Hardhat logs for specific errors
2. Review Solidity compiler version (0.8.20)
3. Ensure OpenZeppelin contracts are installed
4. Check BSC testnet has sufficient BNB for deployment
5. Verify PRIVATE_KEY and BSCSCAN_API_KEY in .env

---

**Status**: 🔴 NOT READY FOR DEPLOYMENT (3 critical blockers)
**Next Step**: Fix FeeManager import → Test → Deploy to testnet
**ETA to Production Ready**: 4-6 hours
