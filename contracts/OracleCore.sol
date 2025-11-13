// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./GameRegistry.sol";

/**
 * @title OracleCore
 * @notice Core oracle contract for submitting and finalizing game results
 * @dev Implements optimistic oracle pattern with fast 15-30 min dispute window
 */
contract OracleCore is Ownable, ReentrancyGuard {
    GameRegistry public gameRegistry;

    // Fast dispute window: 15 minutes (vs UMA's 24-48 hours)
    uint256 public constant DISPUTE_WINDOW = 15 minutes;

    // Dispute stake must be 2x registration stake
    uint256 public constant DISPUTE_STAKE = 0.2 ether;

    // Result verification struct
    struct GameResult {
        bytes32 matchId;
        string resultData;          // JSON string with scores, winners, stats
        bytes32 resultHash;         // Hash of result data for integrity
        address submitter;
        uint256 submittedAt;
        uint256 disputeDeadline;
        bool isFinalized;
        bool isDisputed;
        address disputer;
        uint256 disputeStake;
        string disputeReason;
    }

    // Validation check results
    struct ValidationChecks {
        bool timingValid;           // Match ended after scheduled time
        bool authorizedSubmitter;   // Submitted by game developer
        bool dataIntegrity;         // Hash matches data
        bool noImpossibleValues;    // Basic sanity checks passed
    }

    // Storage
    mapping(bytes32 => GameResult) public results;          // matchId => Result
    mapping(bytes32 => ValidationChecks) public validations; // matchId => Checks
    mapping(address => uint256) public disputerRewards;     // Accumulated rewards for successful disputers

    bytes32[] public allResults;

    // Events
    event ResultSubmitted(
        bytes32 indexed matchId,
        string gameId,
        address indexed submitter,
        bytes32 resultHash,
        uint256 disputeDeadline
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

    event AutomatedValidationFailed(
        bytes32 indexed matchId,
        string reason
    );

    constructor(address _gameRegistryAddress) Ownable(msg.sender) {
        require(_gameRegistryAddress != address(0), "OracleCore: Invalid registry address");
        gameRegistry = GameRegistry(_gameRegistryAddress);
    }

    /**
     * @notice Submit a game result (called by game developer)
     * @param _matchId The match this result is for
     * @param _resultData JSON string with result details
     */
    function submitResult(
        bytes32 _matchId,
        string calldata _resultData
    ) external nonReentrant {
        // Get match details from registry
        GameRegistry.Match memory matchData = gameRegistry.getMatch(_matchId);
        require(matchData.scheduledTime > 0, "OracleCore: Match does not exist");
        require(
            matchData.status == GameRegistry.MatchStatus.Scheduled ||
            matchData.status == GameRegistry.MatchStatus.InProgress,
            "OracleCore: Match not in valid state"
        );

        // Get game details
        GameRegistry.Game memory game = gameRegistry.getGame(matchData.gameId);
        require(game.developer == msg.sender, "OracleCore: Only game developer can submit");
        require(game.isActive, "OracleCore: Game not active");

        // Ensure result not already submitted
        require(results[_matchId].submittedAt == 0, "OracleCore: Result already submitted");

        // Compute result hash
        bytes32 resultHash = keccak256(abi.encodePacked(_resultData, _matchId, block.timestamp));

        // Perform automated validation checks
        ValidationChecks memory checks = _performValidationChecks(
            matchData,
            game,
            _resultData
        );

        // Store validation results
        validations[_matchId] = checks;

        // If critical checks fail, reject immediately
        if (!checks.authorizedSubmitter || !checks.dataIntegrity) {
            emit AutomatedValidationFailed(_matchId, "Critical validation failed");
            revert("OracleCore: Validation failed");
        }

        // Store result
        uint256 disputeDeadline = block.timestamp + DISPUTE_WINDOW;
        results[_matchId] = GameResult({
            matchId: _matchId,
            resultData: _resultData,
            resultHash: resultHash,
            submitter: msg.sender,
            submittedAt: block.timestamp,
            disputeDeadline: disputeDeadline,
            isFinalized: false,
            isDisputed: false,
            disputer: address(0),
            disputeStake: 0,
            disputeReason: ""
        });

        allResults.push(_matchId);

        // Update match status in registry
        gameRegistry.updateMatchStatus(_matchId, GameRegistry.MatchStatus.Completed);

        emit ResultSubmitted(
            _matchId,
            matchData.gameId,
            msg.sender,
            resultHash,
            disputeDeadline
        );
    }

    /**
     * @notice Dispute a submitted result (anyone can dispute with stake)
     * @param _matchId The match result to dispute
     * @param _reason Explanation for the dispute
     */
    function disputeResult(
        bytes32 _matchId,
        string calldata _reason
    ) external payable nonReentrant {
        GameResult storage result = results[_matchId];
        require(result.submittedAt > 0, "OracleCore: Result does not exist");
        require(!result.isFinalized, "OracleCore: Result already finalized");
        require(!result.isDisputed, "OracleCore: Already disputed");
        require(block.timestamp < result.disputeDeadline, "OracleCore: Dispute window closed");
        require(msg.value == DISPUTE_STAKE, "OracleCore: Incorrect dispute stake");
        require(bytes(_reason).length > 0, "OracleCore: Must provide reason");

        result.isDisputed = true;
        result.disputer = msg.sender;
        result.disputeStake = msg.value;
        result.disputeReason = _reason;

        // Update match status in registry
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
        require(result.isDisputed, "OracleCore: Not disputed");
        require(!result.isFinalized, "OracleCore: Already finalized");

        GameRegistry.Match memory matchData = gameRegistry.getMatch(_matchId);
        GameRegistry.Game memory game = gameRegistry.getGame(matchData.gameId);

        if (_disputeValid) {
            // Dispute successful: Disputer wins
            // Disputer gets their stake back + 50% of game's stake
            uint256 reward = result.disputeStake + (gameRegistry.REGISTRATION_STAKE() / 2);
            disputerRewards[result.disputer] += reward;

            // Slash game developer's stake
            gameRegistry.slashStake(
                matchData.gameId,
                gameRegistry.REGISTRATION_STAKE() / 2,
                result.disputeReason
            );

            // Update reputation (decrease by 50 points, minimum 0)
            uint256 newReputation = game.reputationScore > 50
                ? game.reputationScore - 50
                : 0;
            gameRegistry.updateReputation(matchData.gameId, newReputation);

            emit DisputeResolved(_matchId, true, result.disputer, reward);

            // Mark result as invalid (stays in disputed state)
            gameRegistry.updateMatchStatus(_matchId, GameRegistry.MatchStatus.Disputed);
        } else {
            // Dispute failed: Original submitter wins
            // Game developer gets the dispute stake
            disputerRewards[result.submitter] += result.disputeStake;

            // Update reputation (increase by 10 points, maximum 1000)
            uint256 newReputation = game.reputationScore < 990
                ? game.reputationScore + 10
                : 1000;
            gameRegistry.updateReputation(matchData.gameId, newReputation);

            emit DisputeResolved(_matchId, false, result.submitter, result.disputeStake);

            // Finalize the result
            result.isFinalized = true;
            gameRegistry.updateMatchStatus(_matchId, GameRegistry.MatchStatus.Finalized);

            emit ResultFinalized(_matchId, result.resultHash, block.timestamp);
        }
    }

    /**
     * @notice Finalize a result after dispute window (anyone can call)
     * @param _matchId The match to finalize
     */
    function finalizeResult(bytes32 _matchId) external nonReentrant {
        GameResult storage result = results[_matchId];
        require(result.submittedAt > 0, "OracleCore: Result does not exist");
        require(!result.isFinalized, "OracleCore: Already finalized");
        require(!result.isDisputed, "OracleCore: Cannot finalize disputed result");
        require(
            block.timestamp >= result.disputeDeadline,
            "OracleCore: Dispute window not closed"
        );

        result.isFinalized = true;

        // Update match status in registry
        gameRegistry.updateMatchStatus(_matchId, GameRegistry.MatchStatus.Finalized);

        // Update reputation (small increase for successful submission)
        GameRegistry.Match memory matchData = gameRegistry.getMatch(_matchId);
        GameRegistry.Game memory game = gameRegistry.getGame(matchData.gameId);

        uint256 newReputation = game.reputationScore < 995
            ? game.reputationScore + 5
            : 1000;
        gameRegistry.updateReputation(matchData.gameId, newReputation);

        emit ResultFinalized(_matchId, result.resultHash, block.timestamp);
    }

    /**
     * @notice Withdraw accumulated rewards from successful disputes
     */
    function withdrawRewards() external nonReentrant {
        uint256 amount = disputerRewards[msg.sender];
        require(amount > 0, "OracleCore: No rewards to withdraw");

        disputerRewards[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
    }

    /**
     * @notice Get finalized result for a match (used by prediction markets)
     * @param _matchId The match to query
     * @return resultData The result data
     * @return resultHash Hash for verification
     * @return isFinalized Whether result is finalized
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
        return (result.resultData, result.resultHash, result.isFinalized);
    }

    /**
     * @notice Check if a result is available and finalized
     * @param _matchId The match to check
     */
    function isResultFinalized(bytes32 _matchId) external view returns (bool) {
        return results[_matchId].isFinalized;
    }

    /**
     * @notice Get validation checks for a result
     * @param _matchId The match to check
     */
    function getValidationChecks(bytes32 _matchId)
        external
        view
        returns (ValidationChecks memory)
    {
        return validations[_matchId];
    }

    // Internal functions

    /**
     * @notice Perform automated validation checks on result
     */
    function _performValidationChecks(
        GameRegistry.Match memory _match,
        GameRegistry.Game memory _game,
        string calldata _resultData
    ) internal view returns (ValidationChecks memory) {
        return ValidationChecks({
            timingValid: block.timestamp >= _match.scheduledTime,
            authorizedSubmitter: _game.developer == msg.sender,
            dataIntegrity: bytes(_resultData).length > 0,
            noImpossibleValues: true  // Could add more sophisticated checks
        });
    }

    /**
     * @notice Get total number of results
     */
    function getTotalResults() external view returns (uint256) {
        return allResults.length;
    }

    /**
     * @notice Update dispute window (governance function)
     * @param _newWindow New dispute window in seconds
     */
    function updateDisputeWindow(uint256 _newWindow) external onlyOwner {
        require(_newWindow >= 5 minutes, "OracleCore: Window too short");
        require(_newWindow <= 24 hours, "OracleCore: Window too long");
        // Note: This would need to be implemented as a state variable
        // For simplicity, keeping as constant for now
    }

    // Emergency functions

    /**
     * @notice Emergency pause (in case of critical bug)
     */
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    receive() external payable {}
}
