// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "../GameRegistry.sol";
import "../OracleCore.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BaseGame
 * @notice Abstract base contract for all PredictBNB games
 * @dev Provides standardized oracle integration and common game functionality
 *
 * All games should inherit from this contract to ensure:
 * - Consistent oracle interaction
 * - Standardized game registration
 * - Proper match scheduling and result submission
 * - Event emission for tracking
 *
 * Games must implement:
 * - Game-specific logic (rules, state management, etc.)
 * - Result encoding (how to format results for oracle)
 */
abstract contract BaseGame is Ownable {
    // ============ Errors ============

    error NotRegistered();
    error AlreadyRegistered();
    error MatchNotFound();

    // ============ State Variables ============

    /// @notice Reference to GameRegistry contract
    GameRegistry public immutable gameRegistry;

    /// @notice Reference to OracleCore contract
    OracleCore public immutable oracleCore;

    /// @notice Unique identifier for this game in the registry
    bytes32 public gameId;

    /// @notice Game name
    string public gameName;

    /// @notice Mapping of oracle matchId to game-specific data
    /// @dev Games can use this to store additional match metadata
    mapping(bytes32 => bool) internal _trackedMatches;

    // ============ Events ============

    event GameRegistered(bytes32 indexed gameId, string name, address developer);
    event MatchScheduled(bytes32 indexed matchId, uint64 scheduledTime);
    event ResultSubmitted(bytes32 indexed matchId, bytes result);
    event MatchExecuted(bytes32 indexed matchId);

    // ============ Constructor ============

    /**
     * @notice Initialize base game contract
     * @param _gameRegistry Address of GameRegistry contract
     * @param _oracleCore Address of OracleCore contract
     */
    constructor(address _gameRegistry, address _oracleCore) Ownable(msg.sender) {
        gameRegistry = GameRegistry(_gameRegistry);
        oracleCore = OracleCore(_oracleCore);
    }

    // ============ External Functions ============

    /**
     * @notice Register this game with PredictBNB oracle system
     * @param name Game name
     * @param metadata JSON metadata describing the game
     * @dev Must be called with sufficient stake (minimum 0.1 BNB)
     * @dev Can only be called once per game instance
     */
    function registerWithOracle(
        string memory name,
        string memory metadata
    ) external payable onlyOwner {
        if (gameId != bytes32(0)) revert AlreadyRegistered();

        gameName = name;

        // Register with GameRegistry (developer = owner, gameContract = this contract)
        gameId = gameRegistry.registerGame{value: msg.value}(
            name,
            metadata,
            owner(),        // Developer address
            address(this)   // Game contract address
        );

        emit GameRegistered(gameId, name, owner());
    }

    // ============ Internal Functions ============

    /**
     * @notice Schedule a match with the oracle
     * @param scheduledTime When the match should start (unix timestamp)
     * @param metadata JSON metadata for this specific match
     * @return matchId Unique identifier for the scheduled match
     * @dev This creates a match in GameRegistry that prediction markets can see
     */
    function _scheduleMatch(
        uint64 scheduledTime,
        string memory metadata
    ) internal returns (bytes32) {
        if (gameId == bytes32(0)) revert NotRegistered();

        bytes32 matchId = gameRegistry.scheduleMatch(
            gameId,
            scheduledTime,
            metadata
        );

        _trackedMatches[matchId] = true;

        emit MatchScheduled(matchId, scheduledTime);

        return matchId;
    }

    /**
     * @notice Submit match result to oracle
     * @param matchId The match identifier from scheduling
     * @param encodedResult Encoded result data (format defined by game)
     * @param decodeSchema Human-readable instructions for decoding the result
     * @param fieldKeys Quick-access field keys (hashed field names)
     * @param fieldValues Quick-access field values
     * @dev Result enters 15-minute dispute window before finalization
     */
    function _submitResult(
        bytes32 matchId,
        bytes memory encodedResult,
        string memory decodeSchema,
        bytes32[] memory fieldKeys,
        bytes32[] memory fieldValues
    ) internal {
        if (!_trackedMatches[matchId]) revert MatchNotFound();

        oracleCore.submitResult(
            matchId,
            encodedResult,
            decodeSchema,
            fieldKeys,
            fieldValues
        );

        emit ResultSubmitted(matchId, encodedResult);
    }

    /**
     * @notice Submit result without quick-access fields
     * @param matchId The match identifier
     * @param encodedResult Encoded result data
     * @param decodeSchema Decode instructions
     */
    function _submitResult(
        bytes32 matchId,
        bytes memory encodedResult,
        string memory decodeSchema
    ) internal {
        bytes32[] memory emptyKeys = new bytes32[](0);
        bytes32[] memory emptyValues = new bytes32[](0);
        _submitResult(matchId, encodedResult, decodeSchema, emptyKeys, emptyValues);
    }

    /**
     * @notice Check if result is finalized (dispute window passed)
     * @param matchId The match identifier
     * @return True if result is final and can be used for settlements
     */
    function _isResultFinalized(bytes32 matchId) internal view returns (bool) {
        OracleCore.Result memory result = oracleCore.getResult(matchId);
        return result.isFinalized;
    }

    /**
     * @notice Get the result data for a match
     * @param matchId The match identifier
     * @return result The Result struct from oracle
     */
    function _getResult(bytes32 matchId) internal view returns (OracleCore.Result memory) {
        return oracleCore.getResult(matchId);
    }

    // ============ Virtual Functions ============
    // Games must implement these

    /**
     * @notice Execute game-specific match logic
     * @param matchId The match to execute
     * @dev Called after match conditions are met (e.g., scheduled time reached, players committed)
     * @dev Should calculate outcome and call _submitResult()
     */
    function executeMatch(bytes32 matchId) external virtual;

    /**
     * @notice Encode match result in game-specific format
     * @param matchId The match to encode
     * @return encodedResult The encoded result bytes
     * @return decodeSchema Human-readable decode instructions
     * @dev Games define their own encoding format
     * @dev Example formats: abi.encode, JSON string, custom binary
     */
    function _encodeResult(bytes32 matchId) internal view virtual returns (
        bytes memory encodedResult,
        string memory decodeSchema
    );

    // ============ View Functions ============

    /**
     * @notice Check if game is registered with oracle
     * @return True if registered
     */
    function isRegistered() external view returns (bool) {
        return gameId != bytes32(0);
    }

    /**
     * @notice Check if a match is tracked by this game
     * @param matchId The match identifier
     * @return True if this game created the match
     */
    function isTrackedMatch(bytes32 matchId) external view returns (bool) {
        return _trackedMatches[matchId];
    }

    /**
     * @notice Get game information from registry
     * @return game The Game struct from GameRegistry
     */
    function getGameInfo() external view returns (GameRegistry.Game memory game) {
        if (gameId == bytes32(0)) revert NotRegistered();
        return gameRegistry.getGame(gameId);
    }
}
