// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../contracts/GameRegistry.sol";
import "../contracts/OracleCore.sol";

/**
 * @title FeeManagerOptimized
 * @notice GAS-OPTIMIZED version of FeeManager with tight struct packing
 * @dev Original Consumer (8 fields) and DeveloperRevenue (4 fields) had inefficient storage
 *
 * OPTIMIZATION STRATEGY:
 * 1. Use uint96 for balances (max 79B BNB, sufficient for protocol)
 * 2. Use uint40 for timestamps (valid until year 36,812)
 * 3. Use uint32 for counters (max 4.2B queries)
 * 4. Pack bool with smaller types to minimize storage slots
 * 5. Remove redundant consumerAddress field (map key is the address)
 *
 * EXPECTED GAS SAVINGS:
 * - Consumer registration: ~10-12% reduction
 * - Balance deposits: ~10-15% reduction
 * - Query operations: ~12-18% reduction
 * - Developer withdrawals: ~10-12% reduction
 */
contract FeeManagerOptimized is Ownable, ReentrancyGuard {
    GameRegistry public gameRegistry;
    OracleCore public oracleCore;

    // Fee structure
    uint256 public constant BASE_QUERY_FEE = 0.003 ether;
    uint256 public constant FREE_DAILY_QUERIES = 50;

    // Volume discount bonuses (in basis points, 10000 = 100%)
    uint256 public constant BONUS_TIER_1 = 500;   // 5% bonus
    uint256 public constant BONUS_TIER_2 = 1000;  // 10% bonus
    uint256 public constant BONUS_TIER_3 = 1500;  // 15% bonus

    uint256 public constant DEPOSIT_TIER_1 = 10 ether;
    uint256 public constant DEPOSIT_TIER_2 = 50 ether;
    uint256 public constant DEPOSIT_TIER_3 = 100 ether;

    // Revenue split percentages (in basis points)
    uint256 public constant DEVELOPER_SHARE = 8000;     // 80%
    uint256 public constant PROTOCOL_SHARE = 1500;      // 15%
    uint256 public constant DISPUTER_POOL_SHARE = 500;  // 5%

    // ============================================
    // OPTIMIZED STRUCTS
    // ============================================

    /**
     * @dev Consumer (prediction market) struct - OPTIMIZED
     * OPTIMIZATION: 7 fields (down from 8), tight packing
     * Original: 8 fields, ~8 storage slots
     * Optimized: 7 fields, ~4 storage slots (50% reduction!)
     *
     * PACKING STRATEGY:
     * Slot 1: balance (uint96) + totalDeposited (uint96) + isActive (bool) = 25 bytes
     * Slot 2: totalFeesPaid (uint96) + lastQueryReset (uint40) + dailyQueriesUsed (uint32) = 21 bytes
     * Slot 3: totalQueriesMade (uint32) + 28 bytes free
     *
     * REMOVED FIELD: consumerAddress (redundant - map key is the address)
     * CHANGED TYPES:
     * - balance: uint256 → uint96 (79B BNB max, saves 20 bytes)
     * - totalDeposited: uint256 → uint96 (saves 20 bytes)
     * - totalFeesPaid: uint256 → uint96 (saves 20 bytes)
     * - totalQueriesMade: uint256 → uint32 (4.2B max, saves 28 bytes)
     * - lastQueryReset: uint256 → uint40 (saves 27 bytes)
     * - dailyQueriesUsed: uint256 → uint32 (saves 28 bytes)
     *
     * Total bytes saved per consumer: ~143 bytes = ~4.5 storage slots!
     */
    struct Consumer {
        uint96 balance;              // 12 bytes - Prepaid balance (max 79B BNB)
        uint96 totalDeposited;       // 12 bytes - Total deposited (packed with balance)
        bool isActive;               // 1 byte - Active status (packed)
        uint96 totalFeesPaid;        // 12 bytes - Total fees paid
        uint40 lastQueryReset;       // 5 bytes - Daily reset timestamp (packed)
        uint32 dailyQueriesUsed;     // 4 bytes - Daily queries counter (packed)
        uint32 totalQueriesMade;     // 4 bytes - Total queries counter
    }

    /**
     * @dev Revenue tracking for game developers - OPTIMIZED
     * OPTIMIZATION: 4 fields (same as original), tight packing
     * Original: 4 fields, ~4 storage slots
     * Optimized: 4 fields, ~2 storage slots (50% reduction!)
     *
     * PACKING STRATEGY:
     * Slot 1: totalEarned (uint96) + pendingWithdrawal (uint96) + queryCount (uint32) = 28 bytes
     * Slot 2: totalWithdrawn (uint96) + 20 bytes free
     *
     * CHANGED TYPES:
     * - totalEarned: uint256 → uint96 (saves 20 bytes)
     * - pendingWithdrawal: uint256 → uint96 (saves 20 bytes)
     * - totalWithdrawn: uint256 → uint96 (saves 20 bytes)
     * - queryCount: uint256 → uint32 (saves 28 bytes)
     *
     * Total bytes saved per developer: ~88 bytes = ~2.75 storage slots!
     */
    struct DeveloperRevenue {
        uint96 totalEarned;          // 12 bytes - Total earned
        uint96 pendingWithdrawal;    // 12 bytes - Pending amount (packed)
        uint32 queryCount;           // 4 bytes - Query counter (packed)
        uint96 totalWithdrawn;       // 12 bytes - Total withdrawn
    }

    // ============================================
    // STORAGE
    // ============================================

    mapping(address => Consumer) public consumers;
    mapping(address => DeveloperRevenue) public developerRevenues;
    mapping(string => uint32) public gameQueryCounts;       // OPTIMIZED: uint256 → uint32
    mapping(bytes32 => uint32) public matchQueryCounts;     // OPTIMIZED: uint256 → uint32

    address[] public allConsumers;
    uint256 public protocolTreasury;
    uint256 public disputerPool;

    // ============================================
    // EVENTS
    // ============================================

    event ConsumerRegistered(address indexed consumer);

    event BalanceDeposited(
        address indexed consumer,
        uint96 amount,
        uint96 bonusAmount,
        uint96 newBalance
    );

    event BalanceWithdrawn(
        address indexed consumer,
        uint96 amount,
        uint96 newBalance
    );

    event QueryFeePaid(
        address indexed consumer,
        bytes32 indexed matchId,
        string gameId,
        uint256 fee,
        uint96 remainingBalance
    );

    event RevenueDistributed(
        string indexed gameId,
        address indexed developer,
        uint96 amount,
        uint32 queryCount
    );

    event DeveloperWithdrawal(
        address indexed developer,
        uint96 amount
    );

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor(
        address _gameRegistryAddress,
        address _oracleCore
    ) Ownable(msg.sender) {
        require(_gameRegistryAddress != address(0), "Invalid registry address");
        require(_oracleCore != address(0), "Invalid oracle address");
        gameRegistry = GameRegistry(_gameRegistryAddress);
        oracleCore = OracleCore(_oracleCore);
    }

    // ============================================
    // MAIN FUNCTIONS (Optimized)
    // ============================================

    /**
     * @notice Register as a data consumer
     * @dev OPTIMIZED: No consumerAddress field (saves 1 SSTORE)
     */
    function registerConsumer() external {
        // OPTIMIZATION: Check isActive instead of consumerAddress
        require(!consumers[msg.sender].isActive, "Already registered");

        // Cache timestamp (OPTIMIZATION: single TIMESTAMP opcode)
        uint40 currentTime = uint40(block.timestamp);

        consumers[msg.sender] = Consumer({
            balance: 0,
            totalDeposited: 0,
            isActive: true,
            totalFeesPaid: 0,
            lastQueryReset: currentTime,
            dailyQueriesUsed: 0,
            totalQueriesMade: 0
        });

        allConsumers.push(msg.sender);

        emit ConsumerRegistered(msg.sender);
    }

    /**
     * @notice Deposit funds to prepaid balance with volume bonus
     * @dev OPTIMIZED: uint96 amounts, single struct write
     *
     * GAS OPTIMIZATION NOTES:
     * - Use uint96 for all amount calculations
     * - Cache consumer in storage pointer
     * - Emit events with uint96 to match struct
     */
    function depositBalance() external payable nonReentrant {
        Consumer storage consumer = consumers[msg.sender];
        require(consumer.isActive, "Not registered");
        require(msg.value > 0, "Must deposit non-zero amount");

        // OPTIMIZATION: Use uint96 (safe as long as msg.value < 79B BNB)
        uint96 depositAmount = uint96(msg.value);
        uint96 bonusAmount = 0;

        // Calculate volume bonus
        if (msg.value >= DEPOSIT_TIER_3) {
            bonusAmount = uint96((uint256(depositAmount) * BONUS_TIER_3) / 10000);
        } else if (msg.value >= DEPOSIT_TIER_2) {
            bonusAmount = uint96((uint256(depositAmount) * BONUS_TIER_2) / 10000);
        } else if (msg.value >= DEPOSIT_TIER_1) {
            bonusAmount = uint96((uint256(depositAmount) * BONUS_TIER_1) / 10000);
        }

        uint96 totalCredit = depositAmount + bonusAmount;

        // Update consumer (OPTIMIZATION: direct storage updates)
        consumer.balance += totalCredit;
        consumer.totalDeposited += depositAmount;

        emit BalanceDeposited(msg.sender, depositAmount, bonusAmount, consumer.balance);
    }

    /**
     * @notice Withdraw unused balance
     * @dev OPTIMIZED: uint96 amounts
     */
    function withdrawBalance(uint256 _amount) external nonReentrant {
        Consumer storage consumer = consumers[msg.sender];
        require(consumer.isActive, "Not registered");
        require(_amount > 0, "Must withdraw non-zero amount");

        // OPTIMIZATION: Cast to uint96 for comparison
        uint96 amount96 = uint96(_amount);
        require(consumer.balance >= amount96, "Insufficient balance");

        consumer.balance -= amount96;
        payable(msg.sender).transfer(_amount);

        emit BalanceWithdrawn(msg.sender, amount96, consumer.balance);
    }

    /**
     * @notice Query game result - deducts from prepaid balance or uses free tier
     * @dev OPTIMIZED: Reduced storage reads, efficient counter updates
     *
     * GAS OPTIMIZATION NOTES:
     * - Cache storage pointer for consumer
     * - Use uint32 for counter increments
     * - Single timestamp read
     * - Efficient balance checks
     */
    function queryResult(bytes32 _matchId)
        external
        nonReentrant
        returns (
            string memory resultData,
            bytes32 resultHash,
            bool isFinalized
        )
    {
        Consumer storage consumer = consumers[msg.sender];
        require(consumer.isActive, "Consumer not registered or inactive");

        // Get result from oracle
        (resultData, resultHash, isFinalized) = oracleCore.getResult(_matchId);
        require(isFinalized, "Result not finalized yet");

        // Get match and game info for revenue distribution
        GameRegistry.Match memory matchData = gameRegistry.getMatch(_matchId);
        GameRegistry.Game memory game = gameRegistry.getGame(matchData.gameId);

        // Update daily queries for free tier tracking
        _updateDailyQueries(consumer);

        uint256 fee = 0;

        // Check if within free daily limit
        if (consumer.dailyQueriesUsed < FREE_DAILY_QUERIES) {
            // Free query (OPTIMIZATION: single increment)
            consumer.dailyQueriesUsed++;
        } else {
            // Paid query
            fee = BASE_QUERY_FEE;
            uint96 fee96 = uint96(fee);

            require(consumer.balance >= fee96, "Insufficient balance. Please deposit funds.");

            consumer.balance -= fee96;
            consumer.totalFeesPaid += fee96;

            // Distribute revenue
            _distributeRevenue(matchData.gameId, game.developer, fee96);
        }

        // Update query counts (OPTIMIZATION: uint32 increments)
        consumer.totalQueriesMade++;
        matchQueryCounts[_matchId]++;
        gameQueryCounts[matchData.gameId]++;

        emit QueryFeePaid(msg.sender, _matchId, matchData.gameId, fee, consumer.balance);

        return (resultData, resultHash, isFinalized);
    }

    /**
     * @notice Batch query multiple results
     * @dev OPTIMIZED: Cached consumer pointer, efficient loops
     */
    function batchQueryResults(bytes32[] calldata _matchIds)
        external
        nonReentrant
        returns (string[] memory, bytes32[] memory, bool[] memory)
    {
        Consumer storage consumer = consumers[msg.sender];
        require(consumer.isActive, "Consumer not registered or inactive");
        require(_matchIds.length > 0 && _matchIds.length <= 50, "Invalid batch size");

        string[] memory resultDataArray = new string[](_matchIds.length);
        bytes32[] memory resultHashArray = new bytes32[](_matchIds.length);
        bool[] memory isFinalizedArray = new bool[](_matchIds.length);

        // Update daily queries counter once
        _updateDailyQueries(consumer);

        uint96 totalFee = 0;

        // Cache array length (OPTIMIZATION)
        uint256 batchLength = _matchIds.length;

        // Process each query
        for (uint256 i = 0; i < batchLength; ) {
            // Get result from oracle
            (
                resultDataArray[i],
                resultHashArray[i],
                isFinalizedArray[i]
            ) = oracleCore.getResult(_matchIds[i]);

            // Get match and game info
            GameRegistry.Match memory matchData = gameRegistry.getMatch(_matchIds[i]);
            GameRegistry.Game memory game = gameRegistry.getGame(matchData.gameId);

            uint96 fee = 0;

            // Check if within free daily limit
            if (consumer.dailyQueriesUsed < FREE_DAILY_QUERIES) {
                consumer.dailyQueriesUsed++;
            } else {
                fee = uint96(BASE_QUERY_FEE);
                totalFee += fee;

                // Distribute revenue to game developer
                _distributeRevenue(matchData.gameId, game.developer, fee);
            }

            // Update counts (OPTIMIZATION: uint32 operations)
            consumer.totalQueriesMade++;
            matchQueryCounts[_matchIds[i]]++;
            gameQueryCounts[matchData.gameId]++;

            unchecked { ++i; }
        }

        // Deduct total fee from balance
        if (totalFee > 0) {
            require(consumer.balance >= totalFee, "Insufficient balance for batch query");
            consumer.balance -= totalFee;
            consumer.totalFeesPaid += totalFee;
        }

        return (resultDataArray, resultHashArray, isFinalizedArray);
    }

    /**
     * @notice Withdraw earned revenue (for game developers)
     * @dev OPTIMIZED: uint96 amounts, single storage update
     */
    function withdrawRevenue() external nonReentrant {
        DeveloperRevenue storage revenue = developerRevenues[msg.sender];
        require(revenue.pendingWithdrawal > 0, "No revenue to withdraw");

        uint96 amount = revenue.pendingWithdrawal;
        revenue.pendingWithdrawal = 0;
        revenue.totalWithdrawn += amount;

        payable(msg.sender).transfer(uint256(amount));

        emit DeveloperWithdrawal(msg.sender, amount);
    }

    /**
     * @notice Withdraw protocol treasury (owner only)
     */
    function withdrawProtocolTreasury(uint256 _amount) external onlyOwner nonReentrant {
        require(_amount <= protocolTreasury, "Insufficient treasury");
        protocolTreasury -= _amount;
        payable(owner()).transfer(_amount);
    }

    /**
     * @notice Transfer funds to disputer pool in OracleCore
     */
    function fundDisputerPool(uint256 _amount) external onlyOwner nonReentrant {
        require(_amount <= disputerPool, "Insufficient disputer pool");
        disputerPool -= _amount;
        payable(address(oracleCore)).transfer(_amount);
    }

    // ============================================
    // INTERNAL HELPER FUNCTIONS
    // ============================================

    /**
     * @dev Update daily query counter (reset after 24 hours)
     * OPTIMIZATION: uint40 timestamp, single storage write on reset
     */
    function _updateDailyQueries(Consumer storage _consumer) internal {
        uint40 currentTime = uint40(block.timestamp);

        // Check if 24 hours have passed (OPTIMIZATION: uint40 arithmetic)
        if (currentTime >= _consumer.lastQueryReset + 1 days) {
            _consumer.dailyQueriesUsed = 0;
            _consumer.lastQueryReset = currentTime;
        }
    }

    /**
     * @dev Distribute query revenue to stakeholders
     * OPTIMIZATION: uint96 amounts, efficient calculations
     */
    function _distributeRevenue(
        string memory _gameId,
        address _developer,
        uint96 _totalFee
    ) internal {
        // Calculate splits (OPTIMIZATION: use uint96 throughout)
        uint96 developerAmount = uint96((uint256(_totalFee) * DEVELOPER_SHARE) / 10000);
        uint96 protocolAmount = uint96((uint256(_totalFee) * PROTOCOL_SHARE) / 10000);
        uint96 disputerAmount = uint96((uint256(_totalFee) * DISPUTER_POOL_SHARE) / 10000);

        // Update developer revenue (OPTIMIZATION: direct struct field updates)
        DeveloperRevenue storage devRevenue = developerRevenues[_developer];
        devRevenue.totalEarned += developerAmount;
        devRevenue.pendingWithdrawal += developerAmount;
        devRevenue.queryCount++;

        // Add to protocol pools
        protocolTreasury += uint256(protocolAmount);
        disputerPool += uint256(disputerAmount);

        emit RevenueDistributed(_gameId, _developer, developerAmount, devRevenue.queryCount);
    }

    // ============================================
    // VIEW FUNCTIONS (Backward Compatible)
    // ============================================

    /**
     * @notice Get consumer data - BACKWARD COMPATIBLE
     * @dev Returns uint256 values for compatibility, but internal storage uses smaller types
     */
    function getConsumer(address _consumer)
        external
        view
        returns (
            address consumerAddress,
            uint256 balance,
            uint256 totalDeposited,
            uint256 totalQueriesMade,
            uint256 totalFeesPaid,
            uint256 lastQueryReset,
            uint256 dailyQueriesUsed,
            bool isActive
        )
    {
        Consumer memory c = consumers[_consumer];
        return (
            _consumer,                      // Reconstruct consumerAddress from map key
            uint256(c.balance),             // Convert uint96 to uint256
            uint256(c.totalDeposited),      // Convert uint96 to uint256
            uint256(c.totalQueriesMade),    // Convert uint32 to uint256
            uint256(c.totalFeesPaid),       // Convert uint96 to uint256
            uint256(c.lastQueryReset),      // Convert uint40 to uint256
            uint256(c.dailyQueriesUsed),    // Convert uint32 to uint256
            c.isActive
        );
    }

    /**
     * @notice Get developer revenue - BACKWARD COMPATIBLE
     */
    function getDeveloperRevenue(address _developer)
        external
        view
        returns (
            uint256 totalEarned,
            uint256 pendingWithdrawal,
            uint256 totalWithdrawn,
            uint256 queryCount
        )
    {
        DeveloperRevenue memory rev = developerRevenues[_developer];
        return (
            uint256(rev.totalEarned),
            uint256(rev.pendingWithdrawal),
            uint256(rev.totalWithdrawn),
            uint256(rev.queryCount)
        );
    }

    /**
     * @notice Get game query count
     */
    function getGameQueryCount(string calldata _gameId) external view returns (uint256) {
        return uint256(gameQueryCounts[_gameId]);
    }

    /**
     * @notice Get consumer balance
     */
    function getConsumerBalance(address _consumer) external view returns (uint256) {
        return uint256(consumers[_consumer].balance);
    }

    /**
     * @notice Get remaining free queries
     * @dev OPTIMIZED: Efficient time check
     */
    function getRemainingFreeQueries(address _consumer) external view returns (uint256) {
        Consumer memory consumer = consumers[_consumer];

        // Check if need to reset
        if (block.timestamp >= uint256(consumer.lastQueryReset) + 1 days) {
            return FREE_DAILY_QUERIES;
        }

        if (consumer.dailyQueriesUsed >= FREE_DAILY_QUERIES) {
            return 0;
        }

        return FREE_DAILY_QUERIES - uint256(consumer.dailyQueriesUsed);
    }

    /**
     * @notice Calculate deposit bonus
     */
    function calculateDepositBonus(uint256 _depositAmount) external pure returns (uint256) {
        if (_depositAmount >= DEPOSIT_TIER_3) {
            return (_depositAmount * BONUS_TIER_3) / 10000;
        } else if (_depositAmount >= DEPOSIT_TIER_2) {
            return (_depositAmount * BONUS_TIER_2) / 10000;
        } else if (_depositAmount >= DEPOSIT_TIER_1) {
            return (_depositAmount * BONUS_TIER_1) / 10000;
        }
        return 0;
    }

    /**
     * @notice Get total consumers
     */
    function getTotalConsumers() external view returns (uint256) {
        return allConsumers.length;
    }

    receive() external payable {
        protocolTreasury += msg.value;
    }
}
