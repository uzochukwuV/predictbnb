// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./GameRegistry.sol";
import "./OracleCore.sol";
import "./FeeManager.sol";

/**
 * @title DisputeResolver
 * @notice Handles disputes for oracle results with economic incentives
 * @dev Implements challenge mechanism with staking and slashing
 */
contract DisputeResolver is OwnableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    // ============ Errors ============

    error DisputeWindowClosed();
    error DisputeWindowNotClosed();
    error InsufficientStake();
    error AlreadyDisputed();
    error DisputeNotFound();
    error DisputeAlreadyResolved();
    error Unauthorized();
    error ResultNotFound();
    error InvalidEvidenceHash();

    // ============ Enums ============

    enum DisputeStatus {
        Pending,        // Dispute submitted, awaiting resolution
        Accepted,       // Dispute accepted, submitter was wrong
        Rejected,       // Dispute rejected, challenger was wrong
        Investigating   // Under manual review
    }

    // ============ Structs ============

    struct Dispute {
        bytes32 matchId;
        bytes32 gameId;
        address challenger;
        uint256 stakeAmount;
        uint64 createdAt;
        uint64 resolvedAt;
        DisputeStatus status;
        string reason;
        bytes32 evidenceHash; // IPFS hash or other evidence
        address resolver; // Who resolved the dispute
    }

    // ============ State Variables ============

    /// @notice Minimum stake required to challenge (0.2 BNB)
    uint256 public challengeStake;

    /// @notice Reference to GameRegistry
    GameRegistry public gameRegistry;

    /// @notice Reference to OracleCore
    OracleCore public oracleCore;

    /// @notice Reference to FeeManager
    FeeManager public feeManager;

    /// @notice Mapping of disputeId to Dispute
    mapping(bytes32 => Dispute) public disputes;

    /// @notice Mapping of matchId to disputeId (one dispute per match)
    mapping(bytes32 => bytes32) public matchDisputes;

    /// @notice Multi-sig resolvers (for manual dispute resolution)
    mapping(address => bool) public resolvers;

    /// @notice Total disputes created
    uint256 public totalDisputes;

    /// @notice Total disputes resolved
    uint256 public totalResolved;

    /// @notice Total disputes accepted (submitter was wrong)
    uint256 public totalAccepted;

    /// @notice Total disputes rejected (challenger was wrong)
    uint256 public totalRejected;

    // ============ Events ============

    event DisputeCreated(
        bytes32 indexed disputeId,
        bytes32 indexed matchId,
        bytes32 indexed gameId,
        address challenger,
        uint256 stakeAmount,
        string reason
    );

    event DisputeResolved(
        bytes32 indexed disputeId,
        bytes32 indexed matchId,
        DisputeStatus status,
        address resolver,
        uint64 resolvedAt
    );

    event StakeSlashed(
        bytes32 indexed gameId,
        uint256 amount,
        string reason
    );

    event ChallengeStakeReturned(
        address indexed challenger,
        uint256 amount
    );

    event ResolverAdded(address indexed resolver);

    event ResolverRemoved(address indexed resolver);

    event EvidenceSubmitted(
        bytes32 indexed disputeId,
        bytes32 evidenceHash
    );

    // ============ Modifiers ============

    modifier onlyResolver() {
        require(resolvers[msg.sender] || msg.sender == owner(), "Not authorized resolver");
        _;
    }

    modifier disputeExists(bytes32 disputeId) {
        if (disputes[disputeId].challenger == address(0)) revert DisputeNotFound();
        _;
    }

    // ============ Initialize ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _gameRegistry,
        address _oracleCore,
        address payable _feeManager,
        uint256 _challengeStake
    ) public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        gameRegistry = GameRegistry(_gameRegistry);
        oracleCore = OracleCore(_oracleCore);
        feeManager = FeeManager(_feeManager);
        challengeStake = _challengeStake; // 0.2 BNB
    }

    // ============ External Functions ============

    /**
     * @notice Challenge a result submission
     * @param matchId The match identifier
     * @param reason Human-readable reason for dispute
     * @param evidenceHash IPFS hash or URL to evidence
     */
    function createDispute(
        bytes32 matchId,
        string calldata reason,
        bytes32 evidenceHash
    ) external payable nonReentrant returns (bytes32) {
        if (msg.value < challengeStake) revert InsufficientStake();

        // Check if result exists
        OracleCore.Result memory result = oracleCore.getResult(matchId);
        if (result.submitter == address(0)) revert ResultNotFound();

        // Check if dispute window is still open
        if (result.isFinalized) revert DisputeWindowClosed();
        if (block.timestamp > result.submittedAt + 15 minutes) {
            revert DisputeWindowClosed();
        }

        // Check if already disputed
        if (matchDisputes[matchId] != bytes32(0)) revert AlreadyDisputed();

        // Create dispute
        bytes32 disputeId = keccak256(
            abi.encodePacked(matchId, msg.sender, block.timestamp)
        );

        disputes[disputeId] = Dispute({
            matchId: matchId,
            gameId: result.gameId,
            challenger: msg.sender,
            stakeAmount: msg.value,
            createdAt: uint64(block.timestamp),
            resolvedAt: 0,
            status: DisputeStatus.Pending,
            reason: reason,
            evidenceHash: evidenceHash,
            resolver: address(0)
        });

        matchDisputes[matchId] = disputeId;
        totalDisputes++;

        // Mark result as disputed in OracleCore
        oracleCore.markResultDisputed(matchId);

        emit DisputeCreated(
            disputeId,
            matchId,
            result.gameId,
            msg.sender,
            msg.value,
            reason
        );

        return disputeId;
    }

    /**
     * @notice Resolve a dispute (only authorized resolvers)
     * @param disputeId The dispute identifier
     * @param accept True if dispute is accepted (submitter was wrong), false otherwise
     * @param rewardPercentage Percentage of slash to give as reward (0-100)
     */
    function resolveDispute(
        bytes32 disputeId,
        bool accept,
        uint8 rewardPercentage
    ) external onlyResolver nonReentrant disputeExists(disputeId) {
        Dispute storage dispute = disputes[disputeId];

        if (dispute.status != DisputeStatus.Pending &&
            dispute.status != DisputeStatus.Investigating) {
            revert DisputeAlreadyResolved();
        }

        require(rewardPercentage <= 100, "Invalid reward percentage");

        dispute.resolvedAt = uint64(block.timestamp);
        dispute.resolver = msg.sender;
        totalResolved++;

        if (accept) {
            // Dispute accepted - submitter was wrong
            dispute.status = DisputeStatus.Accepted;
            totalAccepted++;

            // Slash game stake
            uint256 slashAmount = _calculateSlashAmount(dispute.gameId);
            gameRegistry.slashStake(
                dispute.gameId,
                slashAmount,
                string(abi.encodePacked("Dispute accepted: ", dispute.reason))
            );

            // Reduce game reputation
            GameRegistry.Game memory game = gameRegistry.getGame(dispute.gameId);
            uint16 newReputation = game.reputation > 100 ? game.reputation - 100 : 0;
            gameRegistry.updateReputation(dispute.gameId, newReputation);

            // Increment dispute counter
            gameRegistry.incrementDisputes(dispute.gameId);

            // Return challenger stake + reward
            uint256 reward = (slashAmount * rewardPercentage) / 100;
            uint256 totalPayout = dispute.stakeAmount + reward;

            (bool success, ) = payable(dispute.challenger).call{value: totalPayout}("");
            require(success, "Transfer failed");

            emit StakeSlashed(dispute.gameId, slashAmount, dispute.reason);

        } else {
            // Dispute rejected - challenger was wrong
            dispute.status = DisputeStatus.Rejected;
            totalRejected++;

            // Challenger loses stake - add to disputer pool
            // (This incentivizes only valid disputes)
            feeManager.addToDisputerPool{value: dispute.stakeAmount}();

            // Increase game reputation slightly for false accusation
            GameRegistry.Game memory game = gameRegistry.getGame(dispute.gameId);
            uint16 newReputation = game.reputation < 950 ? game.reputation + 50 : 1000;
            gameRegistry.updateReputation(dispute.gameId, newReputation);
        }

        emit DisputeResolved(
            disputeId,
            dispute.matchId,
            dispute.status,
            msg.sender,
            uint64(block.timestamp)
        );
    }

    /**
     * @notice Submit additional evidence for a dispute
     * @param disputeId The dispute identifier
     * @param evidenceHash IPFS hash or URL to evidence
     */
    function submitEvidence(
        bytes32 disputeId,
        bytes32 evidenceHash
    ) external disputeExists(disputeId) {
        Dispute storage dispute = disputes[disputeId];

        // Only challenger or game developer can submit evidence
        GameRegistry.Game memory game = gameRegistry.getGame(dispute.gameId);
        require(
            msg.sender == dispute.challenger || msg.sender == game.developer,
            "Not authorized"
        );

        if (evidenceHash == bytes32(0)) revert InvalidEvidenceHash();

        dispute.evidenceHash = evidenceHash;

        emit EvidenceSubmitted(disputeId, evidenceHash);
    }

    /**
     * @notice Mark dispute as under investigation
     * @param disputeId The dispute identifier
     */
    function markAsInvestigating(bytes32 disputeId)
        external
        onlyResolver
        disputeExists(disputeId)
    {
        Dispute storage dispute = disputes[disputeId];
        require(dispute.status == DisputeStatus.Pending, "Not in pending status");

        dispute.status = DisputeStatus.Investigating;
    }

    /**
     * @notice Batch resolve multiple disputes
     * @param disputeIds Array of dispute identifiers
     * @param accepts Array of accept decisions
     * @param rewardPercentages Array of reward percentages
     */
    function batchResolveDisputes(
        bytes32[] calldata disputeIds,
        bool[] calldata accepts,
        uint8[] calldata rewardPercentages
    ) external onlyResolver {
        require(
            disputeIds.length == accepts.length &&
            disputeIds.length == rewardPercentages.length,
            "Array length mismatch"
        );

        for (uint256 i = 0; i < disputeIds.length; i++) {
            // Use try-catch to continue even if one fails
            try this.resolveDispute(disputeIds[i], accepts[i], rewardPercentages[i]) {
                // Success
            } catch {
                // Skip failed resolution
            }
        }
    }

    // ============ View Functions ============

    /**
     * @notice Get dispute details
     * @param disputeId The dispute identifier
     */
    function getDispute(bytes32 disputeId)
        external
        view
        disputeExists(disputeId)
        returns (Dispute memory)
    {
        return disputes[disputeId];
    }

    /**
     * @notice Get dispute for a specific match
     * @param matchId The match identifier
     */
    function getMatchDispute(bytes32 matchId)
        external
        view
        returns (Dispute memory)
    {
        bytes32 disputeId = matchDisputes[matchId];
        if (disputeId == bytes32(0)) revert DisputeNotFound();
        return disputes[disputeId];
    }

    /**
     * @notice Check if a match has been disputed
     * @param matchId The match identifier
     */
    function isDisputed(bytes32 matchId) external view returns (bool) {
        return matchDisputes[matchId] != bytes32(0);
    }

    /**
     * @notice Get dispute statistics
     */
    function getDisputeStats()
        external
        view
        returns (
            uint256 total,
            uint256 resolved,
            uint256 accepted,
            uint256 rejected,
            uint256 pending
        )
    {
        return (
            totalDisputes,
            totalResolved,
            totalAccepted,
            totalRejected,
            totalDisputes - totalResolved
        );
    }

    // ============ Admin Functions ============

    /**
     * @notice Add a dispute resolver
     * @param resolver Address to add
     */
    function addResolver(address resolver) external onlyOwner {
        resolvers[resolver] = true;
        emit ResolverAdded(resolver);
    }

    /**
     * @notice Remove a dispute resolver
     * @param resolver Address to remove
     */
    function removeResolver(address resolver) external onlyOwner {
        resolvers[resolver] = false;
        emit ResolverRemoved(resolver);
    }

    /**
     * @notice Update challenge stake requirement
     * @param newStake New stake amount
     */
    function updateChallengeStake(uint256 newStake) external onlyOwner {
        challengeStake = newStake;
    }

    /**
     * @notice Update GameRegistry address
     * @param _gameRegistry New GameRegistry address
     */
    function updateGameRegistry(address _gameRegistry) external onlyOwner {
        gameRegistry = GameRegistry(_gameRegistry);
    }

    /**
     * @notice Update OracleCore address
     * @param _oracleCore New OracleCore address
     */
    function updateOracleCore(address _oracleCore) external onlyOwner {
        oracleCore = OracleCore(_oracleCore);
    }

    /**
     * @notice Update FeeManager address
     * @param _feeManager New FeeManager address
     */
    function updateFeeManager(address _feeManager) external onlyOwner {
        feeManager = FeeManager(payable(_feeManager));
    }

    // ============ Internal Functions ============

    /**
     * @notice Calculate slash amount based on game stake and reputation
     */
    function _calculateSlashAmount(bytes32 gameId) internal view returns (uint256) {
        GameRegistry.Game memory game = gameRegistry.getGame(gameId);

        // Slash 20% of stake for first offense
        // More for repeat offenders
        uint256 baseSlash = game.stakedAmount / 5; // 20%

        // Increase slash for repeat offenders
        if (game.totalDisputes > 3) {
            baseSlash = (game.stakedAmount * 50) / 100; // 50% for repeat offenders
        }

        return baseSlash;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ============ Receive Function ============

    receive() external payable {
        // Allow contract to receive BNB for rewards
    }
}
