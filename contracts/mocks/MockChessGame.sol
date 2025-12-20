// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "../GameRegistry.sol";
import "../OracleCore.sol";
import "../libraries/OracleSubmissionHelper.sol";

/**
 * @title MockChessGame
 * @notice A mock chess game that demonstrates how to integrate with PredictBNB
 * @dev Example implementation for testing purposes
 */
contract MockChessGame {
    using OracleSubmissionHelper for *;

    GameRegistry public gameRegistry;
    OracleCore public oracleCore;

    address public owner;
    bytes32 public gameId;
    uint256 public matchCounter;

    struct ChessMatch {
        bytes32 matchId;
        address player1;
        address player2;
        uint64 scheduledTime;
        bool isCompleted;
    }

    mapping(bytes32 => ChessMatch) public matches;
    mapping(address => uint256) public playerWins;

    event MatchCreated(bytes32 indexed matchId, address player1, address player2);
    event MatchCompleted(bytes32 indexed matchId, address winner, uint256 moves);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address _gameRegistry, address _oracleCore) {
        gameRegistry = GameRegistry(_gameRegistry);
        oracleCore = OracleCore(_oracleCore);
        owner = msg.sender;
    }

    /**
     * @notice Register this game with the oracle
     */
    function registerWithOracle() external payable {
        require(gameId == bytes32(0), "Already registered");

        gameId = gameRegistry.registerGame{value: msg.value}(
            "OnChain Chess",
            '{"genre": "Board Game", "website": "https://chess.example.com", "maxPlayers": 2}'
        );
    }

    /**
     * @notice Schedule a new chess match
     */
    function scheduleMatch(
        address player1,
        address player2,
        uint64 scheduledTime
    ) external returns (bytes32) {
        require(gameId != bytes32(0), "Game not registered");
        require(player1 != player2, "Players must be different");

        // Schedule match in oracle
        bytes32 matchId = gameRegistry.scheduleMatch(
            gameId,
            scheduledTime,
            string(abi.encodePacked(
                '{"player1": "', toAsciiString(player1),
                '", "player2": "', toAsciiString(player2), '"}'
            ))
        );

        matches[matchId] = ChessMatch({
            matchId: matchId,
            player1: player1,
            player2: player2,
            scheduledTime: scheduledTime,
            isCompleted: false
        });

        matchCounter++;

        emit MatchCreated(matchId, player1, player2);

        return matchId;
    }

    /**
     * @notice Submit match result to oracle
     */
    function submitMatchResult(
        bytes32 matchId,
        address winner,
        uint256 moves,
        uint256 duration
    ) external onlyOwner {
        ChessMatch storage chessMatch = matches[matchId];
        require(chessMatch.matchId != bytes32(0), "Match not found");
        require(!chessMatch.isCompleted, "Match already completed");
        require(
            winner == chessMatch.player1 || winner == chessMatch.player2,
            "Invalid winner"
        );
        require(block.timestamp >= chessMatch.scheduledTime, "Match not started");

        // Prepare result data with helper library
        bytes memory encodedData = abi.encode(winner, moves, duration);
        string memory decodeSchema = "(address winner, uint256 moves, uint256 duration)";

        // Quick-access fields for prediction markets
        bytes32[] memory keys = new bytes32[](3);
        bytes32[] memory values = new bytes32[](3);

        keys[0] = keccak256("winner");
        values[0] = bytes32(uint256(uint160(winner)));

        keys[1] = keccak256("moves");
        values[1] = bytes32(moves);

        keys[2] = keccak256("duration");
        values[2] = bytes32(duration);

        // Submit to oracle
        oracleCore.submitResult(
            matchId,
            encodedData,
            decodeSchema,
            keys,
            values
        );

        chessMatch.isCompleted = true;
        playerWins[winner]++;

        emit MatchCompleted(matchId, winner, moves);
    }

    /**
     * @notice Get match details
     */
    function getMatch(bytes32 matchId) external view returns (ChessMatch memory) {
        return matches[matchId];
    }

    /**
     * @notice Withdraw earnings from FeeManager (for testing)
     */
    function withdrawEarnings(address payable feeManagerAddress, address recipient) external {
        require(gameId != bytes32(0), "Game not registered");

        FeeManager feeManager = FeeManager(feeManagerAddress);
        feeManager.withdrawEarnings(gameId);

        // Transfer to recipient
        uint256 balance = address(this).balance;
        if (balance > 0) {
            (bool success, ) = recipient.call{value: balance}("");
            require(success, "Transfer failed");
        }
    }

    /**
     * @notice Helper to convert address to ASCII string
     */
    function toAsciiString(address x) internal pure returns (string memory) {
        bytes memory s = new bytes(40);
        for (uint i = 0; i < 20; i++) {
            bytes1 b = bytes1(uint8(uint(uint160(x)) / (2**(8*(19 - i)))));
            bytes1 hi = bytes1(uint8(b) / 16);
            bytes1 lo = bytes1(uint8(b) - 16 * uint8(hi));
            s[2*i] = char(hi);
            s[2*i+1] = char(lo);
        }
        return string(s);
    }

    function char(bytes1 b) internal pure returns (bytes1 c) {
        if (uint8(b) < 10) return bytes1(uint8(b) + 0x30);
        else return bytes1(uint8(b) + 0x57);
    }

    // Allow contract to receive ETH
    receive() external payable {}
}
