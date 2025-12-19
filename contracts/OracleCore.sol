// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./GameRegistry.sol";
import "./FeeManager.sol";

/**
 * @title OracleCore
 * @notice Core oracle contract for submitting and querying game results with self-describing data
 * @dev Implements universal result submission with flexible encoding and quick-access fields
 */
contract OracleCore is OwnableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    // ============ Errors ============

    error MatchNotFound();
    error ResultAlreadySubmitted();
    error ResultNotFinalized();
    error DisputeWindowActive();
    error DisputeWindowClosed();
    error Unauthorized();
    error InvalidMatchTime();
    error FieldNotFound();
    error GameNotActive();

    // ============ Structs ============

    struct Result {
        bytes32 matchId;
        bytes32 gameId;
        address submitter;
        bytes encodedData; // Raw encoded result data (any format)
        string decodeSchema; // Instructions on how to decode the data
        uint64 submittedAt;
        uint64 finalizedAt;
        bool isFinalized;
        bool isDisputed;
    }

    // ============ State Variables ============

    /// @notice Dispute window duration (15 minutes)
    uint256 public constant DISPUTE_WINDOW = 15 minutes;

    /// @notice Reference to GameRegistry contract
    GameRegistry public gameRegistry;

    /// @notice Reference to FeeManager contract
    FeeManager public feeManager;

    /// @notice Mapping of matchId to Result struct
    mapping(bytes32 => Result) public results;

    /// @notice Mapping of matchId to quick-access fields (fieldHash => value)
    mapping(bytes32 => mapping(bytes32 => bytes32)) public quickFields;

    /// @notice Mapping of matchId to array of quick field keys
    mapping(bytes32 => bytes32[]) public quickFieldKeys;

    /// @notice Total number of results submitted
    uint256 public totalResults;

    /// @notice Total number of finalized results
    uint256 public totalFinalized;

    // ============ Events ============

    event ResultSubmitted(
        bytes32 indexed matchId,
        bytes32 indexed gameId,
        address indexed submitter,
        uint64 submittedAt,
        uint64 finalizeAfter
    );

    event ResultFinalized(
        bytes32 indexed matchId,
        bytes32 indexed gameId,
        uint64 finalizedAt
    );

    event ResultQueried(
        bytes32 indexed matchId,
        address indexed consumer,
        bool isQuickField,
        uint256 fee
    );

    event DisputeInitiated(
        bytes32 indexed matchId,
        address indexed challenger,
        uint256 stakeAmount
    );

    event QuickFieldAdded(
        bytes32 indexed matchId,
        bytes32 indexed fieldHash,
        bytes32 value
    );

    // ============ Modifiers ============

    modifier resultExists(bytes32 matchId) {
        if (results[matchId].submitter == address(0)) revert MatchNotFound();
        _;
    }

    modifier resultFinalized(bytes32 matchId) {
        if (!results[matchId].isFinalized) revert ResultNotFinalized();
        _;
    }

    // ============ Initialize ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _gameRegistry,
        address payable _feeManager
    ) public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        gameRegistry = GameRegistry(_gameRegistry);
        feeManager = FeeManager(_feeManager);
    }

    // ============ External Functions ============

    /**
     * @notice Submit a result for a match with self-describing data
     * @param matchId The match identifier
     * @param encodedData Raw encoded result data (any format developer chooses)
     * @param decodeSchema Human-readable instructions on how to decode the data
     * @param fieldKeys Array of field names (hashed) for instant access
     * @param fieldValues Array of field values corresponding to keys
     */
    function submitResult(
        bytes32 matchId,
        bytes calldata encodedData,
        string calldata decodeSchema,
        bytes32[] calldata fieldKeys,
        bytes32[] calldata fieldValues
    ) external nonReentrant {
        // Get match details from registry
        GameRegistry.Match memory matchData = gameRegistry.getMatch(matchId);
        if (matchData.submitter == address(0)) revert MatchNotFound();

        // Verify submitter is the game developer
        if (matchData.submitter != msg.sender) revert Unauthorized();

        // Verify match time has passed
        if (block.timestamp < matchData.scheduledTime) revert InvalidMatchTime();

        // Verify result not already submitted
        if (results[matchId].submitter != address(0)) revert ResultAlreadySubmitted();

        // Verify game is active
        GameRegistry.Game memory game = gameRegistry.getGame(matchData.gameId);
        if (!game.isActive || game.isBanned) revert GameNotActive();

        // Verify quick field arrays match
        require(fieldKeys.length == fieldValues.length, "Field arrays mismatch");

        // Store result
        results[matchId] = Result({
            matchId: matchId,
            gameId: matchData.gameId,
            submitter: msg.sender,
            encodedData: encodedData,
            decodeSchema: decodeSchema,
            submittedAt: uint64(block.timestamp),
            finalizedAt: 0,
            isFinalized: false,
            isDisputed: false
        });

        // Store quick-access fields
        for (uint256 i = 0; i < fieldKeys.length; i++) {
            quickFields[matchId][fieldKeys[i]] = fieldValues[i];
            quickFieldKeys[matchId].push(fieldKeys[i]);

            emit QuickFieldAdded(matchId, fieldKeys[i], fieldValues[i]);
        }

        totalResults++;

        // Mark result as submitted in registry
        gameRegistry.markResultSubmitted(matchId);

        uint64 finalizeAfter = uint64(block.timestamp + DISPUTE_WINDOW);

        emit ResultSubmitted(
            matchId,
            matchData.gameId,
            msg.sender,
            uint64(block.timestamp),
            finalizeAfter
        );
    }

    /**
     * @notice Finalize a result after dispute window expires
     * @param matchId The match identifier
     */
    function finalizeResult(bytes32 matchId) external resultExists(matchId) {
        Result storage result = results[matchId];

        if (result.isFinalized) return; // Already finalized

        // Check if dispute window has passed
        if (block.timestamp < result.submittedAt + DISPUTE_WINDOW) {
            revert DisputeWindowActive();
        }

        result.isFinalized = true;
        result.finalizedAt = uint64(block.timestamp);
        totalFinalized++;

        emit ResultFinalized(matchId, result.gameId, uint64(block.timestamp));
    }

    /**
     * @notice Query a quick-access field from a finalized result
     * @param matchId The match identifier
     * @param fieldHash Hash of the field name (keccak256 of field name string)
     * @return The field value as bytes32
     */
    function getResultField(bytes32 matchId, bytes32 fieldHash)
        external
        resultExists(matchId)
        resultFinalized(matchId)
        returns (bytes32)
    {
        bytes32 value = quickFields[matchId][fieldHash];
        if (value == bytes32(0)) revert FieldNotFound();

        // Charge query fee
        feeManager.chargeQueryFee(msg.sender, results[matchId].gameId);

        emit ResultQueried(matchId, msg.sender, true, feeManager.queryFee());

        return value;
    }

    /**
     * @notice Get full result data with decode instructions
     * @param matchId The match identifier
     * @return encodedData The raw encoded result data
     * @return decodeSchema Instructions on how to decode the data
     * @return isFinalized Whether the result is finalized
     */
    function getFullResult(bytes32 matchId)
        external
        resultExists(matchId)
        resultFinalized(matchId)
        returns (bytes memory encodedData, string memory decodeSchema, bool isFinalized)
    {
        Result memory result = results[matchId];

        // Charge query fee
        feeManager.chargeQueryFee(msg.sender, result.gameId);

        emit ResultQueried(matchId, msg.sender, false, feeManager.queryFee());

        return (result.encodedData, result.decodeSchema, result.isFinalized);
    }

    /**
     * @notice Get all quick-access field keys for a match
     * @param matchId The match identifier
     * @return Array of field hashes
     */
    function getQuickFieldKeys(bytes32 matchId)
        external
        view
        resultExists(matchId)
        returns (bytes32[] memory)
    {
        return quickFieldKeys[matchId];
    }

    /**
     * @notice Peek at a quick field value without charging (for preview/validation)
     * @param matchId The match identifier
     * @param fieldHash Hash of the field name
     * @return The field value
     */
    function peekResultField(bytes32 matchId, bytes32 fieldHash)
        external
        view
        resultExists(matchId)
        returns (bytes32)
    {
        return quickFields[matchId][fieldHash];
    }

    /**
     * @notice Check if a result can be finalized
     * @param matchId The match identifier
     * @return canFinalize Whether the result can be finalized now
     */
    function canFinalize(bytes32 matchId)
        external
        view
        resultExists(matchId)
        returns (bool)
    {
        Result memory result = results[matchId];
        return !result.isFinalized &&
               block.timestamp >= result.submittedAt + DISPUTE_WINDOW;
    }

    /**
     * @notice Get result details
     * @param matchId The match identifier
     */
    function getResult(bytes32 matchId)
        external
        view
        resultExists(matchId)
        returns (Result memory)
    {
        return results[matchId];
    }

    /**
     * @notice Batch finalize multiple results
     * @param matchIds Array of match identifiers to finalize
     */
    function batchFinalizeResults(bytes32[] calldata matchIds) external {
        for (uint256 i = 0; i < matchIds.length; i++) {
            bytes32 matchId = matchIds[i];
            Result storage result = results[matchId];

            if (result.submitter != address(0) &&
                !result.isFinalized &&
                block.timestamp >= result.submittedAt + DISPUTE_WINDOW) {

                result.isFinalized = true;
                result.finalizedAt = uint64(block.timestamp);
                totalFinalized++;

                emit ResultFinalized(matchId, result.gameId, uint64(block.timestamp));
            }
        }
    }

    // ============ Admin Functions ============

    /**
     * @notice Mark a result as disputed (called by DisputeResolver)
     * @param matchId The match identifier
     */
    function markResultDisputed(bytes32 matchId) external onlyOwner resultExists(matchId) {
        results[matchId].isDisputed = true;
    }

    /**
     * @notice Update GameRegistry address
     * @param _gameRegistry New GameRegistry address
     */
    function updateGameRegistry(address _gameRegistry) external onlyOwner {
        gameRegistry = GameRegistry(_gameRegistry);
    }

    /**
     * @notice Update FeeManager address
     * @param _feeManager New FeeManager address
     */
    function updateFeeManager(address payable _feeManager) external onlyOwner {
        feeManager = FeeManager(_feeManager);
    }

    // ============ Internal Functions ============

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ============ Helper Functions ============

    /**
     * @notice Helper to compute field hash from string
     * @param fieldName The field name as string
     * @return The keccak256 hash of the field name
     */
    function computeFieldHash(string calldata fieldName) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(fieldName));
    }
}
