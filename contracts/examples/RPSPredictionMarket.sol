// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "../OracleCore.sol";
import "../FeeManager.sol";

/**
 * @title RPSPredictionMarket
 * @notice Prediction market for Rock Paper Scissors games
 * @dev Uses PredictBNB oracle to fetch game results and resolve bets
 */
contract RPSPredictionMarket {
    // ============ Structs ============

    struct Market {
        bytes32 matchId; // Oracle match ID
        bytes32 gameId; // Game ID from oracle
        address player1;
        address player2;
        uint256 totalPool;
        uint256 player1Pool;
        uint256 player2Pool;
        uint256 tiePool;
        uint64 bettingDeadline;
        bool isResolved;
        address winner; // address(0) = tie
        uint64 resolvedAt;
    }

    struct Bet {
        address bettor;
        address predictedWinner; // address(0) = tie prediction
        uint256 amount;
        bool claimed;
    }

    // ============ State Variables ============

    OracleCore public oracleCore;
    FeeManager public feeManager;

    uint256 public marketCounter;
    uint256 public constant PLATFORM_FEE = 200; // 2% = 200 basis points

    mapping(uint256 => Market) public markets;
    mapping(uint256 => Bet[]) public marketBets;
    mapping(uint256 => mapping(address => uint256[])) public userBets; // marketId => user => betIds

    address public owner;
    uint256 public platformEarnings;

    // ============ Events ============

    event MarketCreated(
        uint256 indexed marketId,
        bytes32 indexed matchId,
        address player1,
        address player2,
        uint64 bettingDeadline
    );

    event BetPlaced(
        uint256 indexed marketId,
        address indexed bettor,
        address predictedWinner,
        uint256 amount
    );

    event MarketResolved(
        uint256 indexed marketId,
        address winner,
        uint256 totalPool
    );

    event WinningsClaimed(
        uint256 indexed marketId,
        address indexed bettor,
        uint256 amount
    );

    event OracleBalanceFunded(uint256 amount);

    // ============ Errors ============

    error OnlyOwner();
    error MarketNotFound();
    error BettingClosed();
    error BettingStillOpen();
    error MarketAlreadyResolved();
    error MarketNotResolved();
    error InvalidBetAmount();
    error NothingToClaim();
    error AlreadyClaimed();
    error OracleResultNotReady();
    error TransferFailed();

    // ============ Modifiers ============

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    // ============ Constructor ============

    constructor(address _oracleCore, address payable _feeManager) {
        oracleCore = OracleCore(_oracleCore);
        feeManager = FeeManager(_feeManager);
        owner = msg.sender;
    }

    // ============ External Functions ============

    /**
     * @notice Create a prediction market for a scheduled RPS match
     * @param matchId The match ID from the oracle
     * @param gameId The game ID from the oracle
     * @param player1 First player address
     * @param player2 Second player address
     * @param bettingDeadline When betting closes (unix timestamp)
     * @return marketId The created market identifier
     */
    function createMarket(
        bytes32 matchId,
        bytes32 gameId,
        address player1,
        address player2,
        uint64 bettingDeadline
    ) external onlyOwner returns (uint256) {
        uint256 marketId = marketCounter++;

        markets[marketId] = Market({
            matchId: matchId,
            gameId: gameId,
            player1: player1,
            player2: player2,
            totalPool: 0,
            player1Pool: 0,
            player2Pool: 0,
            tiePool: 0,
            bettingDeadline: bettingDeadline,
            isResolved: false,
            winner: address(0),
            resolvedAt: 0
        });

        emit MarketCreated(marketId, matchId, player1, player2, bettingDeadline);

        return marketId;
    }

    /**
     * @notice Place a bet on a market
     * @param marketId The market to bet on
     * @param predictedWinner The predicted winner (address(0) for tie)
     */
    function placeBet(uint256 marketId, address predictedWinner) external payable {
        Market storage market = markets[marketId];

        if (market.player1 == address(0)) revert MarketNotFound();
        if (block.timestamp >= market.bettingDeadline) revert BettingClosed();
        if (msg.value == 0) revert InvalidBetAmount();
        if (market.isResolved) revert MarketAlreadyResolved();

        // Validate predicted winner
        if (predictedWinner != address(0) &&
            predictedWinner != market.player1 &&
            predictedWinner != market.player2) {
            revert();
        }

        // Record bet
        uint256 betId = marketBets[marketId].length;
        marketBets[marketId].push(Bet({
            bettor: msg.sender,
            predictedWinner: predictedWinner,
            amount: msg.value,
            claimed: false
        }));

        userBets[marketId][msg.sender].push(betId);

        // Update pools
        market.totalPool += msg.value;
        if (predictedWinner == market.player1) {
            market.player1Pool += msg.value;
        } else if (predictedWinner == market.player2) {
            market.player2Pool += msg.value;
        } else {
            market.tiePool += msg.value;
        }

        emit BetPlaced(marketId, msg.sender, predictedWinner, msg.value);
    }

    /**
     * @notice Resolve market using oracle data
     * @param marketId The market to resolve
     */
    function resolveMarket(uint256 marketId) external {
        Market storage market = markets[marketId];

        if (market.player1 == address(0)) revert MarketNotFound();
        if (block.timestamp < market.bettingDeadline) revert BettingStillOpen();
        if (market.isResolved) revert MarketAlreadyResolved();

        // Query oracle for winner
        bytes32 winnerField = oracleCore.getResultField(market.matchId, keccak256("WINNER"));
        address winner = address(uint160(uint256(winnerField)));

        // Verify result is finalized
        OracleCore.Result memory result = oracleCore.getResult(market.matchId);
        if (!result.isFinalized) revert OracleResultNotReady();

        // Resolve market
        market.winner = winner;
        market.isResolved = true;
        market.resolvedAt = uint64(block.timestamp);

        emit MarketResolved(marketId, winner, market.totalPool);
    }

    /**
     * @notice Claim winnings from resolved market
     * @param marketId The market to claim from
     */
    function claimWinnings(uint256 marketId) external {
        Market storage market = markets[marketId];

        if (!market.isResolved) revert MarketNotResolved();

        uint256[] storage betIds = userBets[marketId][msg.sender];
        uint256 totalWinnings = 0;

        for (uint256 i = 0; i < betIds.length; i++) {
            Bet storage bet = marketBets[marketId][betIds[i]];

            if (!bet.claimed && bet.predictedWinner == market.winner) {
                bet.claimed = true;

                // Calculate winnings
                uint256 winningPool;
                if (market.winner == market.player1) {
                    winningPool = market.player1Pool;
                } else if (market.winner == market.player2) {
                    winningPool = market.player2Pool;
                } else {
                    winningPool = market.tiePool;
                }

                if (winningPool > 0) {
                    // Calculate share: (bet / winningPool) * (totalPool - fee)
                    uint256 platformFee = (market.totalPool * PLATFORM_FEE) / 10000;
                    uint256 payoutPool = market.totalPool - platformFee;

                    uint256 winnings = (bet.amount * payoutPool) / winningPool;
                    totalWinnings += winnings;
                }
            }
        }

        if (totalWinnings == 0) revert NothingToClaim();

        // Transfer winnings
        (bool success, ) = payable(msg.sender).call{value: totalWinnings}("");
        if (!success) revert TransferFailed();

        emit WinningsClaimed(marketId, msg.sender, totalWinnings);
    }

    /**
     * @notice Fund oracle query balance for this contract
     */
    function fundOracleBalance() external payable {
        if (msg.value == 0) revert InvalidBetAmount();

        // Deposit to FeeManager for oracle queries
        feeManager.depositBalance{value: msg.value}();

        emit OracleBalanceFunded(msg.value);
    }

    /**
     * @notice Withdraw platform fees (owner only)
     */
    function withdrawPlatformFees() external onlyOwner {
        uint256 balance = platformEarnings;
        if (balance == 0) revert NothingToClaim();

        platformEarnings = 0;

        (bool success, ) = payable(owner).call{value: balance}("");
        if (!success) revert TransferFailed();
    }

    // ============ View Functions ============

    /**
     * @notice Get market details
     * @param marketId The market identifier
     */
    function getMarket(uint256 marketId) external view returns (Market memory) {
        return markets[marketId];
    }

    /**
     * @notice Get user's bets on a market
     * @param marketId The market identifier
     * @param user The user address
     */
    function getUserBets(uint256 marketId, address user) external view returns (Bet[] memory) {
        uint256[] storage betIds = userBets[marketId][user];
        Bet[] memory bets = new Bet[](betIds.length);

        for (uint256 i = 0; i < betIds.length; i++) {
            bets[i] = marketBets[marketId][betIds[i]];
        }

        return bets;
    }

    /**
     * @notice Calculate potential winnings for a user
     * @param marketId The market identifier
     * @param user The user address
     */
    function calculatePotentialWinnings(
        uint256 marketId,
        address user,
        address assumedWinner
    ) external view returns (uint256) {
        Market storage market = markets[marketId];
        uint256[] storage betIds = userBets[marketId][user];
        uint256 totalWinnings = 0;

        uint256 winningPool;
        if (assumedWinner == market.player1) {
            winningPool = market.player1Pool;
        } else if (assumedWinner == market.player2) {
            winningPool = market.player2Pool;
        } else {
            winningPool = market.tiePool;
        }

        if (winningPool == 0) return 0;

        uint256 platformFee = (market.totalPool * PLATFORM_FEE) / 10000;
        uint256 payoutPool = market.totalPool - platformFee;

        for (uint256 i = 0; i < betIds.length; i++) {
            Bet storage bet = marketBets[marketId][betIds[i]];

            if (bet.predictedWinner == assumedWinner) {
                uint256 winnings = (bet.amount * payoutPool) / winningPool;
                totalWinnings += winnings;
            }
        }

        return totalWinnings;
    }

    /**
     * @notice Get market odds for each outcome
     * @param marketId The market identifier
     */
    function getOdds(uint256 marketId) external view returns (
        uint256 player1Odds,
        uint256 player2Odds,
        uint256 tieOdds
    ) {
        Market storage market = markets[marketId];

        if (market.totalPool == 0) {
            return (100, 100, 100); // 1:1 odds when no bets
        }

        // Calculate implied probability (pool / totalPool * 100)
        player1Odds = market.player1Pool > 0 ? (market.totalPool * 100) / market.player1Pool : 0;
        player2Odds = market.player2Pool > 0 ? (market.totalPool * 100) / market.player2Pool : 0;
        tieOdds = market.tiePool > 0 ? (market.totalPool * 100) / market.tiePool : 0;
    }

    // ============ Receive Function ============

    receive() external payable {
        // Accept BNB for oracle funding
    }
}
