// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./GameRegistry.sol";

/**
 * @title FeeManagerV2
 * @notice Enhanced fee manager with referrals, streaks, lottery, and developer bonuses
 * @dev Optimized to avoid stack-too-deep errors, max 8 fields per struct
 */
contract FeeManagerV2 is OwnableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    // ============ Errors ============

    error InsufficientBalance();
    error InvalidAmount();
    error GameNotRegistered();
    error NoEarningsToWithdraw();
    error TransferFailed();
    error FreeTierExceeded();
    error Unauthorized();
    error AlreadyReferred();
    error SelfReferral();
    error MarketingBudgetDepleted();

    // ============ Structs (Max 8 fields each) ============

    struct ConsumerBalance {
        uint128 realBalance;      // Real BNB deposited
        uint128 bonusBalance;     // Bonus credits (virtual)
        uint64 lastResetTime;     // Free tier daily reset
        uint32 freeQueriesUsed;   // Free queries used today
        uint32 totalQueries;      // Lifetime queries
        uint8 bonusTier;          // Volume bonus tier (0-3)
    }

    struct DeveloperEarnings {
        uint128 totalEarned;      // Lifetime earnings
        uint128 pendingEarnings;  // Available to withdraw
        uint64 lastWithdrawTime;  // Last withdrawal timestamp
        uint32 totalQueries;      // Queries served
    }

    struct StreakData {
        uint64 lastActiveDay;     // Last active day (timestamp / 1 days)
        uint16 currentStreak;     // Current consecutive days
        uint16 longestStreak;     // All-time best
        uint128 totalRewards;     // Total rewards claimed
    }

    struct ReferralData {
        address referrer;         // Who referred this user
        uint32 referralCount;     // How many users referred
        uint128 earningsFromRefs; // Total earned from referrals
        bool hasUsedReferral;     // Prevent re-referral
    }

    struct LotteryTicket {
        uint64 roundId;           // Which lottery round
        uint32 ticketCount;       // Number of tickets
    }

    // ============ State Variables ============

    /// @notice Tracks if a consumer has paid for a specific match
    /// @dev consumer => matchId => hasPaid
    mapping(address => mapping(bytes32 => bool)) public hasPaidForMatch;

    /// @notice Tracks lifetime free matches used (trial period)
    /// @dev consumer => matchId => hasUsedFreeTier
    mapping(address => mapping(bytes32 => bool)) public freeTrialUsed;

    /// @notice Tracks lifetime free query count per consumer
    mapping(address => uint32) public lifetimeTrialQueries;

    /// @notice Game developer premium percentage (0-30%)
    /// @dev gameId => premiumPercent
    mapping(bytes32 => uint8) public gamePremiumPercentage;

    /// @notice Base query fee in wei (0.00416 BNB = ~$2.00 at $480/BNB)
    uint256 public queryFee;

    /// @notice Free trial limit (one-time, not daily)
    uint32 public constant FREE_TRIAL_LIMIT = 5;

    /// @notice Maximum developer premium percentage
    uint8 public constant MAX_PREMIUM_PERCENT = 30;

    /// @notice Revenue split percentages (basis points)
    uint16 public constant DEVELOPER_SHARE = 8000;  // 80%
    uint16 public constant PROTOCOL_SHARE = 1500;   // 15%
    uint16 public constant DISPUTER_SHARE = 500;    // 5%

    /// @notice Volume bonus tiers
    uint256 public constant TIER1_THRESHOLD = 10 ether;
    uint256 public constant TIER2_THRESHOLD = 50 ether;
    uint256 public constant TIER3_THRESHOLD = 100 ether;

    uint8 public constant TIER1_BONUS = 5;
    uint8 public constant TIER2_BONUS = 10;
    uint8 public constant TIER3_BONUS = 15;

    /// @notice Referral bonus percentages
    uint8 public constant REFEREE_BONUS = 20;  // 20% for new user
    uint8 public constant REFERRER_BONUS = 10; // 10% for referrer

    /// @notice Streak reward amounts
    uint128 public constant STREAK_7_REWARD = 0.01 ether;
    uint128 public constant STREAK_14_REWARD = 0.025 ether;
    uint128 public constant STREAK_30_REWARD = 0.05 ether;
    uint128 public constant STREAK_60_REWARD = 0.1 ether;
    uint128 public constant STREAK_90_REWARD = 0.2 ether;

    /// @notice Developer launch bonus
    uint256 public constant LAUNCH_BONUS_GAMES = 100;
    uint16 public constant LAUNCH_BONUS_SHARE = 9000; // 90%
    uint64 public constant LAUNCH_BONUS_DURATION = 90 days;

    /// @notice Lottery parameters
    uint16 public constant LOTTERY_CONTRIBUTION = 100;  // 1% of query fee
    uint16 public constant PRIZE_PERCENTAGE = 8000;     // 80% to winner
    uint16 public constant ROLLOVER_PERCENTAGE = 2000;  // 20% rollover

    /// @notice Contract references
    GameRegistry public gameRegistry;
    address public disputeResolver;
    address public oracleCore;

    /// @notice Balances and earnings
    mapping(address => ConsumerBalance) public consumerBalances;
    mapping(bytes32 => DeveloperEarnings) public developerEarnings;

    /// @notice Referral tracking
    mapping(address => ReferralData) public referralData;

    /// @notice Streak tracking
    mapping(address => StreakData) public userStreaks;

    /// @notice Lottery tracking
    uint64 public currentLotteryRound;
    uint64 public lastLotteryDraw;
    uint128 public lotteryPrizePool;
    uint128 public lotteryRollover;
    mapping(uint64 => address[]) public lotteryParticipants;
    mapping(uint64 => address) public lotteryWinners;
    mapping(address => LotteryTicket) public userLotteryTickets;

    /// @notice Launch bonus tracking
    mapping(bytes32 => bool) public isLaunchBonusGame;
    uint256 public launchBonusGamesCount;

    /// @notice Protocol balances
    uint128 public protocolBalance;
    uint128 public disputerPoolBalance;
    uint128 public marketingBudget;
    uint128 public streakRewardPool;

    /// @notice Counters
    uint256 public totalQueries;
    uint256 public totalRevenue;

    // ============ Events ============

    event BalanceDeposited(address indexed consumer, uint256 amount, uint256 bonusAmount, address referrer);
    event QueryFeeCharged(address indexed consumer, bytes32 indexed gameId, uint256 fee, bool usedFreeTier);
    event RevenueDistributed(bytes32 indexed gameId, uint256 devAmount, uint256 protocolAmount, uint256 disputerAmount);
    event EarningsWithdrawn(bytes32 indexed gameId, address indexed developer, uint256 amount);
    event ReferralBonusEarned(address indexed referrer, address indexed referee, uint256 referrerBonus, uint256 refereeBonus);
    event StreakUpdated(address indexed user, uint16 currentStreak, uint128 reward);
    event LotteryTicketIssued(address indexed user, uint64 round, uint32 ticketCount);
    event LotteryDrawn(uint64 indexed round, address indexed winner, uint256 prize, uint256 participants);
    event LaunchBonusActivated(bytes32 indexed gameId, uint256 gameNumber);
    event GamePremiumUpdated(bytes32 indexed gameId, uint8 premiumPercent);
    event TipReceived(bytes32 indexed gameId, address indexed tipper, uint256 amount);

    // ============ Initialize ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _gameRegistry,
        uint256 _queryFee
    ) public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        gameRegistry = GameRegistry(_gameRegistry);
        queryFee = _queryFee;
        lastLotteryDraw = uint64(block.timestamp);
    }

    // ============ External Functions ============

    /**
     * @notice Deposit BNB with optional referral code
     * @param referrer Address of referrer (address(0) if no referral)
     */
    function depositBalance(address referrer) external payable nonReentrant {
        if (msg.value == 0) revert InvalidAmount();

        ConsumerBalance storage balance = consumerBalances[msg.sender];
        ReferralData storage refData = referralData[msg.sender];

        // Calculate volume bonus
        uint8 tier = _calculateBonusTier(msg.value);
        uint8 volumeBonusPct = _getBonusPercentage(tier);
        uint128 volumeBonus = uint128((msg.value * volumeBonusPct) / 100);

        // Handle referral bonus (one-time)
        uint128 referralBonus = 0;
        if (referrer != address(0) && !refData.hasUsedReferral) {
            if (referrer == msg.sender) revert SelfReferral();

            // Referee gets 20% bonus
            uint128 cappedAmount = uint128(msg.value > 1 ether ? 1 ether : msg.value);
            referralBonus = (cappedAmount * REFEREE_BONUS) / 100;

            // Deduct from marketing budget
            if (marketingBudget < referralBonus) revert MarketingBudgetDepleted();
            marketingBudget -= referralBonus;

            // Referrer gets 10% bonus
            uint128 referrerBonus = (cappedAmount * REFERRER_BONUS) / 100;
            if (marketingBudget < referrerBonus) revert MarketingBudgetDepleted();
            marketingBudget -= referrerBonus;

            consumerBalances[referrer].bonusBalance += referrerBonus;
            referralData[referrer].referralCount++;
            referralData[referrer].earningsFromRefs += referrerBonus;

            refData.referrer = referrer;
            refData.hasUsedReferral = true;

            emit ReferralBonusEarned(referrer, msg.sender, referrerBonus, referralBonus);
        }

        // Update balance
        balance.realBalance += uint128(msg.value);
        balance.bonusBalance += volumeBonus + referralBonus;
        balance.bonusTier = tier;

        emit BalanceDeposited(msg.sender, msg.value, volumeBonus + referralBonus, referrer);
    }

    /**
     * @notice Charge query fee from consumer (once per consumer per match)
     * @param consumer The consumer address
     * @param gameId The game being queried
     * @param matchId The specific match identifier
     */
    function chargeQueryFee(address consumer, bytes32 gameId, bytes32 matchId) external nonReentrant {
        if (msg.sender != oracleCore && msg.sender != owner()) revert Unauthorized();

        // Check if this consumer already paid for this match
        if (hasPaidForMatch[consumer][matchId]) {
            // Already paid - return without charging
            emit QueryFeeCharged(consumer, gameId, 0, true);
            return;
        }

        ConsumerBalance storage balance = consumerBalances[consumer];

        // Try free trial first (lifetime limit, not daily)
        if (lifetimeTrialQueries[consumer] < FREE_TRIAL_LIMIT && !freeTrialUsed[consumer][matchId]) {
            lifetimeTrialQueries[consumer]++;
            balance.totalQueries++;
            totalQueries++;

            // Mark this match as used in free trial
            freeTrialUsed[consumer][matchId] = true;

            // Mark as paid for this match
            hasPaidForMatch[consumer][matchId] = true;

            // Update streak and lottery (even for free queries)
            _processQueryExtras(consumer, gameId);

            emit QueryFeeCharged(consumer, gameId, 0, true);
            return;
        }

        // Calculate final fee with premium
        uint256 finalFee = _calculateQueryFee(gameId);

        // Check balance (use bonus credits first)
        uint256 totalBalance = uint256(balance.realBalance) + uint256(balance.bonusBalance);
        if (totalBalance < finalFee) revert InsufficientBalance();

        // Deduct fee (bonus first, then real)
        _deductBalance(balance, finalFee);

        balance.totalQueries++;
        totalQueries++;
        totalRevenue += finalFee;

        // Mark as paid for this match
        hasPaidForMatch[consumer][matchId] = true;

        // Distribute revenue and process extras
        _distributeRevenue(gameId, finalFee);
        _processQueryExtras(consumer, gameId);

        emit QueryFeeCharged(consumer, gameId, finalFee, false);
    }

    /**
     * @notice Set game premium percentage (0-30%)
     * @param gameId The game identifier
     * @param premiumPercent Premium percentage (0-30)
     */
    function setGamePremium(bytes32 gameId, uint8 premiumPercent) external nonReentrant {
        GameRegistry.Game memory game = gameRegistry.getGame(gameId);
        if (game.developer == address(0)) revert GameNotRegistered();
        require(game.developer == msg.sender, "Not game developer");
        require(premiumPercent <= MAX_PREMIUM_PERCENT, "Premium too high");

        gamePremiumPercentage[gameId] = premiumPercent;
        emit GamePremiumUpdated(gameId, premiumPercent);
    }

    /**
     * @notice Tip a game developer (100% goes to developer)
     * @param gameId The game to tip
     */
    function tipGameProvider(bytes32 gameId) external payable nonReentrant {
        GameRegistry.Game memory game = gameRegistry.getGame(gameId);
        if (game.developer == address(0)) revert GameNotRegistered();
        if (msg.value == 0) revert InvalidAmount();

        DeveloperEarnings storage earnings = developerEarnings[gameId];
        earnings.totalEarned += uint128(msg.value);
        earnings.pendingEarnings += uint128(msg.value);

        emit TipReceived(gameId, msg.sender, msg.value);
    }

    /**
     * @notice Withdraw developer earnings
     * @param gameId The game identifier
     */
    function withdrawEarnings(bytes32 gameId) external nonReentrant {
        GameRegistry.Game memory game = gameRegistry.getGame(gameId);
        if (game.developer == address(0)) revert GameNotRegistered();
        require(game.developer == msg.sender, "Not game developer");

        DeveloperEarnings storage earnings = developerEarnings[gameId];
        if (earnings.pendingEarnings == 0) revert NoEarningsToWithdraw();

        uint128 amount = earnings.pendingEarnings;
        earnings.pendingEarnings = 0;
        earnings.lastWithdrawTime = uint64(block.timestamp);

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit EarningsWithdrawn(gameId, msg.sender, amount);
    }

    /**
     * @notice Draw lottery (can be called by anyone after 7 days)
     */
    function drawLottery() external nonReentrant {
        require(block.timestamp >= lastLotteryDraw + 7 days, "Too early");
        _drawLottery();
    }

    /**
     * @notice Track game registration for launch bonus
     * @param gameId The registered game ID
     */
    function trackGameRegistration(bytes32 gameId) external {
        if (msg.sender != address(gameRegistry)) revert Unauthorized();

        if (launchBonusGamesCount < LAUNCH_BONUS_GAMES) {
            isLaunchBonusGame[gameId] = true;
            launchBonusGamesCount++;

            emit LaunchBonusActivated(gameId, launchBonusGamesCount);
        }
    }

    // ============ Admin Functions ============

    function fundMarketingBudget() external payable onlyOwner {
        marketingBudget += uint128(msg.value);
    }

    function fundStreakRewardPool() external payable onlyOwner {
        streakRewardPool += uint128(msg.value);
    }

    function updateQueryFee(uint256 newFee) external onlyOwner {
        queryFee = newFee;
    }

    function updateOracleCore(address _oracleCore) external onlyOwner {
        oracleCore = _oracleCore;
    }

    function updateDisputeResolver(address _disputeResolver) external onlyOwner {
        disputeResolver = _disputeResolver;
    }

    function withdrawProtocolBalance(address recipient, uint256 amount) external onlyOwner nonReentrant {
        require(amount <= protocolBalance, "Insufficient balance");
        protocolBalance -= uint128(amount);

        (bool success, ) = payable(recipient).call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    // ============ View Functions ============

    function getTotalBalance(address user) external view returns (uint256) {
        ConsumerBalance memory balance = consumerBalances[user];
        return uint256(balance.realBalance) + uint256(balance.bonusBalance);
    }

    function getStreakInfo(address user) external view returns (
        uint16 currentStreak,
        uint16 longestStreak,
        uint128 totalRewards
    ) {
        StreakData memory streak = userStreaks[user];
        return (streak.currentStreak, streak.longestStreak, streak.totalRewards);
    }

    function getReferralInfo(address user) external view returns (
        address referrer,
        uint32 referralCount,
        uint128 earnings
    ) {
        ReferralData memory refData = referralData[user];
        return (refData.referrer, refData.referralCount, refData.earningsFromRefs);
    }

    function getCurrentLotteryInfo() external view returns (
        uint64 roundId,
        uint128 prizePool,
        uint256 participants
    ) {
        return (
            currentLotteryRound,
            lotteryPrizePool + lotteryRollover,
            lotteryParticipants[currentLotteryRound].length
        );
    }

    function getQueryFee(bytes32 gameId) external view returns (uint256) {
        return _calculateQueryFee(gameId);
    }

    function getGamePremium(bytes32 gameId) external view returns (uint8) {
        return gamePremiumPercentage[gameId];
    }

    // ============ Internal Functions ============

    function _distributeRevenue(bytes32 gameId, uint256 amount) internal {
        GameRegistry.Game memory game = gameRegistry.getGame(gameId);

        // Check for launch bonus
        uint16 devShare = DEVELOPER_SHARE;
        uint16 protocolShare = PROTOCOL_SHARE;

        if (isLaunchBonusGame[gameId] && block.timestamp < game.registeredAt + LAUNCH_BONUS_DURATION) {
            devShare = LAUNCH_BONUS_SHARE; // 90%
            protocolShare = 750; // 7.5%
        }

        uint128 devAmount = uint128((amount * devShare) / 10000);
        uint128 protocolAmount = uint128((amount * protocolShare) / 10000);
        uint128 disputerAmount = uint128(amount) - devAmount - protocolAmount;

        // Update balances
        DeveloperEarnings storage earnings = developerEarnings[gameId];
        earnings.totalEarned += devAmount;
        earnings.pendingEarnings += devAmount;
        earnings.totalQueries++;

        protocolBalance += protocolAmount;
        disputerPoolBalance += disputerAmount;

        emit RevenueDistributed(gameId, devAmount, protocolAmount, disputerAmount);
    }

    function _processQueryExtras(address consumer, bytes32 /*gameId*/) internal {
        _updateStreak(consumer);
        _addLotteryTicket(consumer);
    }

    function _updateStreak(address user) internal {
        StreakData storage streak = userStreaks[user];
        uint64 today = uint64(block.timestamp / 1 days);

        if (today == streak.lastActiveDay) return;

        if (today == streak.lastActiveDay + 1) {
            streak.currentStreak++;
        } else {
            streak.currentStreak = 1;
        }

        streak.lastActiveDay = today;

        if (streak.currentStreak > streak.longestStreak) {
            streak.longestStreak = streak.currentStreak;
        }

        // Check for rewards
        uint128 reward = _getStreakReward(streak.currentStreak);
        if (reward > 0 && streakRewardPool >= reward) {
            streakRewardPool -= reward;
            consumerBalances[user].bonusBalance += reward;
            streak.totalRewards += reward;

            emit StreakUpdated(user, streak.currentStreak, reward);
        }
    }

    function _getStreakReward(uint16 streakDays) internal pure returns (uint128) {
        if (streakDays == 7) return STREAK_7_REWARD;
        if (streakDays == 14) return STREAK_14_REWARD;
        if (streakDays == 30) return STREAK_30_REWARD;
        if (streakDays == 60) return STREAK_60_REWARD;
        if (streakDays == 90) return STREAK_90_REWARD;
        return 0;
    }

    function _addLotteryTicket(address consumer) internal {
        uint128 contribution = uint128((queryFee * LOTTERY_CONTRIBUTION) / 10000);
        lotteryPrizePool += contribution;

        lotteryParticipants[currentLotteryRound].push(consumer);
        userLotteryTickets[consumer] = LotteryTicket({
            roundId: currentLotteryRound,
            ticketCount: uint32(lotteryParticipants[currentLotteryRound].length)
        });

        emit LotteryTicketIssued(consumer, currentLotteryRound, userLotteryTickets[consumer].ticketCount);

        if (block.timestamp >= lastLotteryDraw + 7 days) {
            _drawLottery();
        }
    }

    function _drawLottery() internal {
        address[] memory participants = lotteryParticipants[currentLotteryRound];

        if (participants.length == 0) {
            lotteryRollover += lotteryPrizePool;
            lotteryPrizePool = 0;
            currentLotteryRound++;
            lastLotteryDraw = uint64(block.timestamp);
            return;
        }

        uint128 totalPrize = lotteryPrizePool + lotteryRollover;
        uint128 prize = (totalPrize * PRIZE_PERCENTAGE) / 10000;
        uint128 newRollover = totalPrize - prize;

        // Random winner
        uint256 randomIndex = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            participants.length
        ))) % participants.length;

        address winner = participants[randomIndex];
        lotteryWinners[currentLotteryRound] = winner;

        // Transfer prize
        (bool success, ) = payable(winner).call{value: prize}("");
        require(success, "Prize transfer failed");

        emit LotteryDrawn(currentLotteryRound, winner, prize, participants.length);

        // Reset for next round
        lotteryPrizePool = 0;
        lotteryRollover = newRollover;
        currentLotteryRound++;
        lastLotteryDraw = uint64(block.timestamp);
    }

    function _calculateQueryFee(bytes32 gameId) internal view returns (uint256) {
        uint8 premium = gamePremiumPercentage[gameId];
        if (premium == 0) return queryFee;

        // Calculate with premium (e.g., 20% = queryFee * 120 / 100)
        return (queryFee * (100 + premium)) / 100;
    }

    function _deductBalance(ConsumerBalance storage balance, uint256 fee) internal {
        if (balance.bonusBalance >= fee) {
            balance.bonusBalance -= uint128(fee);
        } else if (balance.bonusBalance > 0) {
            uint128 remaining = uint128(fee) - balance.bonusBalance;
            balance.bonusBalance = 0;
            balance.realBalance -= remaining;
        } else {
            balance.realBalance -= uint128(fee);
        }
    }

    function _calculateBonusTier(uint256 amount) internal pure returns (uint8) {
        if (amount >= TIER3_THRESHOLD) return 3;
        if (amount >= TIER2_THRESHOLD) return 2;
        if (amount >= TIER1_THRESHOLD) return 1;
        return 0;
    }

    function _getBonusPercentage(uint8 tier) internal pure returns (uint8) {
        if (tier == 3) return TIER3_BONUS;
        if (tier == 2) return TIER2_BONUS;
        if (tier == 1) return TIER1_BONUS;
        return 0;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    receive() external payable {}
}
