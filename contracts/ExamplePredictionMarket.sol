// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./FeeManager.sol";
import "./GameRegistry.sol";

/**
 * @title ExamplePredictionMarket
 * @notice Simple binary prediction market that consumes gaming oracle data
 * @dev Demonstrates how to integrate with the gaming oracle infrastructure
 */
contract ExamplePredictionMarket is ReentrancyGuard {
    FeeManager public feeManager;
    GameRegistry public gameRegistry;

    enum Outcome {
        TeamA,
        TeamB,
        Draw
    }

    enum MarketStatus {
        Open,
        Closed,
        Resolved,
        Cancelled
    }

    struct Market {
        bytes32 matchId;
        string gameId;
        string description;
        uint256 closeTime;
        MarketStatus status;
        Outcome winningOutcome;
        uint256 totalStakedTeamA;
        uint256 totalStakedTeamB;
        uint256 totalStakedDraw;
        uint256 totalStaked;
        bool resolved;
        mapping(address => mapping(Outcome => uint256)) userStakes;
        mapping(address => bool) hasClaimed;
    }

    mapping(bytes32 => Market) public markets;
    bytes32[] public allMarketIds;

    // Events
    event MarketCreated(
        bytes32 indexed marketId,
        bytes32 indexed matchId,
        string gameId,
        string description,
        uint256 closeTime
    );

    event BetPlaced(
        bytes32 indexed marketId,
        address indexed user,
        Outcome outcome,
        uint256 amount
    );

    event MarketResolved(
        bytes32 indexed marketId,
        Outcome winningOutcome,
        uint256 totalPayout
    );

    event WinningsClaimed(
        bytes32 indexed marketId,
        address indexed user,
        uint256 amount
    );

    constructor(address _feeManagerAddress, address _gameRegistryAddress) {
        require(_feeManagerAddress != address(0), "ExamplePredictionMarket: Invalid fee manager");
        require(_gameRegistryAddress != address(0), "ExamplePredictionMarket: Invalid registry");
        feeManager = FeeManager(_feeManagerAddress);
        gameRegistry = GameRegistry(_gameRegistryAddress);
    }

    /**
     * @notice Create a prediction market for a scheduled match
     * @param _matchId The match to create a market for
     * @param _description Market description
     */
    function createMarket(
        bytes32 _matchId,
        string calldata _description
    ) external returns (bytes32) {
        // Verify match exists and is scheduled
        GameRegistry.Match memory matchData = gameRegistry.getMatch(_matchId);
        require(matchData.scheduledTime > 0, "ExamplePredictionMarket: Match does not exist");
        require(
            matchData.status == GameRegistry.MatchStatus.Scheduled,
            "ExamplePredictionMarket: Match not in scheduled state"
        );

        // Create unique market ID
        bytes32 marketId = keccak256(
            abi.encodePacked(_matchId, msg.sender, block.timestamp)
        );

        Market storage market = markets[marketId];
        market.matchId = _matchId;
        market.gameId = matchData.gameId;
        market.description = _description;
        market.closeTime = matchData.scheduledTime; // Close betting when match starts
        market.status = MarketStatus.Open;
        market.resolved = false;

        allMarketIds.push(marketId);

        emit MarketCreated(
            marketId,
            _matchId,
            matchData.gameId,
            _description,
            matchData.scheduledTime
        );

        return marketId;
    }

    /**
     * @notice Place a bet on a market
     * @param _marketId The market to bet on
     * @param _outcome The outcome to bet on
     */
    function placeBet(
        bytes32 _marketId,
        Outcome _outcome
    ) external payable nonReentrant {
        Market storage market = markets[_marketId];
        require(market.closeTime > 0, "ExamplePredictionMarket: Market does not exist");
        require(market.status == MarketStatus.Open, "ExamplePredictionMarket: Market not open");
        require(block.timestamp < market.closeTime, "ExamplePredictionMarket: Betting closed");
        require(msg.value > 0, "ExamplePredictionMarket: Must bet positive amount");
        require(msg.value >= 0.01 ether, "ExamplePredictionMarket: Minimum bet 0.01 BNB");

        // Record user's stake
        market.userStakes[msg.sender][_outcome] += msg.value;
        market.totalStaked += msg.value;

        // Update outcome totals
        if (_outcome == Outcome.TeamA) {
            market.totalStakedTeamA += msg.value;
        } else if (_outcome == Outcome.TeamB) {
            market.totalStakedTeamB += msg.value;
        } else {
            market.totalStakedDraw += msg.value;
        }

        emit BetPlaced(_marketId, msg.sender, _outcome, msg.value);
    }

    /**
     * @notice Close betting (anyone can call after close time)
     * @param _marketId The market to close
     */
    function closeBetting(bytes32 _marketId) external {
        Market storage market = markets[_marketId];
        require(market.status == MarketStatus.Open, "ExamplePredictionMarket: Market not open");
        require(
            block.timestamp >= market.closeTime,
            "ExamplePredictionMarket: Close time not reached"
        );

        market.status = MarketStatus.Closed;
    }

    /**
     * @notice Resolve market by fetching result from oracle
     * @param _marketId The market to resolve
     */
    function resolveMarket(bytes32 _marketId) external payable nonReentrant {
        Market storage market = markets[_marketId];
        require(
            market.status == MarketStatus.Closed,
            "ExamplePredictionMarket: Market must be closed"
        );
        require(!market.resolved, "ExamplePredictionMarket: Already resolved");

        // Query result from oracle through FeeManager
        // Note: Need to pay the oracle fee
        (
            string memory resultData,
            bytes32 resultHash,
            bool isFinalized
        ) = feeManager.queryResult{value: msg.value}(market.matchId);

        require(isFinalized, "ExamplePredictionMarket: Result not finalized yet");

        // Parse result to determine winner
        // In a real implementation, you'd parse the JSON resultData
        // For demo, we'll use a simple hash-based outcome
        Outcome winner = _parseResult(resultHash);

        market.winningOutcome = winner;
        market.status = MarketStatus.Resolved;
        market.resolved = true;

        emit MarketResolved(_marketId, winner, market.totalStaked);
    }

    /**
     * @notice Claim winnings after market is resolved
     * @param _marketId The market to claim from
     */
    function claimWinnings(bytes32 _marketId) external nonReentrant {
        Market storage market = markets[_marketId];
        require(market.resolved, "ExamplePredictionMarket: Market not resolved");
        require(!market.hasClaimed[msg.sender], "ExamplePredictionMarket: Already claimed");

        uint256 userStake = market.userStakes[msg.sender][market.winningOutcome];
        require(userStake > 0, "ExamplePredictionMarket: No winning stake");

        // Calculate payout
        uint256 totalWinningStake = _getTotalStakeForOutcome(market, market.winningOutcome);
        require(totalWinningStake > 0, "ExamplePredictionMarket: No winning stakes");

        // Payout = (user's stake / total winning stake) * total pool
        // Take 2% protocol fee
        uint256 protocolFee = (market.totalStaked * 200) / 10000;
        uint256 payoutPool = market.totalStaked - protocolFee;
        uint256 payout = (userStake * payoutPool) / totalWinningStake;

        // SECURITY: State changes BEFORE external call (checks-effects-interactions pattern)
        market.hasClaimed[msg.sender] = true;

        // Use call instead of transfer for better gas forwarding
        (bool success, ) = payable(msg.sender).call{value: payout}("");
        require(success, "ExamplePredictionMarket: Transfer failed");

        emit WinningsClaimed(_marketId, msg.sender, payout);
    }

    /**
     * @notice Cancel market if match is cancelled
     * @param _marketId The market to cancel
     */
    function cancelMarket(bytes32 _marketId) external {
        Market storage market = markets[_marketId];
        require(!market.resolved, "ExamplePredictionMarket: Already resolved");

        // Check if match is cancelled
        GameRegistry.Match memory matchData = gameRegistry.getMatch(market.matchId);
        require(
            matchData.status == GameRegistry.MatchStatus.Cancelled,
            "ExamplePredictionMarket: Match not cancelled"
        );

        market.status = MarketStatus.Cancelled;
    }

    /**
     * @notice Refund bet if market is cancelled
     * @param _marketId The market to refund from
     * @param _outcome The outcome you bet on
     */
    function refundBet(
        bytes32 _marketId,
        Outcome _outcome
    ) external nonReentrant {
        Market storage market = markets[_marketId];
        require(
            market.status == MarketStatus.Cancelled,
            "ExamplePredictionMarket: Market not cancelled"
        );
        require(!market.hasClaimed[msg.sender], "ExamplePredictionMarket: Already refunded");

        uint256 userStake = market.userStakes[msg.sender][_outcome];
        require(userStake > 0, "ExamplePredictionMarket: No stake to refund");

        market.hasClaimed[msg.sender] = true;
        payable(msg.sender).transfer(userStake);
    }

    // Internal functions

    /**
     * @notice Parse result hash to determine winner (simplified for demo)
     * @dev In production, parse the actual JSON result data
     */
    function _parseResult(bytes32 _resultHash) internal pure returns (Outcome) {
        // Simple demo logic: use hash modulo
        uint256 value = uint256(_resultHash) % 3;
        return Outcome(value);
    }

    /**
     * @notice Get total stake for an outcome
     */
    function _getTotalStakeForOutcome(
        Market storage _market,
        Outcome _outcome
    ) internal view returns (uint256) {
        if (_outcome == Outcome.TeamA) {
            return _market.totalStakedTeamA;
        } else if (_outcome == Outcome.TeamB) {
            return _market.totalStakedTeamB;
        } else {
            return _market.totalStakedDraw;
        }
    }

    // View functions

    function getMarketOdds(bytes32 _marketId)
        external
        view
        returns (
            uint256 oddsTeamA,
            uint256 oddsTeamB,
            uint256 oddsDraw
        )
    {
        Market storage market = markets[_marketId];

        if (market.totalStaked == 0) {
            return (10000, 10000, 10000); // Equal odds if no bets
        }

        // Calculate implied odds (in basis points)
        oddsTeamA = market.totalStakedTeamA > 0
            ? (market.totalStaked * 10000) / market.totalStakedTeamA
            : 0;
        oddsTeamB = market.totalStakedTeamB > 0
            ? (market.totalStaked * 10000) / market.totalStakedTeamB
            : 0;
        oddsDraw = market.totalStakedDraw > 0
            ? (market.totalStaked * 10000) / market.totalStakedDraw
            : 0;
    }

    function getUserStake(
        bytes32 _marketId,
        address _user,
        Outcome _outcome
    ) external view returns (uint256) {
        return markets[_marketId].userStakes[_user][_outcome];
    }

    function getPotentialPayout(
        bytes32 _marketId,
        address _user,
        Outcome _outcome
    ) external view returns (uint256) {
        Market storage market = markets[_marketId];
        uint256 userStake = market.userStakes[_user][_outcome];

        if (userStake == 0 || market.totalStaked == 0) {
            return 0;
        }

        uint256 totalOutcomeStake = _getTotalStakeForOutcome(market, _outcome);
        if (totalOutcomeStake == 0) {
            return 0;
        }

        uint256 protocolFee = (market.totalStaked * 200) / 10000;
        uint256 payoutPool = market.totalStaked - protocolFee;

        return (userStake * payoutPool) / totalOutcomeStake;
    }

    function getTotalMarkets() external view returns (uint256) {
        return allMarketIds.length;
    }

    receive() external payable {}
}
