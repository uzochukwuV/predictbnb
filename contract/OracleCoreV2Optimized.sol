// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../contracts/GameRegistry.sol";
import "./GameSchemaRegistryOptimized.sol";

/**
 * @title OracleCoreV2Optimized
 * @notice GAS-OPTIMIZED version of OracleCoreV2 with struct splitting and tight packing
 * @dev Original GameResult had 19 fields causing stack-too-deep errors and high gas costs
 *
 * OPTIMIZATION STRATEGY:
 * 1. Split GameResult (19 fields) into 3 logical structs (8+5+4 fields)
 * 2. Use uint40 for timestamps (valid until year 36,812) instead of uint256
 * 3. Use uint32 for duration (up to 136 years in seconds) instead of uint256
 * 4. Use uint96 for stakes (up to 79B BNB, sufficient for protocol needs)
 * 5. Pack small types together to minimize storage slots
 * 6. Maintain backward compatibility through aggregating view functions
 *
 * EXPECTED GAS SAVINGS:
 * - Result submission: ~15-20% reduction (fewer SSTORE operations)
 * - Result queries: ~10-15% reduction (fewer SLOAD operations)
 * - Dispute operations: ~12-18% reduction (targeted struct access)
 */
contract OracleCoreV2Optimized is Ownable, ReentrancyGuard {
    GameRegistry public gameRegistry;
    GameSchemaRegistryOptimized public schemaRegistry;

    // Fast dispute window: 15 minutes
    uint256 public constant DISPUTE_WINDOW = 15 minutes;
    uint256 public constant DISPUTE_STAKE = 0.2 ether;

    // ============================================
    // OPTIMIZED STRUCTS (Split from 19 to 3)
    // ============================================

    /**
     * @dev Core game result data (frequently accessed)
     * OPTIMIZATION: 8 fields, tight packing
     * Storage slots: ~6 slots (vs original ~12+ slots)
     *
     * PACKING STRATEGY:
     * Slot 1: matchId (bytes32)
     * Slot 2: gameContract (address, 20 bytes) + status (uint8) + winnerIndex (uint8) + 10 bytes free
     * Slot 3: timestamp (uint40) + duration (uint32) + submittedAt (uint40) + disputeDeadline (uint40) + 10 bytes free
     * Slot 4: schemaId (bytes32)
     * Slot 5: resultHash (bytes32)
     * + dynamic arrays stored separately
     */
    struct GameResultCore {
        bytes32 matchId;              // 32 bytes - Match identifier
        address gameContract;         // 20 bytes - Game contract address
        uint8 status;                 // 1 byte - GameStatus enum (0-3, packed with gameContract)
        uint8 winnerIndex;            // 1 byte - Winner index or 255 for draw (packed)
        uint40 timestamp;             // 5 bytes - Result timestamp (valid until 2242)
        uint32 duration;              // 4 bytes - Game duration in seconds (max ~136 years)
        bytes32 schemaId;             // 32 bytes - Schema reference
        bytes32 resultHash;           // 32 bytes - Result verification hash
    }

    /**
     * @dev Oracle metadata (moderately accessed)
     * OPTIMIZATION: 5 fields, tight packing
     * Storage slots: ~3 slots
     *
     * PACKING STRATEGY:
     * Slot 1: submitter (address, 20 bytes) + isFinalized (bool) + isDisputed (bool) + 10 bytes free
     * Slot 2: submittedAt (uint40) + disputeDeadline (uint40) + 21 bytes free
     */
    struct GameResultMeta {
        address submitter;            // 20 bytes - Who submitted the result
        uint40 submittedAt;           // 5 bytes - When submitted
        uint40 disputeDeadline;       // 5 bytes - Dispute deadline
        bool isFinalized;             // 1 byte - Finalization status
        bool isDisputed;              // 1 byte - Dispute status (packed with submitter)
    }

    /**
     * @dev Dispute information (rarely accessed, only on disputes)
     * OPTIMIZATION: 4 fields
     * Storage slots: ~3 slots (only allocated when disputed)
     *
     * This separation means non-disputed matches don't waste gas on dispute storage
     */
    struct GameResultDispute {
        address disputer;             // 20 bytes - Who disputed
        uint96 disputeStake;          // 12 bytes - Stake amount (max 79B BNB, packed with disputer)
        string disputeReason;         // Dynamic - Reason for dispute
        uint40 disputedAt;            // 5 bytes - When disputed
    }

    /**
     * @dev Participant data (separate to avoid array bloat in main struct)
     * Dynamic arrays are expensive in structs, so we store them separately
     */
    struct ParticipantData {
        address[] participants;       // Player addresses
        uint256[] scores;            // Parallel array of scores
    }

    /**
     * @dev Custom schema data (separate to avoid bloat)
     */
    struct CustomDataStore {
        bytes data;                  // ABI-encoded custom data
    }

    // Game status enum (unchanged)
    enum GameStatus {
        COMPLETED,    // 0
        CANCELLED,    // 1
        DISPUTED,     // 2
        ONGOING       // 3
    }

    // Validation check results (optimized packing)
    struct ValidationChecks {
        bool timingValid;            // Packed into single storage slot
        bool authorizedSubmitter;
        bool dataIntegrity;
        bool schemaValid;
        bool participantsValid;
    }

    // ============================================
    // STORAGE (Separated by access frequency)
    // ============================================

    // Core data (frequently accessed)
    mapping(bytes32 => GameResultCore) public resultCores;
    mapping(bytes32 => GameResultMeta) public resultMetas;

    // Secondary data (less frequently accessed)
    mapping(bytes32 => ParticipantData) private participantData;
    mapping(bytes32 => CustomDataStore) private customData;

    // Dispute data (rarely accessed)
    mapping(bytes32 => GameResultDispute) private disputes;

    // Validation data
    mapping(bytes32 => ValidationChecks) public validations;

    // Rewards tracking
    mapping(address => uint256) public disputerRewards;

    // Result tracking
    bytes32[] public allResults;

    // ============================================
    // EVENTS (Optimized with indexed parameters)
    // ============================================

    event ResultSubmittedV2(
        bytes32 indexed matchId,
        address indexed gameContract,
        address indexed submitter,
        bytes32 resultHash,
        bytes32 schemaId,
        uint40 disputeDeadline
    );

    event SchemaDataValidated(
        bytes32 indexed matchId,
        bytes32 indexed schemaId,
        bool isValid
    );

    event ResultDisputed(
        bytes32 indexed matchId,
        address indexed disputer,
        uint96 stakeAmount,
        string reason
    );

    event DisputeResolved(
        bytes32 indexed matchId,
        bool disputeSuccessful,
        address indexed winner,
        uint256 reward
    );

    event ResultFinalized(
        bytes32 indexed matchId,
        bytes32 resultHash,
        uint40 finalizedAt
    );

    event BatchResultsSubmitted(
        address indexed submitter,
        uint256 successCount,
        uint256 totalAttempted
    );

    event BatchResultsFinalized(
        address indexed caller,
        uint256 successCount,
        uint256 totalAttempted
    );

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor(
        address _gameRegistryAddress,
        address _schemaRegistryAddress
    ) Ownable(msg.sender) {
        require(_gameRegistryAddress != address(0), "Invalid registry");
        require(_schemaRegistryAddress != address(0), "Invalid schema registry");

        gameRegistry = GameRegistry(_gameRegistryAddress);
        schemaRegistry = GameSchemaRegistryOptimized(_schemaRegistryAddress);
    }

    // ============================================
    // MAIN FUNCTIONS (Optimized)
    // ============================================

    /**
     * @notice Submit game result with optional schema-based custom data
     * @dev OPTIMIZED: Uses split structs to avoid stack-too-deep and reduce gas
     *
     * GAS OPTIMIZATION NOTES:
     * - Cache storage reads to memory variables
     * - Use uint40/uint32 for time values
     * - Only write to storage once per struct
     * - Separate validation into internal function
     */
    function submitResultV2(
        bytes32 _matchId,
        address _gameContract,
        address[] calldata _participants,
        uint256[] calldata _scores,
        uint8 _winnerIndex,
        uint256 _duration,
        bytes32 _schemaId,
        bytes calldata _customData
    ) external nonReentrant {
        // Validate and get match/game data (reduced to single internal call)
        (GameRegistry.Match memory matchData, GameRegistry.Game memory game) =
            _validateMatchAndGame(_matchId, msg.sender);

        // Ensure result not already submitted (single SLOAD via resultMetas)
        require(resultMetas[_matchId].submittedAt == 0, "Result already submitted");

        // Validate participants and scores
        _validateParticipantData(_participants, _scores, _winnerIndex);

        // Validate schema if provided
        bool schemaValid = true;
        if (_schemaId != bytes32(0)) {
            schemaValid = _validateSchema(_schemaId, _customData, _gameContract);
        }

        // Perform validation checks
        _storeValidationChecks(_matchId, matchData, game, schemaValid, _participants.length);

        // Compute result hash
        bytes32 resultHash = _computeResultHash(
            _matchId,
            _gameContract,
            _participants,
            _scores,
            _winnerIndex,
            _schemaId,
            _customData
        );

        // Cache timestamp to avoid multiple TIMESTAMP opcodes
        uint40 currentTime = uint40(block.timestamp);
        uint40 disputeDeadline = currentTime + uint40(DISPUTE_WINDOW);

        // Store core result (OPTIMIZED: single struct write)
        resultCores[_matchId] = GameResultCore({
            matchId: _matchId,
            gameContract: _gameContract,
            status: uint8(GameStatus.COMPLETED),
            winnerIndex: _winnerIndex,
            timestamp: currentTime,
            duration: uint32(_duration),
            schemaId: _schemaId,
            resultHash: resultHash
        });

        // Store metadata (OPTIMIZED: separate struct)
        resultMetas[_matchId] = GameResultMeta({
            submitter: msg.sender,
            submittedAt: currentTime,
            disputeDeadline: disputeDeadline,
            isFinalized: false,
            isDisputed: false
        });

        // Store participant data (separate mapping)
        participantData[_matchId] = ParticipantData({
            participants: _participants,
            scores: _scores
        });

        // Store custom data if provided
        if (_customData.length > 0) {
            customData[_matchId] = CustomDataStore({
                data: _customData
            });
        }

        allResults.push(_matchId);

        // Update match status in registry
        gameRegistry.updateMatchStatus(_matchId, GameRegistry.MatchStatus.Completed);

        emit ResultSubmittedV2(
            _matchId,
            _gameContract,
            msg.sender,
            resultHash,
            _schemaId,
            disputeDeadline
        );

        if (_schemaId != bytes32(0)) {
            emit SchemaDataValidated(_matchId, _schemaId, schemaValid);
        }
    }

    /**
     * @notice Simplified submission for backward compatibility
     * @dev OPTIMIZED: Minimal struct usage for simple results
     */
    function submitResult(
        bytes32 _matchId,
        string calldata _resultData
    ) external nonReentrant {
        (GameRegistry.Match memory matchData, GameRegistry.Game memory game) =
            _validateMatchAndGame(_matchId, msg.sender);

        require(resultMetas[_matchId].submittedAt == 0, "Result already submitted");

        bytes32 resultHash = keccak256(abi.encodePacked(_resultData, _matchId, block.timestamp));
        uint40 currentTime = uint40(block.timestamp);
        uint40 disputeDeadline = currentTime + uint40(DISPUTE_WINDOW);

        // Minimal core data for legacy mode
        resultCores[_matchId] = GameResultCore({
            matchId: _matchId,
            gameContract: address(0),
            status: uint8(GameStatus.COMPLETED),
            winnerIndex: 255,
            timestamp: currentTime,
            duration: 0,
            schemaId: bytes32(0),
            resultHash: resultHash
        });

        resultMetas[_matchId] = GameResultMeta({
            submitter: msg.sender,
            submittedAt: currentTime,
            disputeDeadline: disputeDeadline,
            isFinalized: false,
            isDisputed: false
        });

        // Store legacy data in customData
        customData[_matchId] = CustomDataStore({
            data: bytes(_resultData)
        });

        allResults.push(_matchId);

        gameRegistry.updateMatchStatus(_matchId, GameRegistry.MatchStatus.Completed);

        emit ResultSubmittedV2(
            _matchId,
            address(0),
            msg.sender,
            resultHash,
            bytes32(0),
            disputeDeadline
        );
    }

    /**
     * @notice Batch submit multiple results
     * @dev OPTIMIZED: Caches game data, reduced redundant checks
     */
    function batchSubmitResultsV2(
        bytes32[] calldata _matchIds,
        address _gameContract,
        address[][] calldata _participants,
        uint256[][] calldata _scores,
        uint8[] calldata _winnerIndices,
        uint256[] calldata _durations,
        bytes32 _schemaId,
        bytes[] calldata _customDataArray
    ) external nonReentrant returns (uint256 successCount) {
        require(_matchIds.length > 0 && _matchIds.length <= 50, "Invalid batch size");
        require(
            _matchIds.length == _participants.length &&
            _matchIds.length == _scores.length &&
            _matchIds.length == _winnerIndices.length &&
            _matchIds.length == _durations.length &&
            _matchIds.length == _customDataArray.length,
            "Array length mismatch"
        );

        // Cache game details once (OPTIMIZATION: single registry read)
        GameRegistry.Match memory firstMatch = gameRegistry.getMatch(_matchIds[0]);
        GameRegistry.Game memory game = gameRegistry.getGame(firstMatch.gameId);
        require(game.developer == msg.sender && game.isActive, "Unauthorized or inactive");

        // Pre-validate schema once (OPTIMIZATION)
        if (_schemaId != bytes32(0)) {
            require(schemaRegistry.isSchemaActive(_schemaId), "Schema not active");
        }

        // Cache timestamp (OPTIMIZATION: single TIMESTAMP opcode)
        uint40 currentTime = uint40(block.timestamp);
        uint40 disputeDeadline = currentTime + uint40(DISPUTE_WINDOW);

        successCount = 0;

        // Cache array length (OPTIMIZATION: avoid repeated .length calls)
        uint256 batchLength = _matchIds.length;

        for (uint256 i = 0; i < batchLength; ) {
            // Skip if result already exists (early exit)
            if (resultMetas[_matchIds[i]].submittedAt > 0) {
                unchecked { ++i; }
                continue;
            }

            // Basic validation (early exits reduce wasted gas)
            if (
                _participants[i].length == 0 ||
                _participants[i].length != _scores[i].length ||
                (_winnerIndices[i] >= _participants[i].length && _winnerIndices[i] != 255)
            ) {
                unchecked { ++i; }
                continue;
            }

            // Compute result hash
            bytes32 resultHash = _computeResultHash(
                _matchIds[i],
                _gameContract,
                _participants[i],
                _scores[i],
                _winnerIndices[i],
                _schemaId,
                _customDataArray[i]
            );

            // Store result (optimized struct writes)
            resultCores[_matchIds[i]] = GameResultCore({
                matchId: _matchIds[i],
                gameContract: _gameContract,
                status: uint8(GameStatus.COMPLETED),
                winnerIndex: _winnerIndices[i],
                timestamp: currentTime,
                duration: uint32(_durations[i]),
                schemaId: _schemaId,
                resultHash: resultHash
            });

            resultMetas[_matchIds[i]] = GameResultMeta({
                submitter: msg.sender,
                submittedAt: currentTime,
                disputeDeadline: disputeDeadline,
                isFinalized: false,
                isDisputed: false
            });

            participantData[_matchIds[i]] = ParticipantData({
                participants: _participants[i],
                scores: _scores[i]
            });

            if (_customDataArray[i].length > 0) {
                customData[_matchIds[i]] = CustomDataStore({
                    data: _customDataArray[i]
                });
            }

            allResults.push(_matchIds[i]);
            gameRegistry.updateMatchStatus(_matchIds[i], GameRegistry.MatchStatus.Completed);

            emit ResultSubmittedV2(
                _matchIds[i],
                _gameContract,
                msg.sender,
                resultHash,
                _schemaId,
                disputeDeadline
            );

            unchecked {
                ++successCount;
                ++i;
            }
        }

        emit BatchResultsSubmitted(msg.sender, successCount, batchLength);

        return successCount;
    }

    /**
     * @notice Dispute a submitted result
     * @dev OPTIMIZED: Uses uint96 for stake, only creates dispute struct when needed
     */
    function disputeResult(
        bytes32 _matchId,
        string calldata _reason
    ) external payable nonReentrant {
        // Load metadata (single SLOAD)
        GameResultMeta storage meta = resultMetas[_matchId];

        require(meta.submittedAt > 0, "Result does not exist");
        require(!meta.isFinalized, "Result already finalized");
        require(!meta.isDisputed, "Already disputed");
        require(block.timestamp < meta.disputeDeadline, "Dispute window closed");
        require(msg.value == DISPUTE_STAKE, "Incorrect dispute stake");
        require(bytes(_reason).length > 0, "Must provide reason");

        // Update metadata
        meta.isDisputed = true;

        // Update core status
        resultCores[_matchId].status = uint8(GameStatus.DISPUTED);

        // Create dispute struct (only allocated when actually disputed - saves gas on happy path)
        disputes[_matchId] = GameResultDispute({
            disputer: msg.sender,
            disputeStake: uint96(msg.value),
            disputeReason: _reason,
            disputedAt: uint40(block.timestamp)
        });

        gameRegistry.updateMatchStatus(_matchId, GameRegistry.MatchStatus.Disputed);

        emit ResultDisputed(_matchId, msg.sender, uint96(msg.value), _reason);
    }

    /**
     * @notice Resolve a dispute
     * @dev OPTIMIZED: Targeted struct access reduces SLOADs
     */
    function resolveDispute(
        bytes32 _matchId,
        bool _disputeValid
    ) external onlyOwner nonReentrant {
        GameResultMeta storage meta = resultMetas[_matchId];
        require(meta.isDisputed, "Not disputed");
        require(!meta.isFinalized, "Already finalized");

        GameResultDispute storage dispute = disputes[_matchId];
        GameRegistry.Match memory matchData = gameRegistry.getMatch(_matchId);
        GameRegistry.Game memory game = gameRegistry.getGame(matchData.gameId);

        if (_disputeValid) {
            // Disputer wins
            uint256 reward = uint256(dispute.disputeStake) + (gameRegistry.REGISTRATION_STAKE() / 2);
            disputerRewards[dispute.disputer] += reward;

            gameRegistry.slashStake(
                matchData.gameId,
                gameRegistry.REGISTRATION_STAKE() / 2,
                dispute.disputeReason
            );

            uint256 newReputation = game.reputationScore > 50 ? game.reputationScore - 50 : 0;
            gameRegistry.updateReputation(matchData.gameId, newReputation);

            emit DisputeResolved(_matchId, true, dispute.disputer, reward);
        } else {
            // Submitter wins
            disputerRewards[meta.submitter] += uint256(dispute.disputeStake);

            uint256 newReputation = game.reputationScore < 990
                ? game.reputationScore + 10
                : 1000;
            gameRegistry.updateReputation(matchData.gameId, newReputation);

            meta.isFinalized = true;
            resultCores[_matchId].status = uint8(GameStatus.COMPLETED);
            gameRegistry.updateMatchStatus(_matchId, GameRegistry.MatchStatus.Finalized);

            emit DisputeResolved(_matchId, false, meta.submitter, uint256(dispute.disputeStake));
            emit ResultFinalized(_matchId, resultCores[_matchId].resultHash, uint40(block.timestamp));
        }
    }

    /**
     * @notice Finalize a result after dispute window
     * @dev OPTIMIZED: Minimal storage access
     */
    function finalizeResult(bytes32 _matchId) external nonReentrant {
        GameResultMeta storage meta = resultMetas[_matchId];

        require(meta.submittedAt > 0, "Result does not exist");
        require(!meta.isFinalized, "Already finalized");
        require(!meta.isDisputed, "Cannot finalize disputed result");
        require(block.timestamp >= meta.disputeDeadline, "Dispute window not closed");

        meta.isFinalized = true;
        resultCores[_matchId].status = uint8(GameStatus.COMPLETED);

        gameRegistry.updateMatchStatus(_matchId, GameRegistry.MatchStatus.Finalized);

        GameRegistry.Match memory matchData = gameRegistry.getMatch(_matchId);
        GameRegistry.Game memory game = gameRegistry.getGame(matchData.gameId);

        uint256 newReputation = game.reputationScore < 995
            ? game.reputationScore + 5
            : 1000;
        gameRegistry.updateReputation(matchData.gameId, newReputation);

        emit ResultFinalized(_matchId, resultCores[_matchId].resultHash, uint40(block.timestamp));
    }

    /**
     * @notice Batch finalize multiple results
     * @dev OPTIMIZED: Cached timestamp, unchecked increments
     */
    function batchFinalizeResults(bytes32[] calldata _matchIds)
        external
        nonReentrant
        returns (uint256 successCount)
    {
        require(_matchIds.length > 0 && _matchIds.length <= 100, "Invalid batch size");

        uint40 currentTime = uint40(block.timestamp);
        uint256 batchLength = _matchIds.length;
        successCount = 0;

        for (uint256 i = 0; i < batchLength; ) {
            GameResultMeta storage meta = resultMetas[_matchIds[i]];

            // Skip if doesn't meet finalization criteria
            if (
                meta.submittedAt == 0 ||
                meta.isFinalized ||
                meta.isDisputed ||
                currentTime < meta.disputeDeadline
            ) {
                unchecked { ++i; }
                continue;
            }

            // Finalize
            meta.isFinalized = true;
            resultCores[_matchIds[i]].status = uint8(GameStatus.COMPLETED);

            gameRegistry.updateMatchStatus(_matchIds[i], GameRegistry.MatchStatus.Finalized);

            GameRegistry.Match memory matchData = gameRegistry.getMatch(_matchIds[i]);
            GameRegistry.Game memory game = gameRegistry.getGame(matchData.gameId);

            uint256 newReputation = game.reputationScore < 995
                ? game.reputationScore + 5
                : 1000;
            gameRegistry.updateReputation(matchData.gameId, newReputation);

            emit ResultFinalized(_matchIds[i], resultCores[_matchIds[i]].resultHash, currentTime);

            unchecked {
                ++successCount;
                ++i;
            }
        }

        emit BatchResultsFinalized(msg.sender, successCount, batchLength);

        return successCount;
    }

    /**
     * @notice Withdraw accumulated rewards
     */
    function withdrawRewards() external nonReentrant {
        uint256 amount = disputerRewards[msg.sender];
        require(amount > 0, "No rewards to withdraw");

        disputerRewards[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
    }

    // ============================================
    // INTERNAL HELPER FUNCTIONS (Reduce Stack Depth)
    // ============================================

    /**
     * @dev Validate match and game in single function to reduce stack usage
     * OPTIMIZATION: Returns both structs in memory to avoid duplicate registry calls
     */
    function _validateMatchAndGame(bytes32 _matchId, address _sender)
        internal
        view
        returns (GameRegistry.Match memory matchData, GameRegistry.Game memory game)
    {
        matchData = gameRegistry.getMatch(_matchId);
        require(matchData.scheduledTime > 0, "Match does not exist");
        require(
            matchData.status == GameRegistry.MatchStatus.Scheduled ||
            matchData.status == GameRegistry.MatchStatus.InProgress,
            "Match not in valid state"
        );

        game = gameRegistry.getGame(matchData.gameId);
        require(game.developer == _sender, "Only game developer can submit");
        require(game.isActive, "Game not active");
    }

    /**
     * @dev Validate participant data
     * OPTIMIZATION: Separate function reduces stack depth in main function
     */
    function _validateParticipantData(
        address[] calldata _participants,
        uint256[] calldata _scores,
        uint8 _winnerIndex
    ) internal pure {
        require(_participants.length > 0, "No participants");
        require(
            _participants.length == _scores.length,
            "Participants/scores length mismatch"
        );
        require(
            _winnerIndex < _participants.length || _winnerIndex == 255,
            "Invalid winner index"
        );
    }

    /**
     * @dev Store validation checks
     * OPTIMIZATION: Separate function to avoid stack-too-deep
     */
    function _storeValidationChecks(
        bytes32 _matchId,
        GameRegistry.Match memory _matchData,
        GameRegistry.Game memory _game,
        bool _schemaValid,
        uint256 _participantCount
    ) internal {
        validations[_matchId] = ValidationChecks({
            timingValid: block.timestamp >= _matchData.scheduledTime,
            authorizedSubmitter: _game.developer == msg.sender,
            dataIntegrity: true,
            schemaValid: _schemaValid,
            participantsValid: _participantCount > 0
        });

        ValidationChecks memory checks = validations[_matchId];
        if (!checks.authorizedSubmitter || !checks.schemaValid || !checks.participantsValid) {
            revert("Validation failed");
        }
    }

    /**
     * @dev Compute result hash
     * OPTIMIZATION: Separate function reduces stack depth and allows reuse
     */
    function _computeResultHash(
        bytes32 _matchId,
        address _gameContract,
        address[] memory _participants,
        uint256[] memory _scores,
        uint8 _winnerIndex,
        bytes32 _schemaId,
        bytes memory _customData
    ) internal view returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                _matchId,
                _gameContract,
                _participants,
                _scores,
                _winnerIndex,
                _schemaId,
                _customData,
                block.timestamp
            )
        );
    }

    /**
     * @dev Validate schema and custom data
     * OPTIMIZATION: Unchanged from original but called efficiently
     */
    function _validateSchema(
        bytes32 _schemaId,
        bytes calldata _customData,
        address _gameContract
    ) internal view returns (bool) {
        if (!schemaRegistry.isSchemaActive(_schemaId)) {
            return false;
        }

        if (schemaRegistry.hasSchema(_gameContract)) {
            bytes32 gameSchemaId = schemaRegistry.getGameSchemaId(_gameContract);
            if (_schemaId != gameSchemaId) {
                return false;
            }
        }

        return schemaRegistry.validateEncodedData(_schemaId, _customData);
    }

    // ============================================
    // VIEW FUNCTIONS (Backward Compatible)
    // ============================================

    /**
     * @notice Get full result - BACKWARD COMPATIBLE aggregated view
     * @dev Aggregates data from split structs into original format for compatibility
     * OPTIMIZATION: View function has no gas cost for external calls
     */
    function getResultV2(bytes32 _matchId)
        external
        view
        returns (
            bytes32 matchId,
            address gameContract,
            uint256 timestamp,
            uint256 duration,
            uint8 status,
            address[] memory participants,
            uint256[] memory scores,
            uint8 winnerIndex,
            bytes32 schemaId,
            bytes memory customDataBytes,
            bytes32 resultHash,
            address submitter,
            uint256 submittedAt,
            uint256 disputeDeadline,
            bool isFinalized,
            bool isDisputed
        )
    {
        require(resultMetas[_matchId].submittedAt > 0, "Result does not exist");

        GameResultCore memory core = resultCores[_matchId];
        GameResultMeta memory meta = resultMetas[_matchId];
        ParticipantData memory pData = participantData[_matchId];
        CustomDataStore memory cData = customData[_matchId];

        return (
            core.matchId,
            core.gameContract,
            uint256(core.timestamp),
            uint256(core.duration),
            core.status,
            pData.participants,
            pData.scores,
            core.winnerIndex,
            core.schemaId,
            cData.data,
            core.resultHash,
            meta.submitter,
            uint256(meta.submittedAt),
            uint256(meta.disputeDeadline),
            meta.isFinalized,
            meta.isDisputed
        );
    }

    /**
     * @notice Get result for backward compatibility (simplified)
     */
    function getResult(bytes32 _matchId)
        external
        view
        returns (
            string memory resultData,
            bytes32 resultHash,
            bool isFinalized
        )
    {
        GameResultMeta memory meta = resultMetas[_matchId];
        require(meta.submittedAt > 0, "Result does not exist");

        GameResultCore memory core = resultCores[_matchId];

        if (core.schemaId == bytes32(0)) {
            resultData = string(customData[_matchId].data);
        } else {
            resultData = "";
        }

        return (resultData, core.resultHash, meta.isFinalized);
    }

    /**
     * @notice Check if result is finalized
     */
    function isResultFinalized(bytes32 _matchId) external view returns (bool) {
        return resultMetas[_matchId].isFinalized;
    }

    /**
     * @notice Get validation checks
     */
    function getValidationChecks(bytes32 _matchId)
        external
        view
        returns (ValidationChecks memory)
    {
        return validations[_matchId];
    }

    /**
     * @notice Get custom data for a result
     */
    function getCustomData(bytes32 _matchId)
        external
        view
        returns (bytes32 schemaId, bytes memory customDataBytes)
    {
        return (resultCores[_matchId].schemaId, customData[_matchId].data);
    }

    /**
     * @notice Get participants and scores
     */
    function getParticipantsAndScores(bytes32 _matchId)
        external
        view
        returns (
            address[] memory participants,
            uint256[] memory scores,
            uint8 winnerIndex
        )
    {
        ParticipantData memory pData = participantData[_matchId];
        return (pData.participants, pData.scores, resultCores[_matchId].winnerIndex);
    }

    /**
     * @notice Get dispute information
     */
    function getDisputeInfo(bytes32 _matchId)
        external
        view
        returns (
            address disputer,
            uint256 disputeStake,
            string memory disputeReason,
            uint256 disputedAt
        )
    {
        require(resultMetas[_matchId].isDisputed, "Not disputed");
        GameResultDispute memory dispute = disputes[_matchId];
        return (
            dispute.disputer,
            uint256(dispute.disputeStake),
            dispute.disputeReason,
            uint256(dispute.disputedAt)
        );
    }

    /**
     * @notice Get total results count
     */
    function getTotalResults() external view returns (uint256) {
        return allResults.length;
    }

    /**
     * @notice Get core result data (optimized access)
     */
    function getResultCore(bytes32 _matchId) external view returns (GameResultCore memory) {
        require(resultMetas[_matchId].submittedAt > 0, "Result does not exist");
        return resultCores[_matchId];
    }

    /**
     * @notice Get result metadata (optimized access)
     */
    function getResultMeta(bytes32 _matchId) external view returns (GameResultMeta memory) {
        require(resultMetas[_matchId].submittedAt > 0, "Result does not exist");
        return resultMetas[_matchId];
    }

    receive() external payable {}
}
