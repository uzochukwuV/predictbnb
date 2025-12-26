# Fee Model Economics - Balancing Game Providers & Prediction Markets

## Current Model Analysis

### Current Setup
- **Query Fee**: $1.44 per match query (0.003 BNB @ $600/BNB)
- **Free Tier**: 5 unique matches per day per consumer
- **Revenue Split**: 80% developer / 15% protocol / 5% disputers
- **Payment Model**: Once per consumer per match (subsequent queries FREE)

### Problem Identified

**Scenario**: 10 prediction markets query 5 games/day

**Daily Revenue:**
- Free queries: 10 markets × 5 free matches = 50 queries = **$0**
- Paid queries: 0 (all covered by free tier)
- **Developer earnings: $0/day** ❌

**Result**: Developers get nothing if prediction markets stay within free tier!

---

## Proposed Solutions

### Option 1: Tiered Free Tier by Consumer Type

**Concept**: Different free tiers based on consumer balance/stake

```solidity
// Free tier based on deposited balance
- Balance < 1 BNB:     0 free queries/day
- Balance 1-5 BNB:     2 free queries/day
- Balance 5-10 BNB:    3 free queries/day
- Balance 10+ BNB:     5 free queries/day
```

**Benefits:**
- ✅ Encourages prediction markets to deposit more funds
- ✅ Small prediction markets still pay per query
- ✅ Large prediction markets get benefits for locking capital
- ✅ Developers earn from small markets

**Economics Example** (10 markets, 5 games/day):
- 5 small markets (0 BNB): 5 markets × 5 games × $1.44 = **$36/day**
- 5 large markets (10+ BNB): 5 markets × 0 free = **$0/day**
- **Total: $36/day = $1,080/month** for developer

---

### Option 2: Free Tier with Monthly Fee (Subscription Model)

**Concept**: Pay monthly for unlimited queries OR pay per query

```solidity
// Subscription tiers
- No subscription:        Pay $1.44 per query
- Basic ($50/month):      10 queries/day free, then $1.00/query
- Pro ($150/month):       25 queries/day free, then $0.75/query
- Unlimited ($500/month): Unlimited queries
```

**Benefits:**
- ✅ Predictable revenue for developers
- ✅ Heavy users save money
- ✅ Light users pay per query
- ✅ Better for scaling

**Economics Example** (10 markets, 5 games/day):
- 3 markets on Unlimited: 3 × $500 = **$1,500/month**
- 4 markets on Pro: 4 × $150 = **$600/month**
- 3 markets on Basic: 3 × $50 = **$150/month**
- **Total: $2,250/month** for developer

---

### Option 3: Hybrid Model - Free Tier Expires After First Payment

**Concept**: Free tier is only for NEW consumers (trial period)

```solidity
// First-time users
- First 5 matches ever:   FREE (trial)
- After that:             Pay $1.44 per match forever

// Daily reset only applies to NEW matches
- Can still query old matches for free (already paid)
```

**Benefits:**
- ✅ Onboarding friendly (try before you buy)
- ✅ One-time cost, no gaming the system
- ✅ Developers earn after trial period
- ✅ Scales with number of consumers

**Economics Example** (10 markets, 5 games/day, after trial):
- Day 1 trial: 10 markets × 5 free = **$0**
- Day 2-30: 10 markets × 5 games × $1.44 = **$72/day** = **$2,088/month**

---

### Option 4: Volume-Based Pricing (Recommended ⭐)

**Concept**: Price decreases with volume, but NO free tier

```solidity
// Pricing tiers (per match query)
Queries 1-10/day:      $1.44 per query (100%)
Queries 11-25/day:     $1.15 per query (80%)
Queries 26-50/day:     $0.86 per query (60%)
Queries 50+/day:       $0.58 per query (40%)
```

**Benefits:**
- ✅ Everyone pays something
- ✅ Heavy users get discounts
- ✅ Encourages more usage
- ✅ Fair for all parties
- ✅ No free tier to abuse

**Economics Example** (10 markets, 5 games/day):
- Total queries: 10 × 5 = 50 queries/day
- First 10 queries: 10 × $1.44 = $14.40
- Next 15 queries: 15 × $1.15 = $17.25
- Next 25 queries: 25 × $0.86 = $21.50
- **Daily: $53.15 = $1,595/month** for developer

---

### Option 5: Pay-Per-Data-Point Model

**Concept**: Charge based on what data is accessed, not queries

```solidity
// Data access pricing
Basic result (winner):           $0.50
Full result (all fields):        $1.44
Historical data (past results):  $0.25
Live updates (real-time):        $2.00/match

// Bundle discounts
10 matches basic:    $4.50 (10% off)
50 matches basic:    $20.00 (20% off)
```

**Benefits:**
- ✅ Granular pricing
- ✅ Heavy users optimize costs
- ✅ More data = more revenue
- ✅ Flexible for different use cases

**Economics Example** (10 markets, 5 games/day):
- If 50% use basic, 50% use full:
  - Basic: 25 queries × $0.50 = $12.50
  - Full: 25 queries × $1.44 = $36.00
- **Daily: $48.50 = $1,455/month**

---

## Recommended Approach: Hybrid Volume-Based + First-Query Discount

### Implementation

```solidity
struct PricingTier {
    uint32 dailyQueryCount;  // Queries made today
    uint32 lifetimeQueries;  // Total queries ever
    bool hasUsedFreeTier;    // Used free trial?
}

function getQueryPrice(address consumer, bytes32 matchId) public view returns (uint256) {
    PricingTier memory tier = consumerTiers[consumer];

    // First-time users: First 3 matches FREE (not 5)
    if (!tier.hasUsedFreeTier && tier.lifetimeQueries < 3) {
        return 0; // FREE trial
    }

    // Check if already paid for this match
    if (hasPaidForMatch[consumer][matchId]) {
        return 0; // FREE (already paid)
    }

    // Volume-based pricing
    uint32 todayCount = tier.dailyQueryCount;

    if (todayCount < 10) {
        return 0.003 ether; // $1.44 (100%)
    } else if (todayCount < 25) {
        return 0.0024 ether; // $1.15 (80%)
    } else if (todayCount < 50) {
        return 0.0018 ether; // $0.86 (60%)
    } else {
        return 0.0012 ether; // $0.58 (40%)
    }
}
```

### Benefits of This Approach

1. **For Game Developers:**
   - ✅ Only 3 free trials (not 5), limited exposure
   - ✅ Every prediction market pays after trial
   - ✅ Predictable revenue from active users
   - ✅ Volume discounts encourage more queries = more total revenue

2. **For Prediction Markets:**
   - ✅ Try before you buy (3 free matches)
   - ✅ Save money with higher volume
   - ✅ Pay once per match, query unlimited times after
   - ✅ Fair pricing that rewards loyalty

3. **Platform Health:**
   - ✅ Sustainable economics
   - ✅ Encourages growth
   - ✅ No free tier abuse
   - ✅ Natural user segmentation

### Economics Comparison

**Scenario**: 10 prediction markets, 5 games/day, 30 days

| Model | Month 1 Revenue | Month 2+ Revenue | Notes |
|-------|----------------|------------------|-------|
| Current (5 free/day) | $0 | $0 | ❌ All free! |
| Option 1 (Tiered) | $1,080 | $1,080 | Medium revenue |
| Option 2 (Subscription) | $2,250 | $2,250 | High revenue |
| Option 3 (Trial) | $2,088 | $2,088 | High after trial |
| **Option 4 (Volume)** | **$1,595** | **$1,595** | ⭐ Balanced |
| Option 5 (Data-based) | $1,455 | $1,455 | Complex |
| **Recommended (Hybrid)** | **$1,450** | **$1,595** | ⭐ Best balance |

---

## Recommended Implementation

### Changes to FeeManagerV2.sol

```solidity
// Update constants
uint32 public constant FREE_TIER_TRIAL_LIMIT = 3; // Only 3 free matches ever (trial)

// Add volume pricing tiers
uint256 public constant TIER1_PRICE = 0.003 ether;  // $1.44 (1-10 queries/day)
uint256 public constant TIER2_PRICE = 0.0024 ether; // $1.15 (11-25 queries/day)
uint256 public constant TIER3_PRICE = 0.0018 ether; // $0.86 (26-50 queries/day)
uint256 public constant TIER4_PRICE = 0.0012 ether; // $0.58 (51+ queries/day)

// Track lifetime queries for trial
mapping(address => uint32) public lifetimeQueries;
mapping(address => bool) public hasUsedFreeTier;

function chargeQueryFee(address consumer, bytes32 gameId, bytes32 matchId) external nonReentrant {
    // ... existing checks ...

    // Check if already paid
    if (hasPaidForMatch[consumer][matchId]) {
        emit QueryFeeCharged(consumer, gameId, 0, true);
        return;
    }

    // Free trial: First 3 unique matches ever
    if (!hasUsedFreeTier[consumer] && lifetimeQueries[consumer] < FREE_TIER_TRIAL_LIMIT) {
        lifetimeQueries[consumer]++;
        if (lifetimeQueries[consumer] >= FREE_TIER_TRIAL_LIMIT) {
            hasUsedFreeTier[consumer] = true;
        }

        hasPaidForMatch[consumer][matchId] = true;
        balance.totalQueries++;
        totalQueries++;

        _processQueryExtras(consumer, gameId);
        emit QueryFeeCharged(consumer, gameId, 0, true);
        return;
    }

    // Volume-based pricing
    uint256 price = _getVolumePrice(balance.freeQueriesUsed); // Reuse this counter for daily volume

    // Check balance
    uint256 totalBalance = uint256(balance.realBalance) + uint256(balance.bonusBalance);
    if (totalBalance < price) revert InsufficientBalance();

    // Deduct price
    _deductBalance(balance, price);

    balance.totalQueries++;
    balance.freeQueriesUsed++; // Track daily volume
    totalQueries++;
    totalRevenue += price;
    lifetimeQueries[consumer]++;

    hasPaidForMatch[consumer][matchId] = true;

    _distributeRevenue(gameId, price);
    _processQueryExtras(consumer, gameId);

    emit QueryFeeCharged(consumer, gameId, price, false);
}

function _getVolumePrice(uint32 dailyCount) internal pure returns (uint256) {
    if (dailyCount < 10) return TIER1_PRICE;      // $1.44
    if (dailyCount < 25) return TIER2_PRICE;      // $1.15
    if (dailyCount < 50) return TIER3_PRICE;      // $0.86
    return TIER4_PRICE;                            // $0.58
}
```

---

## Revenue Projections (Recommended Model)

### Conservative Scenario (Month 2+)
- 10 prediction markets
- 5 games/day average
- 30 days

**Daily Breakdown:**
- Queries 1-10: 10 × $1.44 = $14.40
- Queries 11-25: 15 × $1.15 = $17.25
- Queries 26-50: 25 × $0.86 = $21.50
- **Daily Total: $53.15**

**Monthly Revenue:**
- Developer (80%): $1,276/month
- Protocol (15%): $239/month
- Disputers (5%): $80/month
- **Total: $1,595/month**

### Growth Scenario (6 months)
- 50 prediction markets
- 10 games/day average

**Monthly Revenue:**
- Total queries: 50 × 10 = 500/day
- Average price: ~$0.70/query (volume discount)
- Daily: $350
- **Developer: $8,400/month** 🚀

### Viral Scenario (1 year)
- 200 prediction markets
- 15 games/day average

**Monthly Revenue:**
- Total queries: 200 × 15 = 3,000/day
- Average price: ~$0.65/query
- Daily: $1,950
- **Developer: $46,800/month** 🎉

---

## Summary & Recommendation

### ⭐ Implement Hybrid Volume-Based Model

**Key Changes:**
1. **Reduce free tier from 5 to 3 matches** (one-time trial, not daily)
2. **Add volume-based pricing** (4 tiers: 100%, 80%, 60%, 40%)
3. **Keep per-consumer per-match payment** (subsequent queries free)
4. **Remove daily free reset** (trial is lifetime, not daily)

**Why This Works:**
- ✅ Developers earn revenue from all active users
- ✅ Prediction markets get fair trial period
- ✅ Volume discounts reward growth
- ✅ No free tier abuse
- ✅ Sustainable long-term economics
- ✅ Scales with platform growth

**Action Items:**
1. Update `FREE_TIER_DAILY_LIMIT` to `FREE_TIER_TRIAL_LIMIT = 3`
2. Add volume pricing tiers (4 levels)
3. Add `lifetimeQueries` and `hasUsedFreeTier` tracking
4. Implement `_getVolumePrice()` function
5. Update tests to reflect new pricing
6. Update documentation

This model creates a win-win: developers earn sustainable revenue, prediction markets get fair pricing, and the platform grows naturally! 🎯
