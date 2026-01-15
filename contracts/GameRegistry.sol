// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title GameRegistry
 * @notice Manages game registration, staking, and match scheduling for PredictBNB oracle
 * @dev Implements game reputation system and developer verification
 */
contract GameRegistry is OwnableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    // ============ Errors ============

    error InsufficientStake();
    error GameNotRegistered();
    error GameAlreadyRegistered();
    error MatchAlreadyScheduled();
    error MatchNotFound();
    error Unauthorized();
    error InvalidReputation();
    error GameIsBanned();
    error InvalidMatchTime();

    // ============ Structs ============

    struct Game {
        address developer; // The actual developer/owner
        address gameContract; // The game contract address (if applicable)
        string name;
        string metadata; // JSON metadata (genre, website, etc.)
        uint256 stakedAmount;
        uint16 reputation; // 0-1000 score
        uint64 registeredAt;
        uint32 totalMatches;
        uint32 totalDisputes;
        bool isActive;
        bool isBanned;
    }

    struct Match {
        bytes32 gameId;
        uint64 scheduledTime;
        string metadata; // JSON metadata (teams, tournament, etc.)
        address submitter;
        bool hasResult;
        uint64 createdAt;
    }

    // ============ State Variables ============

    /// @notice Minimum stake required to register a game (0.1 BNB)
    uint256 public minimumStake;

    /// @notice Mapping of gameId to Game struct
    mapping(bytes32 => Game) public games;

    /// @notice Mapping of matchId to Match struct
    mapping(bytes32 => Match) public matches;

    /// @notice Counter for total games registered
    uint256 public totalGames;

    /// @notice Counter for total matches scheduled
    uint256 public totalMatches;

    /// @notice Reference to DisputeResolver contract
    address public disputeResolver;

    /// @notice Reference to OracleCore contract
    address public oracleCore;

    /// @notice Mapping to check if a developer has registered a game
    mapping(address => bytes32[]) public developerGames;

    /// @notice Mapping of gameId to array of matchIds for that game
    mapping(bytes32 => bytes32[]) public gameMatches;

    /// @notice Mapping to quickly check match count per game
    mapping(bytes32 => uint256) public gameMatchCount;

    /// @notice Array of all registered game IDs (for pagination)
    bytes32[] public allGameIds;

    // ============ Events ============

    event GameRegistered(
        bytes32 indexed gameId,
        address indexed developer,
        address indexed gameContract,
        string name,
        uint256 stakedAmount,
        uint64 timestamp
    );

    event MatchScheduled(
        bytes32 indexed matchId,
        bytes32 indexed gameId,
        address indexed submitter,
        uint64 scheduledTime,
        string metadata
    );

    event StakeIncreased(
        bytes32 indexed gameId,
        address indexed developer,
        uint256 additionalAmount,
        uint256 newTotal
    );

    event StakeSlashed(
        bytes32 indexed gameId,
        uint256 slashedAmount,
        uint256 remainingStake,
        string reason
    );

    event ReputationUpdated(
        bytes32 indexed gameId,
        uint16 oldReputation,
        uint16 newReputation
    );

    event GameDeactivated(bytes32 indexed gameId, string reason);

    event GameReactivated(bytes32 indexed gameId);

    event GameBanned(bytes32 indexed gameId, string reason);

    event ResultSubmitted(bytes32 indexed matchId, bytes32 indexed gameId);

    event DeveloperTransferred(
        bytes32 indexed gameId,
        address indexed oldDeveloper,
        address indexed newDeveloper
    );

    // ============ Modifiers ============

    modifier onlyGameDeveloper(bytes32 gameId) {
        Game storage game = games[gameId];
        // Allow both developer and game contract to manage the game
        if (game.developer != msg.sender && game.gameContract != msg.sender) revert Unauthorized();
        _;
    }

    modifier gameExists(bytes32 gameId) {
        if (games[gameId].developer == address(0)) revert GameNotRegistered();
        _;
    }

    modifier gameActive(bytes32 gameId) {
        if (!games[gameId].isActive) revert GameNotRegistered();
        if (games[gameId].isBanned) revert GameIsBanned();
        _;
    }

    // ============ Initialize ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(uint256 _minimumStake) public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        minimumStake = _minimumStake; // 0.1 BNB = 100000000000000000 wei
    }

    // ============ External Functions ============

    /**
     * @notice Register a new game on the oracle
     * @param name The name of the game
     * @param metadata JSON string with game metadata
     * @param developer The developer address (pass address(0) to use msg.sender)
     * @return gameId The unique identifier for the registered game
     */
    function registerGame(
        string calldata name,
        string calldata metadata,
        address developer,
        address gameAddress
    ) external payable nonReentrant returns (bytes32) {
        if (msg.value < minimumStake) revert InsufficientStake();

        // If developer is address(0), use msg.sender as developer
        address gameDeveloper = developer == address(0) ? msg.sender : developer;

        // Game contract is msg.sender if different from developer
        address gameContract = gameAddress != gameDeveloper ? msg.sender : address(0);

        // Generate unique gameId from contract address, name, and timestamp
        bytes32 gameId = keccak256(abi.encodePacked(msg.sender, name, block.timestamp));

        if (games[gameId].developer != address(0)) revert GameAlreadyRegistered();

        games[gameId] = Game({
            developer: gameDeveloper,
            gameContract: gameContract,
            name: name,
            metadata: metadata,
            stakedAmount: msg.value,
            reputation: 500, // Start with neutral reputation
            registeredAt: uint64(block.timestamp),
            totalMatches: 0,
            totalDisputes: 0,
            isActive: true,
            isBanned: false
        });

        // Index by both developer and game contract (if different)
        developerGames[gameDeveloper].push(gameId);
        if (gameContract != address(0)) {
            developerGames[gameContract].push(gameId);
        }

        allGameIds.push(gameId);
        totalGames++;

        emit GameRegistered(gameId, gameDeveloper, gameContract, name, msg.value, uint64(block.timestamp));

        return gameId;
    }

    /**
     * @notice Schedule a match before it takes place
     * @param gameId The game identifier
     * @param scheduledTime Unix timestamp when the match will start
     * @param metadata JSON string with match metadata (teams, tournament, etc.)
     * @return matchId The unique identifier for the scheduled match
     */
    function scheduleMatch(
        bytes32 gameId,
        uint64 scheduledTime,
        string calldata metadata
    ) external gameExists(gameId) gameActive(gameId) onlyGameDeveloper(gameId) returns (bytes32) {
        if (scheduledTime <= block.timestamp) revert InvalidMatchTime();

        // Generate unique matchId
        bytes32 matchId = keccak256(
            abi.encodePacked(gameId, scheduledTime, metadata, block.timestamp)
        );

        if (matches[matchId].submitter != address(0)) revert MatchAlreadyScheduled();

        matches[matchId] = Match({
            gameId: gameId,
            scheduledTime: scheduledTime,
            metadata: metadata,
            submitter: msg.sender,
            hasResult: false,
            createdAt: uint64(block.timestamp)
        });

        games[gameId].totalMatches++;
        totalMatches++;

        // Track match for this game
        gameMatches[gameId].push(matchId);
        gameMatchCount[gameId]++;

        emit MatchScheduled(matchId, gameId, msg.sender, scheduledTime, metadata);

        return matchId;
    }

    /**
     * @notice Increase stake for a registered game
     * @param gameId The game identifier
     */
    function increaseStake(bytes32 gameId)
        external
        payable
        gameExists(gameId)
        onlyGameDeveloper(gameId)
    {
        games[gameId].stakedAmount += msg.value;

        emit StakeIncreased(gameId, msg.sender, msg.value, games[gameId].stakedAmount);
    }

    /**
     * @notice Mark that a result has been submitted for a match (called by OracleCore)
     * @param matchId The match identifier
     */
    function markResultSubmitted(bytes32 matchId) external {
        if (msg.sender != oracleCore && msg.sender != owner()) revert Unauthorized();
        if (matches[matchId].submitter == address(0)) revert MatchNotFound();
        matches[matchId].hasResult = true;

        emit ResultSubmitted(matchId, matches[matchId].gameId);
    }

    // ============ Admin Functions ============

    /**
     * @notice Slash a game's stake for fraudulent behavior
     * @param gameId The game identifier
     * @param slashAmount Amount to slash
     * @param reason Reason for slashing
     */
    function slashStake(
        bytes32 gameId,
        uint256 slashAmount,
        string calldata reason
    ) external gameExists(gameId) {
        if (msg.sender != disputeResolver && msg.sender != owner()) revert Unauthorized();
        Game storage game = games[gameId];

        if (slashAmount > game.stakedAmount) {
            slashAmount = game.stakedAmount;
        }

        game.stakedAmount -= slashAmount;

        // Send slashed amount to caller (DisputeResolver) for distribution
        (bool success, ) = payable(msg.sender).call{value: slashAmount}("");
        require(success, "Transfer failed");

        emit StakeSlashed(gameId, slashAmount, game.stakedAmount, reason);

        // If stake falls below minimum, deactivate game
        if (game.stakedAmount < minimumStake) {
            game.isActive = false;
            emit GameDeactivated(gameId, "Insufficient stake after slash");
        }
    }

    /**
     * @notice Update a game's reputation score
     * @param gameId The game identifier
     * @param newReputation New reputation score (0-1000)
     */
    function updateReputation(
        bytes32 gameId,
        uint16 newReputation
    ) external gameExists(gameId) {
        if (msg.sender != disputeResolver && msg.sender != owner()) revert Unauthorized();
        if (newReputation > 1000) revert InvalidReputation();

        uint16 oldReputation = games[gameId].reputation;
        games[gameId].reputation = newReputation;

        emit ReputationUpdated(gameId, oldReputation, newReputation);
    }

    /**
     * @notice Increment dispute counter for a game
     * @param gameId The game identifier
     */
    function incrementDisputes(bytes32 gameId) external gameExists(gameId) {
        if (msg.sender != disputeResolver && msg.sender != owner()) revert Unauthorized();
        games[gameId].totalDisputes++;
    }

    /**
     * @notice Ban a game permanently
     * @param gameId The game identifier
     * @param reason Reason for ban
     */
    function banGame(bytes32 gameId, string calldata reason)
        external
        onlyOwner
        gameExists(gameId)
    {
        games[gameId].isBanned = true;
        games[gameId].isActive = false;

        emit GameBanned(gameId, reason);
    }

    /**
     * @notice Update minimum stake requirement
     * @param newMinimum New minimum stake amount
     */
    function updateMinimumStake(uint256 newMinimum) external onlyOwner {
        minimumStake = newMinimum;
    }

    /**
     * @notice Update DisputeResolver address
     * @param _disputeResolver New DisputeResolver address
     */
    function updateDisputeResolver(address _disputeResolver) external onlyOwner {
        disputeResolver = _disputeResolver;
    }

    /**
     * @notice Update OracleCore address
     * @param _oracleCore New OracleCore address
     */
    function updateOracleCore(address _oracleCore) external onlyOwner {
        oracleCore = _oracleCore;
    }

    /**
     * @notice Transfer a game to a new developer
     * @dev Only owner can call this - useful for fixing registration bugs
     * @param gameId The game identifier
     * @param newDeveloper The new developer address
     */
    function transferGameDeveloper(
        bytes32 gameId,
        address newDeveloper
    ) external onlyOwner gameExists(gameId) {
        require(newDeveloper != address(0), "Invalid developer address");

        Game storage game = games[gameId];
        address oldDeveloper = game.developer;

        require(oldDeveloper != newDeveloper, "Already the developer");

        // Remove from old developer's game list
        bytes32[] storage oldDevGames = developerGames[oldDeveloper];
        for (uint256 i = 0; i < oldDevGames.length; i++) {
            if (oldDevGames[i] == gameId) {
                // Replace with last element and pop
                oldDevGames[i] = oldDevGames[oldDevGames.length - 1];
                oldDevGames.pop();
                break;
            }
        }

        // Update game's developer
        game.developer = newDeveloper;

        // Add to new developer's game list
        developerGames[newDeveloper].push(gameId);

        emit DeveloperTransferred(gameId, oldDeveloper, newDeveloper);
    }

    // ============ View Functions ============

    /**
     * @notice Get game details
     * @param gameId The game identifier
     */
    function getGame(bytes32 gameId) external view returns (Game memory) {
        return games[gameId];
    }

    /**
     * @notice Get match details
     * @param matchId The match identifier
     */
    function getMatch(bytes32 matchId) external view returns (Match memory) {
        return matches[matchId];
    }

    /**
     * @notice Get all games registered by a developer
     * @param developer The developer address
     */
    function getDeveloperGames(address developer) external view returns (bytes32[] memory) {
        return developerGames[developer];
    }

    /**
     * @notice Check if a game is in good standing
     * @param gameId The game identifier
     */
    function isGameInGoodStanding(bytes32 gameId) external view returns (bool) {
        Game memory game = games[gameId];
        return game.isActive &&
               !game.isBanned &&
               game.stakedAmount >= minimumStake &&
               game.reputation >= 300; // Minimum acceptable reputation
    }

    /**
     * @notice Get all matches for a specific game
     * @param gameId The game identifier
     * @return Array of matchIds for this game
     */
    function getGameMatches(bytes32 gameId) external view returns (bytes32[] memory) {
        return gameMatches[gameId];
    }

    /**
     * @notice Get paginated matches for a game
     * @param gameId The game identifier
     * @param offset Starting index
     * @param limit Maximum number of matches to return
     * @return Array of matchIds (paginated)
     */
    function getGameMatchesPaginated(
        bytes32 gameId,
        uint256 offset,
        uint256 limit
    ) external view returns (bytes32[] memory) {
        bytes32[] storage allMatches = gameMatches[gameId];

        if (offset >= allMatches.length) {
            return new bytes32[](0);
        }

        uint256 end = offset + limit;
        if (end > allMatches.length) {
            end = allMatches.length;
        }

        bytes32[] memory result = new bytes32[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = allMatches[i];
        }

        return result;
    }

    /**
     * @notice Get match details for a specific game and matchId
     * @param gameId The game identifier (for context validation)
     * @param matchId The match identifier
     * @return Match details
     */
    function getGameMatch(bytes32 gameId, bytes32 matchId) external view returns (Match memory) {
        Match memory matchData = matches[matchId];
        require(matchData.gameId == gameId, "Match not from this game");
        return matchData;
    }

    /**
     * @notice Batch get match details
     * @param matchIds Array of match identifiers
     * @return Array of Match structs
     */
    function getMatchesBatch(bytes32[] calldata matchIds) external view returns (Match[] memory) {
        Match[] memory result = new Match[](matchIds.length);
        for (uint256 i = 0; i < matchIds.length; i++) {
            result[i] = matches[matchIds[i]];
        }
        return result;
    }

    /**
     * @notice Batch get game details
     * @param gameIds Array of game identifiers
     * @return Array of Game structs
     */
    function getGamesBatch(bytes32[] calldata gameIds) external view returns (Game[] memory) {
        Game[] memory result = new Game[](gameIds.length);
        for (uint256 i = 0; i < gameIds.length; i++) {
            result[i] = games[gameIds[i]];
        }
        return result;
    }

    /**
     * @notice Get developer aggregated statistics
     * @param developer The developer address
     * @return _totalGames Number of games registered
     * @return _totalMatches Total matches across all games
     * @return _totalDisputes Total disputes across all games
     * @return averageReputation Average reputation score
     */
    function getDeveloperStats(address developer)
        external
        view
        returns (
            uint256 _totalGames,
            uint256 _totalMatches,
            uint256 _totalDisputes,
            uint256 averageReputation
        )
    {
        bytes32[] memory devGames = developerGames[developer];
        _totalGames = devGames.length;

        if (_totalGames == 0) {
            return (0, 0, 0, 0);
        }

        uint256 sumReputation = 0;
        for (uint256 i = 0; i < devGames.length; i++) {
            Game memory game = games[devGames[i]];
            _totalMatches += game.totalMatches;
            _totalDisputes += game.totalDisputes;
            sumReputation += game.reputation;
        }

        averageReputation = sumReputation / _totalGames;
    }

    /**
     * @notice Get paginated list of all games
     * @param offset Starting index
     * @param limit Maximum number of games to return
     * @return Array of Game structs
     */
    function getAllGames(uint256 offset, uint256 limit) external view returns (Game[] memory) {
        if (offset >= allGameIds.length) {
            return new Game[](0);
        }

        uint256 end = offset + limit;
        if (end > allGameIds.length) {
            end = allGameIds.length;
        }

        Game[] memory result = new Game[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = games[allGameIds[i]];
        }

        return result;
    }

    /**
     * @notice Get all active games
     * @return Array of active game IDs
     */
    function getActiveGames() external view returns (bytes32[] memory) {
        // Count active games first
        uint256 activeCount = 0;
        for (uint256 i = 0; i < allGameIds.length; i++) {
            if (games[allGameIds[i]].isActive && !games[allGameIds[i]].isBanned) {
                activeCount++;
            }
        }

        // Build result array
        bytes32[] memory result = new bytes32[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < allGameIds.length; i++) {
            if (games[allGameIds[i]].isActive && !games[allGameIds[i]].isBanned) {
                result[index] = allGameIds[i];
                index++;
            }
        }

        return result;
    }

    /**
     * @notice Check if a match exists and belongs to a specific game
     * @param gameId The game identifier
     * @param matchId The match identifier
     * @return exists Whether the match exists for this game
     */
    function matchExists(bytes32 gameId, bytes32 matchId) external view returns (bool) {
        Match memory matchData = matches[matchId];
        return matchData.submitter != address(0) && matchData.gameId == gameId;
    }

    // ============ Internal Functions ============

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
