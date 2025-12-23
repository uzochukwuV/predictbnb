// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "../GameRegistry.sol";
import "../OracleCore.sol";
import "../libraries/OracleSubmissionHelper.sol";

/**
 * @title RockPaperScissors
 * @notice Schedulable RPS game with on-chain randomness for fair play
 * @dev Players get 3 random cards each, matched by position
 */
contract RockPaperScissors {
    using OracleSubmissionHelper for *;

    // ============ Enums ============

    enum Card { ROCK, PAPER, SCISSORS }
    enum MatchStatus { SCHEDULED, PLAYER1_COMMITTED, COMPLETED, CANCELLED }

    // ============ Structs ============

    struct RPSMatch {
        bytes32 matchId;
        address player1;
        address player2;
        uint64 scheduledTime;
        MatchStatus status;
        Card[3] player1Cards;
        Card[3] player2Cards;
        address winner; // address(0) = tie
        uint8 player1Wins;
        uint8 player2Wins;
        uint256 randomSeed1;
        uint256 randomSeed2;
        uint64 completedAt;
    }

    // ============ State Variables ============

    GameRegistry public gameRegistry;
    OracleCore public oracleCore;

    address public owner;
    bytes32 public gameId;
    uint256 public matchCounter;

    mapping(bytes32 => RPSMatch) public matches;
    mapping(address => uint256) public playerWins;
    mapping(address => uint256) public playerMatches;

    // ============ Events ============

    event MatchScheduled(
        bytes32 indexed matchId,
        address indexed player1,
        address indexed player2,
        uint64 scheduledTime
    );

    event PlayerCommitted(
        bytes32 indexed matchId,
        address indexed player,
        uint8 playerNumber,
        Card[3] cards
    );

    event MatchCompleted(
        bytes32 indexed matchId,
        address winner,
        uint8 player1Wins,
        uint8 player2Wins
    );

    event CardsRevealed(
        bytes32 indexed matchId,
        Card[3] player1Cards,
        Card[3] player2Cards
    );

    // ============ Errors ============

    error OnlyOwner();
    error NotRegistered();
    error MatchNotFound();
    error MatchAlreadyCompleted();
    error NotScheduledTime();
    error NotPlayer();
    error AlreadyCommitted();
    error Player1NotCommitted();

    // ============ Modifiers ============

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    // ============ Constructor ============

    constructor(address _gameRegistry, address _oracleCore) {
        gameRegistry = GameRegistry(_gameRegistry);
        oracleCore = OracleCore(_oracleCore);
        owner = msg.sender;
    }

    // ============ External Functions ============

    /**
     * @notice Register this game with PredictBNB oracle
     */
    function registerWithOracle() external payable onlyOwner {
        if (gameId != bytes32(0)) revert();

        gameId = gameRegistry.registerGame{value: msg.value}(
            "Rock Paper Scissors",
            '{"type": "card-game", "players": 2, "rounds": 3, "randomness": "on-chain", "version": "1.0"}'
        );
    }

    /**
     * @notice Schedule a new RPS match
     * @param player1 First player address
     * @param player2 Second player address
     * @param scheduledTime When the match should start (unix timestamp)
     * @return matchId The unique match identifier
     */
    function scheduleMatch(
        address player1,
        address player2,
        uint64 scheduledTime
    ) external onlyOwner returns (bytes32) {
        if (gameId == bytes32(0)) revert NotRegistered();

        bytes32 matchId = gameRegistry.scheduleMatch(
            gameId,
            scheduledTime,
            string(abi.encodePacked(
                '{"player1":"', _addressToString(player1),
                '","player2":"', _addressToString(player2),
                '","type":"best-of-3"}'
            ))
        );

        matches[matchId] = RPSMatch({
            matchId: matchId,
            player1: player1,
            player2: player2,
            scheduledTime: scheduledTime,
            status: MatchStatus.SCHEDULED,
            player1Cards: [Card.ROCK, Card.ROCK, Card.ROCK],
            player2Cards: [Card.ROCK, Card.ROCK, Card.ROCK],
            winner: address(0),
            player1Wins: 0,
            player2Wins: 0,
            randomSeed1: 0,
            randomSeed2: 0,
            completedAt: 0
        });

        matchCounter++;

        emit MatchScheduled(matchId, player1, player2, scheduledTime);

        return matchId;
    }

    /**
     * @notice Player commits to match - generates random cards
     * @param matchId The match to commit to
     */
    function commitToMatch(bytes32 matchId) external {
        RPSMatch storage rpsMatch = matches[matchId];

        if (rpsMatch.player1 == address(0)) revert MatchNotFound();
        if (rpsMatch.status == MatchStatus.COMPLETED) revert MatchAlreadyCompleted();
        if (block.timestamp < rpsMatch.scheduledTime) revert NotScheduledTime();

        bool isPlayer1 = msg.sender == rpsMatch.player1;
        bool isPlayer2 = msg.sender == rpsMatch.player2;

        if (!isPlayer1 && !isPlayer2) revert NotPlayer();

        if (isPlayer1) {
            if (rpsMatch.status != MatchStatus.SCHEDULED) revert AlreadyCommitted();

            // Generate random cards for player 1
            uint256 randomSeed = uint256(keccak256(abi.encodePacked(
                block.timestamp,
                block.prevrandao,
                msg.sender,
                matchId,
                matchCounter
            )));

            rpsMatch.randomSeed1 = randomSeed;
            rpsMatch.player1Cards = _generateRandomCards(randomSeed);
            rpsMatch.status = MatchStatus.PLAYER1_COMMITTED;

            emit PlayerCommitted(matchId, msg.sender, 1, rpsMatch.player1Cards);

        } else {
            if (rpsMatch.status != MatchStatus.PLAYER1_COMMITTED) revert Player1NotCommitted();

            // Generate random cards for player 2
            uint256 randomSeed = uint256(keccak256(abi.encodePacked(
                block.timestamp,
                block.prevrandao,
                msg.sender,
                matchId,
                rpsMatch.randomSeed1 // Use player 1's seed too for extra randomness
            )));

            rpsMatch.randomSeed2 = randomSeed;
            rpsMatch.player2Cards = _generateRandomCards(randomSeed);

            // Execute match immediately
            _executeMatch(matchId);
        }
    }

    /**
     * @notice Get match details
     * @param matchId The match identifier
     */
    function getMatch(bytes32 matchId) external view returns (RPSMatch memory) {
        return matches[matchId];
    }

    /**
     * @notice Get player statistics
     * @param player The player address
     */
    function getPlayerStats(address player) external view returns (uint256 wins, uint256 totalMatches) {
        return (playerWins[player], playerMatches[player]);
    }

    /**
     * @notice Withdraw oracle earnings
     */
    function withdrawEarnings() external onlyOwner {
        // Developer earnings are tracked in FeeManager
        // Call FeeManager.withdrawEarnings(gameId) to withdraw
    }

    // ============ Internal Functions ============

    /**
     * @notice Generate 3 random cards and shuffle them
     */
    function _generateRandomCards(uint256 seed) internal pure returns (Card[3] memory) {
        Card[3] memory cards;

        // Generate 3 random cards
        cards[0] = Card(seed % 3);
        cards[1] = Card((seed >> 8) % 3);
        cards[2] = Card((seed >> 16) % 3);

        // Shuffle using Fisher-Yates
        uint256 shuffleSeed = seed >> 24;
        for (uint256 i = 2; i > 0; i--) {
            uint256 j = shuffleSeed % (i + 1);
            shuffleSeed >>= 8;
            (cards[i], cards[j]) = (cards[j], cards[i]);
        }

        return cards;
    }

    /**
     * @notice Execute the match and determine winner
     */
    function _executeMatch(bytes32 matchId) internal {
        RPSMatch storage rpsMatch = matches[matchId];

        // Play all 3 rounds
        for (uint8 i = 0; i < 3; i++) {
            int8 result = _playRound(rpsMatch.player1Cards[i], rpsMatch.player2Cards[i]);
            if (result == 1) {
                rpsMatch.player1Wins++;
            } else if (result == -1) {
                rpsMatch.player2Wins++;
            }
        }

        // Determine overall winner
        if (rpsMatch.player1Wins > rpsMatch.player2Wins) {
            rpsMatch.winner = rpsMatch.player1;
            playerWins[rpsMatch.player1]++;
        } else if (rpsMatch.player2Wins > rpsMatch.player1Wins) {
            rpsMatch.winner = rpsMatch.player2;
            playerWins[rpsMatch.player2]++;
        }
        // else it's a tie, winner = address(0)

        playerMatches[rpsMatch.player1]++;
        playerMatches[rpsMatch.player2]++;

        rpsMatch.status = MatchStatus.COMPLETED;
        rpsMatch.completedAt = uint64(block.timestamp);

        emit CardsRevealed(matchId, rpsMatch.player1Cards, rpsMatch.player2Cards);
        emit MatchCompleted(matchId, rpsMatch.winner, rpsMatch.player1Wins, rpsMatch.player2Wins);

        // Submit result to oracle
        _submitToOracle(matchId);
    }

    /**
     * @notice Play a single round of RPS
     * @return 1 if player1 wins, -1 if player2 wins, 0 if tie
     */
    function _playRound(Card card1, Card card2) internal pure returns (int8) {
        if (card1 == card2) return 0;

        if (
            (card1 == Card.ROCK && card2 == Card.SCISSORS) ||
            (card1 == Card.PAPER && card2 == Card.ROCK) ||
            (card1 == Card.SCISSORS && card2 == Card.PAPER)
        ) {
            return 1; // Player 1 wins
        }

        return -1; // Player 2 wins
    }

    /**
     * @notice Submit match result to PredictBNB oracle
     */
    function _submitToOracle(bytes32 matchId) internal {
        RPSMatch storage rpsMatch = matches[matchId];

        // Encode result data
        bytes memory encodedData = abi.encode(
            rpsMatch.winner,
            rpsMatch.player1,
            rpsMatch.player2,
            rpsMatch.player1Wins,
            rpsMatch.player2Wins,
            rpsMatch.player1Cards,
            rpsMatch.player2Cards,
            rpsMatch.completedAt
        );

        string memory schema = "abi.encode(address winner, address player1, address player2, uint8 p1Wins, uint8 p2Wins, Card[3] p1Cards, Card[3] p2Cards, uint64 completedAt)";

        // Create quick-access fields
        bytes32[] memory fieldKeys = new bytes32[](5);
        bytes32[] memory fieldValues = new bytes32[](5);

        fieldKeys[0] = keccak256("WINNER");
        fieldValues[0] = bytes32(uint256(uint160(rpsMatch.winner)));

        fieldKeys[1] = keccak256("PLAYER1");
        fieldValues[1] = bytes32(uint256(uint160(rpsMatch.player1)));

        fieldKeys[2] = keccak256("PLAYER2");
        fieldValues[2] = bytes32(uint256(uint160(rpsMatch.player2)));

        fieldKeys[3] = keccak256("PLAYER1_WINS");
        fieldValues[3] = bytes32(uint256(rpsMatch.player1Wins));

        fieldKeys[4] = keccak256("PLAYER2_WINS");
        fieldValues[4] = bytes32(uint256(rpsMatch.player2Wins));

        oracleCore.submitResult(
            matchId,
            encodedData,
            schema,
            fieldKeys,
            fieldValues
        );
    }

    /**
     * @notice Convert address to string (for metadata)
     */
    function _addressToString(address addr) internal pure returns (string memory) {
        bytes32 value = bytes32(uint256(uint160(addr)));
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(42);
        str[0] = '0';
        str[1] = 'x';
        for (uint256 i = 0; i < 20; i++) {
            str[2+i*2] = alphabet[uint8(value[i + 12] >> 4)];
            str[3+i*2] = alphabet[uint8(value[i + 12] & 0x0f)];
        }
        return string(str);
    }
}
