// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./GameRegistry.sol";
import "./GameSchemaRegistry.sol";

/**
 * @title OracleCoreV2
 * @notice Enhanced oracle with schema support for rich game data
 * @dev Supports both simple results (backward compatible) and schema-based custom data
 * @dev Includes emergency pause functionality for security
 */
contract OracleCoreV2 is Ownable, ReentrancyGuard, Pausable {
    GameRegistry public gameRegistry;
    GameSchemaRegistry public schemaRegistry;

    // Fast dispute window: 15 minutes (vs UMA's 24-48 hours)
    uint256 public constant DISPUTE_WINDOW = 15 minutes;

    // Dispute stake must be 2x registration stake
    uint256 public constant DISPUTE_STAKE = 0.2 ether;

    // Enhanced game result with schema support
    struct GameResult {
        bytes32 matchId;
        address gameContract;
        uint256 timestamp;
        uint256 duration;
        GameStatus status;

        // Participants (flexible arrays)
        address[] participants;
        uint256[] scores;           // Parallel array to participants
        uint8 winnerIndex;          // 255 = draw/no winner

        // Schema-based custom data
        bytes32 schemaId;           // References registered schema (0 if no custom data)
        bytes customData;           // ABI-encoded according to schema

        // Oracle metadata
        bytes32 resultHash;
        address submitter;
        uint256 submittedAt;
        uint256 disputeDeadline;
        bool isFinalized;
        bool isDisputed;
        address disputer;
        uint256 disputeStake;
        string disputeReason;
    }

    enum GameStatus {
        COMPLETED,
        CANCELLED,
        DISPUTED,
        ONGOING
    }

    // Validation check results
    struct ValidationChecks {
        bool timingValid;
        bool authorizedSubmitter;
        bool dataIntegrity;
        bool schemaValid;           // New: Schema validation
        bool participantsValid;
    }

    // Storage
    mapping(bytes32 => GameResult) public results;
    mapping(bytes32 => ValidationChecks) public validations;
    mapping(address => uint256) public disputerRewards;

    bytes32[] public allResults;

    // Events
    event ResultSubmittedV2(
        bytes32 indexed matchId,
        address indexed gameContract,
        address indexed submitter,
        bytes32 resultHash,
        bytes32 schemaId,
        uint256 disputeDeadline
    );

    event SchemaDataValidated(
        bytes32 indexed matchId,
        bytes32 indexed schemaId,
        bool isValid
    );

    event ResultDisputed(
        bytes32 indexed matchId,
        address indexed disputer,
        uint256 stakeAmount,
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
        uint256 finalizedAt
    );

    constructor(
        address _gameRegistryAddress,
        address _schemaRegistryAddress
    ) Ownable(msg.sender) {
        require(_gameRegistryAddress != address(0), "OracleCoreV2: Invalid registry");
        require(_schemaRegistryAddress != address(0), "OracleCoreV2: Invalid schema registry");

        gameRegistry = GameRegistry(_gameRegistryAddress);
        schemaRegistry = GameSchemaRegistry(_schemaRegistryAddress);
    }

    /**
     * @notice Submit game result with optional schema-based custom data
     * @param _matchId The match this result is for
     * @param _gameContract Address of the game contract
     * @param _participants Array of participant addresses
     * @param _scores Array of scores (parallel to participants)
     * @param _winnerIndex Index of winner in participants array (255 for draw)
     * @param _duration Game duration in seconds
     * @param _schemaId Schema ID for custom data (0 for no custom data)
     * @param _customData ABI-encoded custom data according to schema
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
    ) external nonReentrant whenNotPaused {
        // Get match details from registry
        GameRegistry.Match memory matchData = gameRegistry.getMatch(_matchId);
        require(matchData.scheduledTime > 0, "OracleCoreV2: Match does not exist");
        require(
            matchData.status == GameRegistry.MatchStatus.Scheduled ||
            matchData.status == GameRegistry.MatchStatus.InProgress,
            "OracleCoreV2: Match not in valid state"
        );

        // Get game details
        GameRegistry.Game memory game = gameRegistry.getGame(matchData.gameId);
        require(game.developer == msg.sender, "OracleCoreV2: Only game developer can submit");
        require(game.isActive, "OracleCoreV2: Game not active");

        // Ensure result not already submitted
        require(results[_matchId].submittedAt == 0, "OracleCoreV2: Result already submitted");

        // Validate participants and scores
        require(_participants.length > 0, "OracleCoreV2: No participants");
        require(
            _participants.length == _scores.length,
            "OracleCoreV2: Participants/scores length mismatch"
        );
        require(
            _winnerIndex < _participants.length || _winnerIndex == 255,
            "OracleCoreV2: Invalid winner index"
        );

        // Validate schema if provided
        bool schemaValid = true;
        if (_schemaId != bytes32(0)) {
            schemaValid = _validateSchema(_schemaId, _customData, _gameContract);
        }

        // Compute result hash
        bytes32 resultHash = keccak256(
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

        // Perform validation checks
        ValidationChecks memory checks = ValidationChecks({
            timingValid: block.timestamp >= matchData.scheduledTime,
            authorizedSubmitter: game.developer == msg.sender,
            dataIntegrity: true,
            schemaValid: schemaValid,
            participantsValid: _participants.length > 0
        });

        validations[_matchId] = checks;

        // If critical checks fail, reject
        if (!checks.authorizedSubmitter || !checks.schemaValid || !checks.participantsValid) {
            revert("OracleCoreV2: Validation failed");
        }

        // Store result
        uint256 disputeDeadline = block.timestamp + DISPUTE_WINDOW;

        GameResult storage result = results[_matchId];
        result.matchId = _matchId;
        result.gameContract = _gameContract;
        result.timestamp = block.timestamp;
        result.duration = _duration;
        result.status = GameStatus.COMPLETED;
        result.participants = _participants;
        result.scores = _scores;
        result.winnerIndex = _winnerIndex;
        result.schemaId = _schemaId;
        result.customData = _customData;
        result.resultHash = resultHash;
        result.submitter = msg.sender;
        result.submittedAt = block.timestamp;
        result.disputeDeadline = disputeDeadline;
        result.isFinalized = false;
        result.isDisputed = false;

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
     * @notice Simplified submission for games without custom data (backward compatible)
     * @param _matchId The match this result is for
     * @param _resultData Legacy JSON string (for backward compatibility)
     */
    function submitResult(
        bytes32 _matchId,
        string calldata _resultData
    ) external nonReentrant whenNotPaused {
        // This is a simplified wrapper that creates a basic GameResult
        // with no participants/scores tracking, for backward compatibility

        GameRegistry.Match memory matchData = gameRegistry.getMatch(_matchId);
        require(matchData.scheduledTime > 0, "OracleCoreV2: Match does not exist");

        GameRegistry.Game memory game = gameRegistry.getGame(matchData.gameId);
        require(game.developer == msg.sender, "OracleCoreV2: Only game developer can submit");

        require(results[_matchId].submittedAt == 0, "OracleCoreV2: Result already submitted");

        bytes32 resultHash = keccak256(abi.encodePacked(_resultData, _matchId, block.timestamp));
        uint256 disputeDeadline = block.timestamp + DISPUTE_WINDOW;

        GameResult storage result = results[_matchId];
        result.matchId = _matchId;
        result.gameContract = address(0);
        result.timestamp = block.timestamp;
        result.duration = 0;
        result.status = GameStatus.COMPLETED;
        result.winnerIndex = 255; // No winner tracking in legacy mode
        result.schemaId = bytes32(0);
        result.customData = bytes(_resultData); // Store legacy data in customData
        result.resultHash = resultHash;
        result.submitter = msg.sender;
        result.submittedAt = block.timestamp;
        result.disputeDeadline = disputeDeadline;
        result.isFinalized = false;
        result.isDisputed = false;

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
     * @notice Batch submit multiple results (saves gas for tournaments/bulk uploads)
     * @param _matchIds Array of match IDs
     * @param _gameContract Game contract address (same for all)
     * @param _participants Array of participant arrays
     * @param _scores Array of score arrays
     * @param _winnerIndices Array of winner indices
     * @param _durations Array of durations
     * @param _schemaId Schema ID (same for all results)
     * @param _customDataArray Array of custom data
     * @return successCount Number of successfully submitted results
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
    ) external nonReentrant whenNotPaused returns (uint256 successCount) {
        require(_matchIds.length > 0, "OracleCoreV2: Empty batch");
        require(_matchIds.length <= 50, "OracleCoreV2: Batch too large");
        require(
            _matchIds.length == _participants.length &&
            _matchIds.length == _scores.length &&
            _matchIds.length == _winnerIndices.length &&
            _matchIds.length == _durations.length &&
            _matchIds.length == _customDataArray.length,
            "OracleCoreV2: Array length mismatch"
        );

        // Cache game details (same for all results in batch)
        GameRegistry.Match memory firstMatch = gameRegistry.getMatch(_matchIds[0]);
        GameRegistry.Game memory game = gameRegistry.getGame(firstMatch.gameId);
        require(game.developer == msg.sender, "OracleCoreV2: Only game developer can submit");
        require(game.isActive, "OracleCoreV2: Game not active");

        // Pre-validate schema once for all results
        bool schemaValid = true;
        if (_schemaId != bytes32(0)) {
            require(schemaRegistry.isSchemaActive(_schemaId), "OracleCoreV2: Schema not active");
        }

        uint256 disputeDeadline = block.timestamp + DISPUTE_WINDOW;
        successCount = 0;

        for (uint256 i = 0; i < _matchIds.length; i++) {
            // Skip if result already exists
            if (results[_matchIds[i]].submittedAt > 0) {
                continue;
            }

            // Get match data
            GameRegistry.Match memory matchData = gameRegistry.getMatch(_matchIds[i]);
            if (matchData.scheduledTime == 0) {
                continue; // Skip non-existent matches
            }

            // Basic validation
            if (
                _participants[i].length == 0 ||
                _participants[i].length != _scores[i].length ||
                (_winnerIndices[i] >= _participants[i].length && _winnerIndices[i] != 255)
            ) {
                continue; // Skip invalid data
            }

            // Validate schema data if provided
            if (_schemaId != bytes32(0)) {
                schemaValid = _validateSchema(_schemaId, _customDataArray[i], _gameContract);
                if (!schemaValid) {
                    continue; // Skip if schema validation fails
                }
            }

            // Compute result hash
            bytes32 resultHash = keccak256(
                abi.encodePacked(
                    _matchIds[i],
                    _gameContract,
                    _participants[i],
                    _scores[i],
                    _winnerIndices[i],
                    _schemaId,
                    _customDataArray[i],
                    block.timestamp
                )
            );

            // Store validation
            validations[_matchIds[i]] = ValidationChecks({
                timingValid: block.timestamp >= matchData.scheduledTime,
                authorizedSubmitter: true,
                dataIntegrity: true,
                schemaValid: schemaValid,
                participantsValid: _participants[i].length > 0
            });

            // Store result
            GameResult storage result = results[_matchIds[i]];
            result.matchId = _matchIds[i];
            result.gameContract = _gameContract;
            result.timestamp = block.timestamp;
            result.duration = _durations[i];
            result.status = GameStatus.COMPLETED;
            result.participants = _participants[i];
            result.scores = _scores[i];
            result.winnerIndex = _winnerIndices[i];
            result.schemaId = _schemaId;
            result.customData = _customDataArray[i];
            result.resultHash = resultHash;
            result.submitter = msg.sender;
            result.submittedAt = block.timestamp;
            result.disputeDeadline = disputeDeadline;
            result.isFinalized = false;
            result.isDisputed = false;

            allResults.push(_matchIds[i]);

            // Update match status
            gameRegistry.updateMatchStatus(_matchIds[i], GameRegistry.MatchStatus.Completed);

            // Emit event
            emit ResultSubmittedV2(
                _matchIds[i],
                _gameContract,
                msg.sender,
                resultHash,
                _schemaId,
                disputeDeadline
            );

            if (_schemaId != bytes32(0)) {
                emit SchemaDataValidated(_matchIds[i], _schemaId, schemaValid);
            }

            successCount++;
        }

        emit BatchResultsSubmitted(msg.sender, successCount, _matchIds.length);

        return successCount;
    }

    // Events for batch operations
    event BatchResultsSubmitted(
        address indexed submitter,
        uint256 successCount,
        uint256 totalAttempted
    );

    /**
     * @notice Dispute a submitted result
     * @param _matchId The match result to dispute
     * @param _reason Explanation for the dispute
     */
    function disputeResult(
        bytes32 _matchId,
        string calldata _reason
    ) external payable nonReentrant whenNotPaused {
        GameResult storage result = results[_matchId];
        require(result.submittedAt > 0, "OracleCoreV2: Result does not exist");
        require(!result.isFinalized, "OracleCoreV2: Result already finalized");
        require(!result.isDisputed, "OracleCoreV2: Already disputed");
        require(block.timestamp < result.disputeDeadline, "OracleCoreV2: Dispute window closed");
        require(msg.value == DISPUTE_STAKE, "OracleCoreV2: Incorrect dispute stake");
        require(bytes(_reason).length > 0, "OracleCoreV2: Must provide reason");

        result.isDisputed = true;
        result.disputer = msg.sender;
        result.disputeStake = msg.value;
        result.disputeReason = _reason;
        result.status = GameStatus.DISPUTED;

        gameRegistry.updateMatchStatus(_matchId, GameRegistry.MatchStatus.Disputed);

        emit ResultDisputed(_matchId, msg.sender, msg.value, _reason);
    }

    /**
     * @notice Resolve a dispute (called by owner/governance)
     * @param _matchId The disputed match
     * @param _disputeValid Whether the dispute is valid
     */
    function resolveDispute(
        bytes32 _matchId,
        bool _disputeValid
    ) external onlyOwner nonReentrant {
        GameResult storage result = results[_matchId];
        require(result.isDisputed, "OracleCoreV2: Not disputed");
        require(!result.isFinalized, "OracleCoreV2: Already finalized");

        GameRegistry.Match memory matchData = gameRegistry.getMatch(_matchId);
        GameRegistry.Game memory game = gameRegistry.getGame(matchData.gameId);

        if (_disputeValid) {
            // Disputer wins
            uint256 reward = result.disputeStake + (gameRegistry.REGISTRATION_STAKE() / 2);
            disputerRewards[result.disputer] += reward;

            gameRegistry.slashStake(
                matchData.gameId,
                gameRegistry.REGISTRATION_STAKE() / 2,
                result.disputeReason
            );

            uint256 newReputation = game.reputationScore > 50 ? game.reputationScore - 50 : 0;
            gameRegistry.updateReputation(matchData.gameId, newReputation);

            emit DisputeResolved(_matchId, true, result.disputer, reward);
        } else {
            // Submitter wins
            disputerRewards[result.submitter] += result.disputeStake;

            uint256 newReputation = game.reputationScore < 990
                ? game.reputationScore + 10
                : 1000;
            gameRegistry.updateReputation(matchData.gameId, newReputation);

            result.isFinalized = true;
            result.status = GameStatus.COMPLETED;
            gameRegistry.updateMatchStatus(_matchId, GameRegistry.MatchStatus.Finalized);

            emit DisputeResolved(_matchId, false, result.submitter, result.disputeStake);
            emit ResultFinalized(_matchId, result.resultHash, block.timestamp);
        }
    }

    /**
     * @notice Finalize a result after dispute window
     * @param _matchId The match to finalize
     */
    function finalizeResult(bytes32 _matchId) external nonReentrant whenNotPaused {
        GameResult storage result = results[_matchId];
        require(result.submittedAt > 0, "OracleCoreV2: Result does not exist");
        require(!result.isFinalized, "OracleCoreV2: Already finalized");
        require(!result.isDisputed, "OracleCoreV2: Cannot finalize disputed result");
        require(
            block.timestamp >= result.disputeDeadline,
            "OracleCoreV2: Dispute window not closed"
        );

        result.isFinalized = true;
        result.status = GameStatus.COMPLETED;

        gameRegistry.updateMatchStatus(_matchId, GameRegistry.MatchStatus.Finalized);

        GameRegistry.Match memory matchData = gameRegistry.getMatch(_matchId);
        GameRegistry.Game memory game = gameRegistry.getGame(matchData.gameId);

        uint256 newReputation = game.reputationScore < 995
            ? game.reputationScore + 5
            : 1000;
        gameRegistry.updateReputation(matchData.gameId, newReputation);

        emit ResultFinalized(_matchId, result.resultHash, block.timestamp);
    }

    /**
     * @notice Batch finalize multiple results (saves gas)
     * @param _matchIds Array of match IDs to finalize
     * @return successCount Number of successfully finalized results
     */
    function batchFinalizeResults(bytes32[] calldata _matchIds)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 successCount)
    {
        require(_matchIds.length > 0, "OracleCoreV2: Empty batch");
        require(_matchIds.length <= 100, "OracleCoreV2: Batch too large");

        successCount = 0;

        for (uint256 i = 0; i < _matchIds.length; i++) {
            GameResult storage result = results[_matchIds[i]];

            // Skip if doesn't exist, already finalized, or disputed
            if (
                result.submittedAt == 0 ||
                result.isFinalized ||
                result.isDisputed ||
                block.timestamp < result.disputeDeadline
            ) {
                continue;
            }

            // Finalize
            result.isFinalized = true;
            result.status = GameStatus.COMPLETED;

            gameRegistry.updateMatchStatus(_matchIds[i], GameRegistry.MatchStatus.Finalized);

            // Update reputation (small increase)
            GameRegistry.Match memory matchData = gameRegistry.getMatch(_matchIds[i]);
            GameRegistry.Game memory game = gameRegistry.getGame(matchData.gameId);

            uint256 newReputation = game.reputationScore < 995
                ? game.reputationScore + 5
                : 1000;
            gameRegistry.updateReputation(matchData.gameId, newReputation);

            emit ResultFinalized(_matchIds[i], result.resultHash, block.timestamp);

            successCount++;
        }

        emit BatchResultsFinalized(msg.sender, successCount, _matchIds.length);

        return successCount;
    }

    event BatchResultsFinalized(
        address indexed caller,
        uint256 successCount,
        uint256 totalAttempted
    );

    /**
     * @notice Withdraw accumulated rewards
     */
    function withdrawRewards() external nonReentrant {
        uint256 amount = disputerRewards[msg.sender];
        require(amount > 0, "OracleCoreV2: No rewards to withdraw");

        disputerRewards[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
    }

    // Internal functions

    /**
     * @notice Validate schema and custom data
     */
    function _validateSchema(
        bytes32 _schemaId,
        bytes calldata _customData,
        address _gameContract
    ) internal view returns (bool) {
        // Check schema exists and is active
        if (!schemaRegistry.isSchemaActive(_schemaId)) {
            return false;
        }

        // If game has a registered schema, verify it matches
        if (schemaRegistry.hasSchema(_gameContract)) {
            bytes32 gameSchemaId = schemaRegistry.getGameSchemaId(_gameContract);
            if (_schemaId != gameSchemaId) {
                return false;
            }
        }

        // Validate encoded data structure
        return schemaRegistry.validateEncodedData(_schemaId, _customData);
    }

    // View functions

    /**
     * @notice Get full result with schema data
     * @param _matchId The match to query
     */
    function getResultV2(bytes32 _matchId)
        external
        view
        returns (GameResult memory)
    {
        require(results[_matchId].submittedAt > 0, "OracleCoreV2: Result does not exist");
        return results[_matchId];
    }

    /**
     * @notice Get result for backward compatibility (returns simplified data)
     * @param _matchId The match to query
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
        GameResult memory result = results[_matchId];
        require(result.submittedAt > 0, "OracleCoreV2: Result does not exist");

        // For backward compatibility, return customData as string if no schema
        if (result.schemaId == bytes32(0)) {
            resultData = string(result.customData);
        } else {
            resultData = ""; // Use getResultV2 for schema-based results
        }

        return (resultData, result.resultHash, result.isFinalized);
    }

    /**
     * @notice Check if result is finalized
     */
    function isResultFinalized(bytes32 _matchId) external view returns (bool) {
        return results[_matchId].isFinalized;
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
        returns (bytes32 schemaId, bytes memory customData)
    {
        GameResult memory result = results[_matchId];
        return (result.schemaId, result.customData);
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
        GameResult memory result = results[_matchId];
        return (result.participants, result.scores, result.winnerIndex);
    }

    /**
     * @notice Get total results count
     */
    function getTotalResults() external view returns (uint256) {
        return allResults.length;
    }

    // Emergency pause functions

    /**
     * @notice Emergency pause - stops all critical operations
     * @dev Only owner can pause. Use in case of security issues or bugs.
     */
    function emergencyPause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract
     * @dev Only owner can unpause after fixing issues
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    receive() external payable {}
}
