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
        address developer;
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

    // ============ Events ============

    event GameRegistered(
        bytes32 indexed gameId,
        address indexed developer,
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

    // ============ Modifiers ============

    modifier onlyGameDeveloper(bytes32 gameId) {
        if (games[gameId].developer != msg.sender) revert Unauthorized();
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
     * @return gameId The unique identifier for the registered game
     */
    function registerGame(
        string calldata name,
        string calldata metadata
    ) external payable nonReentrant returns (bytes32) {
        if (msg.value < minimumStake) revert InsufficientStake();

        // Generate unique gameId from developer address and name
        bytes32 gameId = keccak256(abi.encodePacked(msg.sender, name, block.timestamp));

        if (games[gameId].developer != address(0)) revert GameAlreadyRegistered();

        games[gameId] = Game({
            developer: msg.sender,
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

        developerGames[msg.sender].push(gameId);
        totalGames++;

        emit GameRegistered(gameId, msg.sender, name, msg.value, uint64(block.timestamp));

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

    // ============ Internal Functions ============

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
