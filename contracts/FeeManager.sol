// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./GameRegistry.sol";
import "./OracleCore.sol";

/**
 * @title FeeManager
 * @notice Manages fees for data access and distributes revenue to game developers
 * @dev Implements hybrid model: free tier + pay-per-query + subscriptions
 */
contract FeeManager is Ownable, ReentrancyGuard {
    GameRegistry public gameRegistry;
    OracleCore public oracleCore;

    // Fee structure
    uint256 public constant BASE_QUERY_FEE = 0.0005 ether;  // Per query after free tier
    uint256 public constant MONTHLY_SUBSCRIPTION = 1 ether;  // Unlimited queries
    uint256 public constant FREE_DAILY_QUERIES = 100;        // Free queries per day

    // Revenue split percentages (in basis points, 10000 = 100%)
    uint256 public constant DEVELOPER_SHARE = 8000;     // 80% to game developer
    uint256 public constant PROTOCOL_SHARE = 1500;      // 15% to protocol treasury
    uint256 public constant DISPUTER_POOL_SHARE = 500;  // 5% to disputer rewards pool

    // Subscription tiers
    enum SubscriptionTier {
        Free,       // 100 queries/day
        Premium     // Unlimited queries for monthly fee
    }

    // Consumer (prediction market) struct
    struct Consumer {
        address consumerAddress;
        SubscriptionTier tier;
        uint256 subscriptionExpiry;
        uint256 totalQueriesMade;
        uint256 totalFeePaid;
        uint256 lastQueryReset;     // For daily free tier reset
        uint256 dailyQueriesUsed;
        bool isActive;
    }

    // Revenue tracking for game developers
    struct DeveloperRevenue {
        uint256 totalEarned;
        uint256 pendingWithdrawal;
        uint256 totalWithdrawn;
        uint256 queryCount;         // Total queries to their games
    }

    // Storage
    mapping(address => Consumer) public consumers;
    mapping(address => DeveloperRevenue) public developerRevenues;
    mapping(string => uint256) public gameQueryCounts;      // gameId => query count
    mapping(bytes32 => uint256) public matchQueryCounts;    // matchId => query count

    address[] public allConsumers;
    uint256 public protocolTreasury;
    uint256 public disputerPool;

    // Events
    event ConsumerRegistered(address indexed consumer, SubscriptionTier tier);

    event SubscriptionPurchased(
        address indexed consumer,
        uint256 expiryTime,
        uint256 feePaid
    );

    event QueryFeePaid(
        address indexed consumer,
        bytes32 indexed matchId,
        string gameId,
        uint256 fee
    );

    event RevenueDistributed(
        string indexed gameId,
        address indexed developer,
        uint256 amount,
        uint256 queryCount
    );

    event DeveloperWithdrawal(
        address indexed developer,
        uint256 amount
    );

    event FeeStructureUpdated(
        uint256 queryFee,
        uint256 subscriptionFee
    );

    constructor(
        address _gameRegistryAddress,
        address _oracleCore
    ) Ownable(msg.sender) {
        require(_gameRegistryAddress != address(0), "FeeManager: Invalid registry address");
        require(_oracleCore != address(0), "FeeManager: Invalid oracle address");
        gameRegistry = GameRegistry(_gameRegistryAddress);
        oracleCore = OracleCore(_oracleCore);
    }

    /**
     * @notice Register as a data consumer (prediction market)
     */
    function registerConsumer() external {
        require(
            consumers[msg.sender].consumerAddress == address(0),
            "FeeManager: Already registered"
        );

        consumers[msg.sender] = Consumer({
            consumerAddress: msg.sender,
            tier: SubscriptionTier.Free,
            subscriptionExpiry: 0,
            totalQueriesMade: 0,
            totalFeePaid: 0,
            lastQueryReset: block.timestamp,
            dailyQueriesUsed: 0,
            isActive: true
        });

        allConsumers.push(msg.sender);

        emit ConsumerRegistered(msg.sender, SubscriptionTier.Free);
    }

    /**
     * @notice Purchase premium subscription for unlimited queries
     */
    function purchaseSubscription() external payable nonReentrant {
        require(
            consumers[msg.sender].consumerAddress != address(0),
            "FeeManager: Not registered"
        );
        require(msg.value == MONTHLY_SUBSCRIPTION, "FeeManager: Incorrect fee");

        Consumer storage consumer = consumers[msg.sender];

        // If already subscribed, extend from current expiry, otherwise from now
        uint256 baseTime = consumer.subscriptionExpiry > block.timestamp
            ? consumer.subscriptionExpiry
            : block.timestamp;

        consumer.tier = SubscriptionTier.Premium;
        consumer.subscriptionExpiry = baseTime + 30 days;
        consumer.totalFeePaid += msg.value;

        // Distribute subscription fee (same split as query fees)
        _distributeProtocolFees(msg.value);

        emit SubscriptionPurchased(msg.sender, consumer.subscriptionExpiry, msg.value);
    }

    /**
     * @notice Query game result with automatic fee handling
     * @param _matchId The match to query
     * @return resultData The game result
     * @return resultHash Hash for verification
     * @return isFinalized Whether result is finalized
     */
    function queryResult(bytes32 _matchId)
        external
        payable
        nonReentrant
        returns (
            string memory resultData,
            bytes32 resultHash,
            bool isFinalized
        )
    {
        Consumer storage consumer = consumers[msg.sender];
        require(consumer.isActive, "FeeManager: Consumer not registered or inactive");

        // Get result from oracle
        (resultData, resultHash, isFinalized) = oracleCore.getResult(_matchId);
        require(isFinalized, "FeeManager: Result not finalized yet");

        // Get match and game info for revenue distribution
        GameRegistry.Match memory matchData = gameRegistry.getMatch(_matchId);
        GameRegistry.Game memory game = gameRegistry.getGame(matchData.gameId);

        // Calculate required fee
        uint256 fee = _calculateFee(consumer);

        if (fee > 0) {
            require(msg.value >= fee, "FeeManager: Insufficient fee");

            // Distribute revenue
            _distributeRevenue(matchData.gameId, game.developer, fee);

            // Refund excess
            if (msg.value > fee) {
                payable(msg.sender).transfer(msg.value - fee);
            }

            consumer.totalFeePaid += fee;
        }

        // Update query counts
        consumer.totalQueriesMade++;
        matchQueryCounts[_matchId]++;
        gameQueryCounts[matchData.gameId]++;

        // Update daily query counter for free tier
        if (consumer.tier == SubscriptionTier.Free) {
            _updateDailyQueries(consumer);
            consumer.dailyQueriesUsed++;
        }

        emit QueryFeePaid(msg.sender, _matchId, matchData.gameId, fee);

        return (resultData, resultHash, isFinalized);
    }

    /**
     * @notice Batch query multiple results (more efficient)
     * @param _matchIds Array of match IDs to query
     */
    function batchQueryResults(bytes32[] calldata _matchIds)
        external
        payable
        nonReentrant
        returns (string[] memory, bytes32[] memory, bool[] memory)
    {
        Consumer storage consumer = consumers[msg.sender];
        require(consumer.isActive, "FeeManager: Consumer not registered or inactive");
        require(_matchIds.length > 0, "FeeManager: Empty array");
        require(_matchIds.length <= 50, "FeeManager: Too many queries");

        uint256 totalFee = 0;
        string[] memory resultDataArray = new string[](_matchIds.length);
        bytes32[] memory resultHashArray = new bytes32[](_matchIds.length);
        bool[] memory isFinalizedArray = new bool[](_matchIds.length);

        // Calculate total fee first
        for (uint256 i = 0; i < _matchIds.length; i++) {
            uint256 queryFee = _calculateFee(consumer);
            totalFee += queryFee;

            if (consumer.tier == SubscriptionTier.Free) {
                _updateDailyQueries(consumer);
                consumer.dailyQueriesUsed++;
            }
        }

        require(msg.value >= totalFee, "FeeManager: Insufficient fee");

        // Process each query
        for (uint256 i = 0; i < _matchIds.length; i++) {
            (
                resultDataArray[i],
                resultHashArray[i],
                isFinalizedArray[i]
            ) = oracleCore.getResult(_matchIds[i]);

            // Update counts and distribute revenue
            GameRegistry.Match memory matchData = gameRegistry.getMatch(_matchIds[i]);
            GameRegistry.Game memory game = gameRegistry.getGame(matchData.gameId);

            uint256 queryFee = _calculateFee(consumer);
            if (queryFee > 0) {
                _distributeRevenue(matchData.gameId, game.developer, queryFee);
            }

            consumer.totalQueriesMade++;
            matchQueryCounts[_matchIds[i]]++;
            gameQueryCounts[matchData.gameId]++;
        }

        consumer.totalFeePaid += totalFee;

        // Refund excess
        if (msg.value > totalFee) {
            payable(msg.sender).transfer(msg.value - totalFee);
        }

        return (resultDataArray, resultHashArray, isFinalizedArray);
    }

    /**
     * @notice Withdraw earned revenue (for game developers)
     */
    function withdrawRevenue() external nonReentrant {
        DeveloperRevenue storage revenue = developerRevenues[msg.sender];
        require(revenue.pendingWithdrawal > 0, "FeeManager: No revenue to withdraw");

        uint256 amount = revenue.pendingWithdrawal;
        revenue.pendingWithdrawal = 0;
        revenue.totalWithdrawn += amount;

        payable(msg.sender).transfer(amount);

        emit DeveloperWithdrawal(msg.sender, amount);
    }

    /**
     * @notice Withdraw protocol treasury (owner only)
     */
    function withdrawProtocolTreasury(uint256 _amount) external onlyOwner nonReentrant {
        require(_amount <= protocolTreasury, "FeeManager: Insufficient treasury");
        protocolTreasury -= _amount;
        payable(owner()).transfer(_amount);
    }

    /**
     * @notice Transfer funds to disputer pool in OracleCore
     */
    function fundDisputerPool(uint256 _amount) external onlyOwner nonReentrant {
        require(_amount <= disputerPool, "FeeManager: Insufficient disputer pool");
        disputerPool -= _amount;
        payable(address(oracleCore)).transfer(_amount);
    }

    // Internal functions

    /**
     * @notice Calculate fee for a query based on consumer tier
     */
    function _calculateFee(Consumer storage _consumer) internal view returns (uint256) {
        // Premium subscribers pay no per-query fee
        if (
            _consumer.tier == SubscriptionTier.Premium &&
            _consumer.subscriptionExpiry > block.timestamp
        ) {
            return 0;
        }

        // Check if within free daily limit
        if (_consumer.dailyQueriesUsed < FREE_DAILY_QUERIES) {
            return 0;
        }

        // Beyond free tier, pay per query
        return BASE_QUERY_FEE;
    }

    /**
     * @notice Update daily query counter (reset after 24 hours)
     */
    function _updateDailyQueries(Consumer storage _consumer) internal {
        if (block.timestamp >= _consumer.lastQueryReset + 1 days) {
            _consumer.dailyQueriesUsed = 0;
            _consumer.lastQueryReset = block.timestamp;
        }
    }

    /**
     * @notice Distribute query revenue to stakeholders
     */
    function _distributeRevenue(
        string memory _gameId,
        address _developer,
        uint256 _totalFee
    ) internal {
        // Calculate splits
        uint256 developerAmount = (_totalFee * DEVELOPER_SHARE) / 10000;
        uint256 protocolAmount = (_totalFee * PROTOCOL_SHARE) / 10000;
        uint256 disputerAmount = (_totalFee * DISPUTER_POOL_SHARE) / 10000;

        // Update developer revenue
        DeveloperRevenue storage devRevenue = developerRevenues[_developer];
        devRevenue.totalEarned += developerAmount;
        devRevenue.pendingWithdrawal += developerAmount;
        devRevenue.queryCount++;

        // Add to protocol pools
        protocolTreasury += protocolAmount;
        disputerPool += disputerAmount;

        emit RevenueDistributed(_gameId, _developer, developerAmount, devRevenue.queryCount);
    }

    /**
     * @notice Distribute protocol fees (for subscriptions)
     */
    function _distributeProtocolFees(uint256 _amount) internal {
        uint256 protocolAmount = (_amount * PROTOCOL_SHARE) / 10000;
        uint256 disputerAmount = (_amount * DISPUTER_POOL_SHARE) / 10000;

        protocolTreasury += protocolAmount;
        disputerPool += disputerAmount;

        // Rest goes to general pool for developers based on usage
        // (simplified - could be distributed proportionally)
    }

    // View functions

    function getConsumer(address _consumer) external view returns (Consumer memory) {
        return consumers[_consumer];
    }

    function getDeveloperRevenue(address _developer)
        external
        view
        returns (DeveloperRevenue memory)
    {
        return developerRevenues[_developer];
    }

    function getGameQueryCount(string calldata _gameId) external view returns (uint256) {
        return gameQueryCounts[_gameId];
    }

    function isSubscriptionActive(address _consumer) external view returns (bool) {
        Consumer memory consumer = consumers[_consumer];
        return consumer.tier == SubscriptionTier.Premium &&
               consumer.subscriptionExpiry > block.timestamp;
    }

    function getRemainingFreeQueries(address _consumer) external view returns (uint256) {
        Consumer memory consumer = consumers[_consumer];

        // Check if need to reset
        if (block.timestamp >= consumer.lastQueryReset + 1 days) {
            return FREE_DAILY_QUERIES;
        }

        if (consumer.dailyQueriesUsed >= FREE_DAILY_QUERIES) {
            return 0;
        }

        return FREE_DAILY_QUERIES - consumer.dailyQueriesUsed;
    }

    function getTotalConsumers() external view returns (uint256) {
        return allConsumers.length;
    }

    receive() external payable {
        protocolTreasury += msg.value;
    }
}
