// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./GameRegistry.sol";

/**
 * @title FeeManager
 * @notice Manages prepaid balances, query fees, volume bonuses, and revenue distribution
 * @dev Implements 80/15/5 revenue split: developers, protocol, disputers
 */
contract FeeManager is OwnableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    // ============ Errors ============

    error InsufficientBalance();
    error InsufficientAllowance();
    error InvalidAmount();
    error GameNotRegistered();
    error NoEarningsToWithdraw();
    error TransferFailed();
    error FreeTierExceeded();

    // ============ Structs ============

    struct ConsumerBalance {
        uint256 depositedAmount; // Original deposit in BNB
        uint256 creditAmount; // Credits available (includes bonus)
        uint256 queriesUsed;
        uint64 lastResetTime; // For free tier daily reset
        uint32 freeQueriesUsed; // Free queries used today
        uint8 bonusTier; // 0 = no bonus, 1 = 5%, 2 = 10%, 3 = 15%
    }

    struct DeveloperEarnings {
        uint256 totalEarned;
        uint256 withdrawn;
        uint256 pendingEarnings;
        uint256 totalQueries;
    }

    // ============ State Variables ============

    /// @notice Base query fee in wei (e.g., 0.003 BNB = $1.80 at $600/BNB)
    uint256 public queryFee;

    /// @notice Free tier queries per day per consumer
    uint32 public constant FREE_TIER_DAILY_LIMIT = 50;

    /// @notice Revenue split percentages (basis points: 10000 = 100%)
    uint16 public constant DEVELOPER_SHARE = 8000; // 80%
    uint16 public constant PROTOCOL_SHARE = 1500;  // 15%
    uint16 public constant DISPUTER_SHARE = 500;   // 5%

    /// @notice Volume bonus thresholds and percentages
    uint256 public constant TIER1_THRESHOLD = 10 ether;   // 10 BNB
    uint256 public constant TIER2_THRESHOLD = 50 ether;   // 50 BNB
    uint256 public constant TIER3_THRESHOLD = 100 ether;  // 100 BNB

    uint8 public constant TIER1_BONUS = 5;   // 5% bonus
    uint8 public constant TIER2_BONUS = 10;  // 10% bonus
    uint8 public constant TIER3_BONUS = 15;  // 15% bonus

    /// @notice Reference to GameRegistry
    GameRegistry public gameRegistry;

    /// @notice Consumer prepaid balances
    mapping(address => ConsumerBalance) public consumerBalances;

    /// @notice Developer earnings by gameId
    mapping(bytes32 => DeveloperEarnings) public developerEarnings;

    /// @notice Protocol treasury balance
    uint256 public protocolBalance;

    /// @notice Disputer pool balance
    uint256 public disputerPoolBalance;

    /// @notice Total queries processed
    uint256 public totalQueries;

    /// @notice Total revenue generated
    uint256 public totalRevenue;

    // ============ Events ============

    event BalanceDeposited(
        address indexed consumer,
        uint256 depositAmount,
        uint256 creditAmount,
        uint8 bonusTier
    );

    event QueryFeeCharged(
        address indexed consumer,
        bytes32 indexed gameId,
        uint256 fee,
        bool usedFreeTier
    );

    event RevenueDistributed(
        bytes32 indexed gameId,
        uint256 developerAmount,
        uint256 protocolAmount,
        uint256 disputerAmount
    );

    event EarningsWithdrawn(
        bytes32 indexed gameId,
        address indexed developer,
        uint256 amount
    );

    event ProtocolBalanceWithdrawn(
        address indexed recipient,
        uint256 amount
    );

    event DisputerRewardPaid(
        address indexed disputer,
        uint256 amount
    );

    event FreeTierReset(
        address indexed consumer,
        uint64 resetTime
    );

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
        queryFee = _queryFee; // e.g., 0.003 ether for ~$1.80
    }

    // ============ External Functions ============

    /**
     * @notice Deposit BNB to prepaid balance with volume bonus
     */
    function depositBalance() external payable nonReentrant {
        if (msg.value == 0) revert InvalidAmount();

        ConsumerBalance storage balance = consumerBalances[msg.sender];

        // Determine bonus tier based on deposit amount
        uint8 bonusTier = _calculateBonusTier(msg.value);
        uint8 bonusPercentage = _getBonusPercentage(bonusTier);

        // Calculate credit amount with bonus
        uint256 bonusAmount = (msg.value * bonusPercentage) / 100;
        uint256 creditAmount = msg.value + bonusAmount;

        // Update balance
        balance.depositedAmount += msg.value;
        balance.creditAmount += creditAmount;
        balance.bonusTier = bonusTier;

        emit BalanceDeposited(msg.sender, msg.value, creditAmount, bonusTier);
    }

    /**
     * @notice Charge query fee from consumer balance or free tier
     * @param consumer The consumer address
     * @param gameId The game being queried
     */
    function chargeQueryFee(address consumer, bytes32 gameId) external nonReentrant {
        // Reset free tier if new day
        _resetFreeTierIfNeeded(consumer);

        ConsumerBalance storage balance = consumerBalances[consumer];

        // Try to use free tier first
        if (balance.freeQueriesUsed < FREE_TIER_DAILY_LIMIT) {
            balance.freeQueriesUsed++;
            balance.queriesUsed++;
            totalQueries++;

            emit QueryFeeCharged(consumer, gameId, 0, true);
            return;
        }

        // Check prepaid balance
        if (balance.creditAmount < queryFee) revert InsufficientBalance();

        // Deduct from balance
        balance.creditAmount -= queryFee;
        balance.queriesUsed++;
        totalQueries++;
        totalRevenue += queryFee;

        // Distribute revenue
        _distributeRevenue(gameId, queryFee);

        emit QueryFeeCharged(consumer, gameId, queryFee, false);
    }

    /**
     * @notice Withdraw developer earnings for a game
     * @param gameId The game identifier
     */
    function withdrawEarnings(bytes32 gameId) external nonReentrant {
        GameRegistry.Game memory game = gameRegistry.getGame(gameId);
        if (game.developer == address(0)) revert GameNotRegistered();
        require(game.developer == msg.sender, "Not game developer");

        DeveloperEarnings storage earnings = developerEarnings[gameId];
        if (earnings.pendingEarnings == 0) revert NoEarningsToWithdraw();

        uint256 amount = earnings.pendingEarnings;
        earnings.pendingEarnings = 0;
        earnings.withdrawn += amount;

        // Transfer earnings
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit EarningsWithdrawn(gameId, msg.sender, amount);
    }

    /**
     * @notice Withdraw protocol balance (owner only)
     * @param recipient Address to receive funds
     * @param amount Amount to withdraw
     */
    function withdrawProtocolBalance(address recipient, uint256 amount)
        external
        onlyOwner
        nonReentrant
    {
        require(amount <= protocolBalance, "Insufficient protocol balance");

        protocolBalance -= amount;

        (bool success, ) = payable(recipient).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit ProtocolBalanceWithdrawn(recipient, amount);
    }

    /**
     * @notice Pay disputer reward from pool
     * @param disputer Address of disputer to reward
     * @param amount Reward amount
     */
    function payDisputerReward(address disputer, uint256 amount)
        external
        onlyOwner
        nonReentrant
    {
        require(amount <= disputerPoolBalance, "Insufficient disputer pool");

        disputerPoolBalance -= amount;

        (bool success, ) = payable(disputer).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit DisputerRewardPaid(disputer, amount);
    }

    // ============ View Functions ============

    /**
     * @notice Get consumer balance details
     * @param consumer The consumer address
     */
    function getConsumerBalance(address consumer)
        external
        view
        returns (ConsumerBalance memory)
    {
        return consumerBalances[consumer];
    }

    /**
     * @notice Get developer earnings details
     * @param gameId The game identifier
     */
    function getDeveloperEarnings(bytes32 gameId)
        external
        view
        returns (DeveloperEarnings memory)
    {
        return developerEarnings[gameId];
    }

    /**
     * @notice Calculate how many queries a consumer can make
     * @param consumer The consumer address
     * @return Total queries available (free tier + prepaid)
     */
    function getAvailableQueries(address consumer) external view returns (uint256) {
        ConsumerBalance memory balance = consumerBalances[consumer];

        uint256 freeQueries = _getFreeQueriesRemaining(consumer);
        uint256 paidQueries = balance.creditAmount / queryFee;

        return freeQueries + paidQueries;
    }

    /**
     * @notice Calculate expected revenue split for a query
     * @param amount Query fee amount
     * @return developerAmount Amount going to developer
     * @return protocolAmount Amount going to protocol
     * @return disputerAmount Amount going to disputer pool
     */
    function calculateRevenueSplit(uint256 amount)
        public
        pure
        returns (uint256 developerAmount, uint256 protocolAmount, uint256 disputerAmount)
    {
        developerAmount = (amount * DEVELOPER_SHARE) / 10000;
        protocolAmount = (amount * PROTOCOL_SHARE) / 10000;
        disputerAmount = (amount * DISPUTER_SHARE) / 10000;
    }

    // ============ Admin Functions ============

    /**
     * @notice Update query fee
     * @param newFee New query fee in wei
     */
    function updateQueryFee(uint256 newFee) external onlyOwner {
        queryFee = newFee;
    }

    /**
     * @notice Update GameRegistry address
     * @param _gameRegistry New GameRegistry address
     */
    function updateGameRegistry(address _gameRegistry) external onlyOwner {
        gameRegistry = GameRegistry(_gameRegistry);
    }

    // ============ Internal Functions ============

    /**
     * @notice Distribute revenue according to 80/15/5 split
     */
    function _distributeRevenue(bytes32 gameId, uint256 amount) internal {
        (uint256 devAmount, uint256 protocolAmount, uint256 disputerAmount) =
            calculateRevenueSplit(amount);

        // Update developer earnings
        DeveloperEarnings storage earnings = developerEarnings[gameId];
        earnings.totalEarned += devAmount;
        earnings.pendingEarnings += devAmount;
        earnings.totalQueries++;

        // Update protocol balance
        protocolBalance += protocolAmount;

        // Update disputer pool
        disputerPoolBalance += disputerAmount;

        emit RevenueDistributed(gameId, devAmount, protocolAmount, disputerAmount);
    }

    /**
     * @notice Calculate bonus tier based on deposit amount
     */
    function _calculateBonusTier(uint256 amount) internal pure returns (uint8) {
        if (amount >= TIER3_THRESHOLD) return 3;
        if (amount >= TIER2_THRESHOLD) return 2;
        if (amount >= TIER1_THRESHOLD) return 1;
        return 0;
    }

    /**
     * @notice Get bonus percentage for a tier
     */
    function _getBonusPercentage(uint8 tier) internal pure returns (uint8) {
        if (tier == 3) return TIER3_BONUS;
        if (tier == 2) return TIER2_BONUS;
        if (tier == 1) return TIER1_BONUS;
        return 0;
    }

    /**
     * @notice Reset free tier if 24 hours have passed
     */
    function _resetFreeTierIfNeeded(address consumer) internal {
        ConsumerBalance storage balance = consumerBalances[consumer];

        // Check if it's a new day (24 hours since last reset)
        if (block.timestamp >= balance.lastResetTime + 1 days) {
            balance.freeQueriesUsed = 0;
            balance.lastResetTime = uint64(block.timestamp);

            emit FreeTierReset(consumer, uint64(block.timestamp));
        }
    }

    /**
     * @notice Get remaining free queries for today
     */
    function _getFreeQueriesRemaining(address consumer) internal view returns (uint256) {
        ConsumerBalance memory balance = consumerBalances[consumer];

        // Check if free tier needs reset
        if (block.timestamp >= balance.lastResetTime + 1 days) {
            return FREE_TIER_DAILY_LIMIT;
        }

        if (balance.freeQueriesUsed >= FREE_TIER_DAILY_LIMIT) {
            return 0;
        }

        return FREE_TIER_DAILY_LIMIT - balance.freeQueriesUsed;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ============ Receive Function ============

    receive() external payable {
        // Allow contract to receive BNB
    }
}
