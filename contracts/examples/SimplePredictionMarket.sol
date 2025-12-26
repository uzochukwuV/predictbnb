// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../OracleCore.sol";
import "../FeeManagerV2.sol";
import "../libraries/OracleSubmissionHelper.sol";

/**
 * @title SimplePredictionMarket
 * @notice Example prediction market that uses PredictBNB oracle
 * @dev Demonstrates how to integrate with OracleCore for binary "who will win" markets
 */
contract SimplePredictionMarket is ReentrancyGuard {
    using OracleSubmissionHelper for *;

    // ============ Errors ============

    error MarketNotFound();
    error MarketClosed();
    error MarketNotResolved();
    error MarketAlreadyResolved();
    error InvalidBetAmount();
    error NothingToWithdraw();
    error InvalidOutcome();

    // ============ Structs ============

    struct Market {
        bytes32 matchId;
        address option1; // Address of player/team 1
        address option2; // Address of player/team 2
        string option1Name;
        string option2Name;
        uint256 totalOption1;
        uint256 totalOption2;
        uint64 closeTime;
        bool isResolved;
        address winner;
        uint256 createdAt;
    }

    struct Bet {
        address bettor;
        address chosenOption;
        uint256 amount;
        bool withdrawn;
    }

    // ============ State Variables ============

    OracleCore public oracleCore;
    FeeManagerV2 public feeManager;

    mapping(bytes32 => Market) public markets;
    mapping(bytes32 => mapping(address => Bet)) public bets;
    mapping(bytes32 => address[]) public marketBettors;

    uint256 public totalMarkets;
    uint256 public platformFeePercent = 2; // 2% platform fee

    // ============ Events ============

    event MarketCreated(
        bytes32 indexed marketId,
        bytes32 indexed matchId,
        address option1,
        address option2,
        uint64 closeTime
    );

    event BetPlaced(
        bytes32 indexed marketId,
        address indexed bettor,
        address chosenOption,
        uint256 amount
    );

    event MarketResolved(
        bytes32 indexed marketId,
        address winner,
        uint256 totalPool
    );

    event WinningsWithdrawn(
        bytes32 indexed marketId,
        address indexed bettor,
        uint256 amount
    );

    // ============ Constructor ============

    constructor(address _oracleCore, address payable _feeManager) {
        oracleCore = OracleCore(_oracleCore);
        feeManager = FeeManagerV2(_feeManager);
    }

    // ============ External Functions ============

    /**
     * @notice Create a new prediction market
     * @param matchId The match identifier from PredictBNB
     * @param option1 Address of player/team 1
     * @param option2 Address of player/team 2
     * @param option1Name Name of option 1
     * @param option2Name Name of option 2
     * @param closeTime When betting closes (match start time)
     */
    function createMarket(
        bytes32 matchId,
        address option1,
        address option2,
        string calldata option1Name,
        string calldata option2Name,
        uint64 closeTime
    ) external returns (bytes32) {
        require(option1 != option2, "Options must be different");
        require(closeTime > block.timestamp, "Close time must be in future");

        bytes32 marketId = keccak256(
            abi.encodePacked(matchId, option1, option2, block.timestamp)
        );

        markets[marketId] = Market({
            matchId: matchId,
            option1: option1,
            option2: option2,
            option1Name: option1Name,
            option2Name: option2Name,
            totalOption1: 0,
            totalOption2: 0,
            closeTime: closeTime,
            isResolved: false,
            winner: address(0),
            createdAt: block.timestamp
        });

        totalMarkets++;

        emit MarketCreated(marketId, matchId, option1, option2, closeTime);

        return marketId;
    }

    /**
     * @notice Place a bet on a market
     * @param marketId The market identifier
     * @param chosenOption The option to bet on (option1 or option2 address)
     */
    function placeBet(bytes32 marketId, address chosenOption)
        external
        payable
        nonReentrant
    {
        Market storage market = markets[marketId];
        if (market.closeTime == 0) revert MarketNotFound();
        if (block.timestamp >= market.closeTime) revert MarketClosed();
        if (msg.value == 0) revert InvalidBetAmount();

        require(
            chosenOption == market.option1 || chosenOption == market.option2,
            "Invalid option"
        );

        // Update or create bet
        Bet storage bet = bets[marketId][msg.sender];
        if (bet.amount == 0) {
            // New bet
            marketBettors[marketId].push(msg.sender);
        }

        bet.bettor = msg.sender;
        bet.chosenOption = chosenOption;
        bet.amount += msg.value;

        // Update totals
        if (chosenOption == market.option1) {
            market.totalOption1 += msg.value;
        } else {
            market.totalOption2 += msg.value;
        }

        emit BetPlaced(marketId, msg.sender, chosenOption, msg.value);
    }

    /**
     * @notice Resolve market using oracle result
     * @param marketId The market identifier
     */
    function resolveMarket(bytes32 marketId) external nonReentrant {
        Market storage market = markets[marketId];
        if (market.closeTime == 0) revert MarketNotFound();
        if (market.isResolved) revert MarketAlreadyResolved();
        require(block.timestamp >= market.closeTime, "Market not closed yet");

        // Query oracle for winner
        bytes32 winnerField = OracleSubmissionHelper.WINNER_FIELD;
        bytes32 winnerBytes = oracleCore.getResultField(market.matchId, winnerField);
        address winner = OracleSubmissionHelper.bytes32ToAddress(winnerBytes);

        // Validate winner is one of the options
        require(
            winner == market.option1 || winner == market.option2,
            "Invalid winner from oracle"
        );

        market.isResolved = true;
        market.winner = winner;

        uint256 totalPool = market.totalOption1 + market.totalOption2;

        emit MarketResolved(marketId, winner, totalPool);
    }

    /**
     * @notice Withdraw winnings from a resolved market
     * @param marketId The market identifier
     */
    function withdrawWinnings(bytes32 marketId) external nonReentrant {
        Market memory market = markets[marketId];
        if (market.closeTime == 0) revert MarketNotFound();
        if (!market.isResolved) revert MarketNotResolved();

        Bet storage bet = bets[marketId][msg.sender];
        require(bet.amount > 0, "No bet placed");
        require(!bet.withdrawn, "Already withdrawn");
        require(bet.chosenOption == market.winner, "Not a winner");

        // Calculate winnings
        uint256 totalPool = market.totalOption1 + market.totalOption2;
        uint256 winningPool = market.winner == market.option1
            ? market.totalOption1
            : market.totalOption2;

        // Winnings = (bet amount / winning pool) * (total pool - platform fee)
        uint256 platformFee = (totalPool * platformFeePercent) / 100;
        uint256 payoutPool = totalPool - platformFee;
        uint256 winnings = (bet.amount * payoutPool) / winningPool;

        if (winnings == 0) revert NothingToWithdraw();

        bet.withdrawn = true;

        (bool success, ) = payable(msg.sender).call{value: winnings}("");
        require(success, "Transfer failed");

        emit WinningsWithdrawn(marketId, msg.sender, winnings);
    }

    // ============ View Functions ============

    /**
     * @notice Get market details
     * @param marketId The market identifier
     */
    function getMarket(bytes32 marketId) external view returns (Market memory) {
        return markets[marketId];
    }

    /**
     * @notice Get bet details
     * @param marketId The market identifier
     * @param bettor The bettor address
     */
    function getBet(bytes32 marketId, address bettor)
        external
        view
        returns (Bet memory)
    {
        return bets[marketId][bettor];
    }

    /**
     * @notice Get market odds
     * @param marketId The market identifier
     * @return odds1 Odds for option 1 (multiplied by 100)
     * @return odds2 Odds for option 2 (multiplied by 100)
     */
    function getOdds(bytes32 marketId)
        external
        view
        returns (uint256 odds1, uint256 odds2)
    {
        Market memory market = markets[marketId];
        uint256 totalPool = market.totalOption1 + market.totalOption2;

        if (totalPool == 0) return (100, 100); // Equal odds if no bets

        // Odds = (total pool / option pool) * 100
        odds1 = market.totalOption1 > 0
            ? (totalPool * 100) / market.totalOption1
            : 0;
        odds2 = market.totalOption2 > 0
            ? (totalPool * 100) / market.totalOption2
            : 0;
    }

    /**
     * @notice Calculate potential winnings
     * @param marketId The market identifier
     * @param chosenOption The option to bet on
     * @param betAmount The bet amount
     */
    function calculatePotentialWinnings(
        bytes32 marketId,
        address chosenOption,
        uint256 betAmount
    ) external view returns (uint256) {
        Market memory market = markets[marketId];

        uint256 currentPool = market.totalOption1 + market.totalOption2;
        uint256 newPool = currentPool + betAmount;

        uint256 chosenPool = chosenOption == market.option1
            ? market.totalOption1
            : market.totalOption2;
        uint256 newChosenPool = chosenPool + betAmount;

        uint256 platformFee = (newPool * platformFeePercent) / 100;
        uint256 payoutPool = newPool - platformFee;

        return (betAmount * payoutPool) / newChosenPool;
    }

    /**
     * @notice Get all bettors for a market
     * @param marketId The market identifier
     */
    function getMarketBettors(bytes32 marketId)
        external
        view
        returns (address[] memory)
    {
        return marketBettors[marketId];
    }

    // ============ Admin Functions ============

    /**
     * @notice Update platform fee percentage
     * @param newFeePercent New fee percentage (0-100)
     */
    function updatePlatformFee(uint256 newFeePercent) external {
        require(newFeePercent <= 10, "Fee too high"); // Max 10%
        platformFeePercent = newFeePercent;
    }

    /**
     * @notice Withdraw platform fees
     */
    function withdrawPlatformFees() external {
        // Calculate accumulated platform fees
        uint256 balance = address(this).balance;
        // Simplified - in production, track fees separately
        (bool success, ) = payable(msg.sender).call{value: balance}("");
        require(success, "Transfer failed");
    }

    /**
     * @notice Fund this contract's prepaid oracle balance
     */
    function fundOracleBalance() external payable {
        feeManager.depositBalance{value: msg.value}(address(0));
    }

    // Allow contract to receive BNB
    receive() external payable {}
}
