// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title GameRegistry
 * @notice Core contract for registering games and scheduling matches for the gaming oracle
 * @dev Game developers register their games and schedule matches that can be used by prediction markets
 */
contract GameRegistry is Ownable, ReentrancyGuard {
    // Minimum stake required to register a game (anti-spam + slashing mechanism)
    uint256 public constant REGISTRATION_STAKE = 0.1 ether;

    // Game types enum for categorization
    enum GameType {
        MOBA,           // League of Legends, Dota 2
        FPS,            // CS:GO, Valorant
        BattleRoyale,   // Fortnite, PUBG
        Sports,         // FIFA, NBA 2K
        Fighting,       // Street Fighter, Tekken
        RTS,            // StarCraft
        CardGame,       // Hearthstone, Magic
        Other
    }

    // Match status enum
    enum MatchStatus {
        Scheduled,      // Match is scheduled but not started
        InProgress,     // Match is currently ongoing
        Completed,      // Match is finished and result submitted
        Disputed,       // Match result is under dispute
        Finalized,      // Match result is finalized (after dispute period)
        Cancelled       // Match was cancelled
    }

    // Game struct
    struct Game {
        string name;
        string gameId;          // Unique identifier from game developer
        GameType gameType;
        address developer;
        uint256 stakedAmount;
        bool isActive;
        uint256 registeredAt;
        uint256 totalMatches;
        uint256 reputationScore;    // 0-1000, starts at 500
    }

    // Match struct
    struct Match {
        bytes32 matchId;            // keccak256(gameId, developerMatchId, timestamp)
        string gameId;
        string developerMatchId;    // Match ID from game developer's system
        uint256 scheduledTime;
        uint256 actualStartTime;
        MatchStatus status;
        string metadata;            // JSON string with teams, players, etc.
        address submitter;          // Who submitted the result
        uint256 submittedAt;
    }

    // Storage
    mapping(string => Game) public games;                       // gameId => Game
    mapping(bytes32 => Match) public matches;                   // matchId => Match
    mapping(address => string[]) public developerGames;         // developer => gameIds[]
    mapping(string => bytes32[]) public gameMatches;            // gameId => matchIds[]

    string[] public allGameIds;
    bytes32[] public allMatchIds;

    // Events
    event GameRegistered(
        string indexed gameId,
        string name,
        GameType gameType,
        address indexed developer,
        uint256 stakedAmount
    );

    event GameDeactivated(string indexed gameId, address indexed developer);

    event MatchScheduled(
        bytes32 indexed matchId,
        string indexed gameId,
        string developerMatchId,
        uint256 scheduledTime,
        string metadata
    );

    event MatchStatusChanged(
        bytes32 indexed matchId,
        MatchStatus oldStatus,
        MatchStatus newStatus
    );

    event StakeSlashed(
        string indexed gameId,
        address indexed developer,
        uint256 slashedAmount,
        string reason
    );

    event ReputationUpdated(
        string indexed gameId,
        uint256 oldScore,
        uint256 newScore
    );

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Register a new game with the oracle
     * @param _gameId Unique identifier for the game
     * @param _name Human-readable game name
     * @param _gameType Type of game from GameType enum
     */
    function registerGame(
        string calldata _gameId,
        string calldata _name,
        GameType _gameType
    ) external payable nonReentrant {
        require(bytes(_gameId).length > 0, "GameRegistry: Empty game ID");
        require(bytes(_name).length > 0, "GameRegistry: Empty name");
        require(games[_gameId].developer == address(0), "GameRegistry: Game already registered");
        require(msg.value == REGISTRATION_STAKE, "GameRegistry: Incorrect stake amount");

        games[_gameId] = Game({
            name: _name,
            gameId: _gameId,
            gameType: _gameType,
            developer: msg.sender,
            stakedAmount: msg.value,
            isActive: true,
            registeredAt: block.timestamp,
            totalMatches: 0,
            reputationScore: 500  // Start with neutral reputation
        });

        developerGames[msg.sender].push(_gameId);
        allGameIds.push(_gameId);

        emit GameRegistered(_gameId, _name, _gameType, msg.sender, msg.value);
    }

    /**
     * @notice Schedule a new match for a registered game
     * @param _gameId The game this match belongs to
     * @param _developerMatchId Unique match ID from developer's system
     * @param _scheduledTime When the match is scheduled to start
     * @param _metadata JSON string with match details (teams, players, etc.)
     */
    function scheduleMatch(
        string calldata _gameId,
        string calldata _developerMatchId,
        uint256 _scheduledTime,
        string calldata _metadata
    ) external returns (bytes32) {
        Game storage game = games[_gameId];
        require(game.isActive, "GameRegistry: Game not active");
        require(game.developer == msg.sender, "GameRegistry: Only game developer can schedule");
        require(_scheduledTime > block.timestamp, "GameRegistry: Must schedule in future");
        require(bytes(_developerMatchId).length > 0, "GameRegistry: Empty match ID");

        // Create unique match ID
        bytes32 matchId = keccak256(
            abi.encodePacked(_gameId, _developerMatchId, _scheduledTime, block.timestamp)
        );

        require(matches[matchId].scheduledTime == 0, "GameRegistry: Match already exists");

        matches[matchId] = Match({
            matchId: matchId,
            gameId: _gameId,
            developerMatchId: _developerMatchId,
            scheduledTime: _scheduledTime,
            actualStartTime: 0,
            status: MatchStatus.Scheduled,
            metadata: _metadata,
            submitter: address(0),
            submittedAt: 0
        });

        gameMatches[_gameId].push(matchId);
        allMatchIds.push(matchId);
        game.totalMatches++;

        emit MatchScheduled(matchId, _gameId, _developerMatchId, _scheduledTime, _metadata);

        return matchId;
    }

    /**
     * @notice Update match status (called by OracleCore contract)
     * @param _matchId The match to update
     * @param _newStatus New status for the match
     */
    function updateMatchStatus(
        bytes32 _matchId,
        MatchStatus _newStatus
    ) external onlyOwner {
        Match storage matchData = matches[_matchId];
        require(matchData.scheduledTime > 0, "GameRegistry: Match does not exist");

        MatchStatus oldStatus = matchData.status;
        matchData.status = _newStatus;

        if (_newStatus == MatchStatus.InProgress && matchData.actualStartTime == 0) {
            matchData.actualStartTime = block.timestamp;
        }

        emit MatchStatusChanged(_matchId, oldStatus, _newStatus);
    }

    /**
     * @notice Slash stake from a game developer for malicious behavior
     * @param _gameId The game whose stake to slash
     * @param _slashAmount Amount to slash
     * @param _reason Reason for slashing
     */
    function slashStake(
        string calldata _gameId,
        uint256 _slashAmount,
        string calldata _reason
    ) external onlyOwner nonReentrant {
        Game storage game = games[_gameId];
        require(game.stakedAmount >= _slashAmount, "GameRegistry: Insufficient stake");

        game.stakedAmount -= _slashAmount;

        // If stake drops below minimum, deactivate game
        if (game.stakedAmount < REGISTRATION_STAKE) {
            game.isActive = false;
            emit GameDeactivated(_gameId, game.developer);
        }

        emit StakeSlashed(_gameId, game.developer, _slashAmount, _reason);

        // Transfer slashed amount to protocol treasury (owner)
        payable(owner()).transfer(_slashAmount);
    }

    /**
     * @notice Update reputation score for a game (called by OracleCore after disputes)
     * @param _gameId The game to update
     * @param _newScore New reputation score (0-1000)
     */
    function updateReputation(
        string calldata _gameId,
        uint256 _newScore
    ) external onlyOwner {
        require(_newScore <= 1000, "GameRegistry: Score must be <= 1000");
        Game storage game = games[_gameId];
        require(game.developer != address(0), "GameRegistry: Game does not exist");

        uint256 oldScore = game.reputationScore;
        game.reputationScore = _newScore;

        emit ReputationUpdated(_gameId, oldScore, _newScore);
    }

    /**
     * @notice Deactivate a game (developer can withdraw stake after cooldown)
     * @param _gameId The game to deactivate
     */
    function deactivateGame(string calldata _gameId) external nonReentrant {
        Game storage game = games[_gameId];
        require(game.developer == msg.sender, "GameRegistry: Only developer can deactivate");
        require(game.isActive, "GameRegistry: Game already inactive");

        game.isActive = false;

        emit GameDeactivated(_gameId, msg.sender);
    }

    /**
     * @notice Withdraw stake after deactivating (7 day cooldown)
     * @param _gameId The game to withdraw stake from
     */
    function withdrawStake(string calldata _gameId) external nonReentrant {
        Game storage game = games[_gameId];
        require(game.developer == msg.sender, "GameRegistry: Only developer can withdraw");
        require(!game.isActive, "GameRegistry: Game must be deactivated first");
        require(game.stakedAmount > 0, "GameRegistry: No stake to withdraw");

        // 7 day cooldown period
        require(
            block.timestamp >= game.registeredAt + 7 days,
            "GameRegistry: Cooldown period not elapsed"
        );

        uint256 amount = game.stakedAmount;
        game.stakedAmount = 0;

        payable(msg.sender).transfer(amount);
    }

    // View functions

    function getGame(string calldata _gameId) external view returns (Game memory) {
        return games[_gameId];
    }

    function getMatch(bytes32 _matchId) external view returns (Match memory) {
        return matches[_matchId];
    }

    function getDeveloperGames(address _developer) external view returns (string[] memory) {
        return developerGames[_developer];
    }

    function getGameMatches(string calldata _gameId) external view returns (bytes32[] memory) {
        return gameMatches[_gameId];
    }

    function getAllGames() external view returns (string[] memory) {
        return allGameIds;
    }

    function getTotalGames() external view returns (uint256) {
        return allGameIds.length;
    }

    function getTotalMatches() external view returns (uint256) {
        return allMatchIds.length;
    }
}
