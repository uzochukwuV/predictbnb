// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../OracleCore.sol";
import "../GameRegistry.sol";
import "../interfaces/IVirtualFootballGame.sol";

/**
 * @title VirtualFootballGame
 * @notice Manages virtual football matches and submits results to PredictBNB oracle
 * @dev This contract is the "game developer" that creates matches and submits results
 */
contract VirtualFootballGame is IVirtualFootballGame, Ownable {
    // ============ State Variables ============

    OracleCore public oracleCore;
    GameRegistry public gameRegistry;
    bytes32 public gameId;

    // Team names (10 teams)
    string[10] public teamNames;

    // Season management
    uint32 public currentSeasonId;
    mapping(uint32 => Season) public seasons;
    mapping(uint32 => mapping(uint8 => TeamStats)) public seasonTeamStats;
    mapping(uint32 => uint64[]) public seasonMatches;

    // Match management
    uint64 public matchCounter;
    mapping(uint64 => Match) public matches;
    mapping(bytes32 => uint64) public oracleMatchIdToGameMatchId; // oracle matchId => game matchId

    // Constants
    uint64 public constant SEASON_DURATION = 1 days; // Shortened for MVP
    uint64 public constant MATCH_INTERVAL = 10 minutes;

    // ============ Constructor ============

    constructor(
        address _oracleCore,
        address _gameRegistry
    ) Ownable(msg.sender) {
        oracleCore = OracleCore(_oracleCore);
        gameRegistry = GameRegistry(_gameRegistry);

        // Initialize team names
        teamNames[0] = "Manchester City";
        teamNames[1] = "Arsenal";
        teamNames[2] = "Liverpool";
        teamNames[3] = "Manchester United";
        teamNames[4] = "Chelsea";
        teamNames[5] = "Tottenham";
        teamNames[6] = "Newcastle";
        teamNames[7] = "Brighton";
        teamNames[8] = "Aston Villa";
        teamNames[9] = "West Ham";
    }

    // ============ External Functions ============

    /**
     * @notice Register this game with PredictBNB
     */
    function registerGame() external payable onlyOwner {
        require(gameId == bytes32(0), "Already registered");

        bytes32 newGameId = gameRegistry.registerGame{value: msg.value}(
            "Virtual Football",
            "Automated virtual football with 10 Premier League teams"
        );

        gameId = newGameId;
    }

    /**
     * @notice Create a new season
     */
    function createSeason(uint64 startTime) external onlyOwner returns (uint32) {
        require(startTime > block.timestamp, "Start time must be in future");

        currentSeasonId++;
        uint32 seasonId = currentSeasonId;

        Season storage season = seasons[seasonId];
        season.seasonId = seasonId;
        season.startTime = startTime;
        season.endTime = startTime + SEASON_DURATION;
        season.status = SeasonStatus.UPCOMING;

        emit SeasonCreated(seasonId, startTime, season.endTime);

        return seasonId;
    }

    /**
     * @notice Start a season and generate all matches
     */
    function startSeason(uint32 seasonId) external {
        Season storage season = seasons[seasonId];
        require(season.seasonId != 0, "Season not found");
        require(season.status == SeasonStatus.UPCOMING, "Season not upcoming");
        require(block.timestamp >= season.startTime, "Too early to start");

        season.status = SeasonStatus.ACTIVE;

        // Generate all matches for the season
        _generateSeasonMatches(seasonId);

        emit SeasonStarted(seasonId);
    }

    /**
     * @notice Simulate a match and submit result to oracle
     * @param matchId The internal match ID
     */
    function simulateMatch(uint64 matchId) external {
        Match storage matchData = matches[matchId];
        require(matchData.matchId != 0, "Match not found");
        require(block.timestamp >= matchData.kickoffTime, "Match not started");
        require(!matchData.isFinalized, "Already finalized");

        // Simple simulation using block hash
        uint256 randomSeed = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            matchId
        )));

        // Generate scores (0-5 goals each)
        uint8 homeScore = uint8(randomSeed % 6);
        uint8 awayScore = uint8((randomSeed / 6) % 6);

        matchData.homeScore = homeScore;
        matchData.awayScore = awayScore;
        matchData.isFinalized = true;

        // Update team stats
        _updateTeamStats(matchData.seasonId, matchData.homeTeam, matchData.awayTeam, homeScore, awayScore);

        // Submit result to oracle (match already scheduled)
        _submitToOracle(matchId, matchData, homeScore, awayScore);

        emit MatchFinalized(matchId, matchData.oracleMatchId, homeScore, awayScore);
    }

    /**
     * @notice End a season and determine winner
     */
    function endSeason(uint32 seasonId) external {
        Season storage season = seasons[seasonId];
        require(season.seasonId != 0, "Season not found");
        require(season.status == SeasonStatus.ACTIVE, "Season not active");
        require(block.timestamp >= season.endTime, "Season not ended yet");

        season.status = SeasonStatus.COMPLETED;

        // Determine season winner (team with most points)
        uint8 winner = _calculateSeasonWinner(seasonId);

        emit SeasonEnded(seasonId, winner);
    }

    // ============ View Functions ============

    function getSeason(uint32 seasonId) external view returns (Season memory) {
        return seasons[seasonId];
    }

    function getMatch(uint64 matchId) external view returns (Match memory) {
        return matches[matchId];
    }

    function getTeamStats(uint32 seasonId, uint8 teamId) external view returns (TeamStats memory) {
        return seasonTeamStats[seasonId][teamId];
    }

    function getTeamName(uint8 teamId) external view returns (string memory) {
        require(teamId < 10, "Invalid team ID");
        return teamNames[teamId];
    }

    function getSeasonMatches(uint32 seasonId) external view returns (uint64[] memory) {
        return seasonMatches[seasonId];
    }

    // ============ Internal Functions ============

    /**
     * @notice Generate matches for a season
     * @dev Creates 20 matches with 10-minute intervals, schedules all with oracle upfront
     */
    function _generateSeasonMatches(uint32 seasonId) internal {
        Season storage season = seasons[seasonId];
        // Start matches 5 minutes after season begins to ensure they're in the future
        uint64 currentTime = uint64(block.timestamp) + 5 minutes;
        uint64 matchId = matchCounter;

        // Generate 20 matches (can be random matchups or round-robin subset)
        for (uint8 i = 0; i < 20; i++) {
            matchId++;

            // Simple matchup: alternate between different teams
            uint8 homeTeam = i % 10;
            uint8 awayTeam = (i + 5) % 10; // Ensures different team

            Match storage newMatch = matches[matchId];
            newMatch.matchId = matchId;
            newMatch.seasonId = seasonId;
            newMatch.homeTeam = homeTeam;
            newMatch.awayTeam = awayTeam;
            newMatch.kickoffTime = currentTime;

            // Schedule with oracle immediately (gas-efficient for 20 matches)
            bytes32 oracleMatchId = _scheduleMatchWithOracle(matchId, newMatch, currentTime);
            newMatch.oracleMatchId = oracleMatchId;
            oracleMatchIdToGameMatchId[oracleMatchId] = matchId;

            seasonMatches[seasonId].push(matchId);
            season.totalMatches++;

            emit MatchCreated(matchId, seasonId, homeTeam, awayTeam, currentTime);

            currentTime += MATCH_INTERVAL;
        }

        matchCounter = matchId;
    }

    /**
     * @notice Schedule a match with the oracle (called when match is created)
     */
    function _scheduleMatchWithOracle(
        uint64 matchId,
        Match storage matchData,
        uint64 kickoffTime
    ) internal returns (bytes32) {
        string memory metadata = string(abi.encodePacked(
            "VF Match #", _uint2str(matchId),
            " - Team ", _uint2str(matchData.homeTeam),
            " vs Team ", _uint2str(matchData.awayTeam)
        ));

        bytes32 oracleMatchId = gameRegistry.scheduleMatch(
            gameId,
            kickoffTime,
            metadata
        );

        return oracleMatchId;
    }

    /**
     * @notice Submit match result to PredictBNB oracle
     */
    function _submitToOracle(
        uint64 matchId,
        Match storage matchData,
        uint8 homeScore,
        uint8 awayScore
    ) internal {
        // Match should already be scheduled during season start
        bytes32 oracleMatchId = matchData.oracleMatchId;
        require(oracleMatchId != bytes32(0), "Match not scheduled with oracle");

        // Determine winner
        address winner;
        if (homeScore > awayScore) {
            winner = address(uint160(matchData.homeTeam)); // Home team wins
        } else if (awayScore > homeScore) {
            winner = address(uint160(matchData.awayTeam)); // Away team wins
        } else {
            winner = address(0); // Draw
        }

        // Create result fields
        bytes32[] memory fields = new bytes32[](4);
        bytes32[] memory values = new bytes32[](4);

        fields[0] = keccak256("winner");
        values[0] = bytes32(uint256(uint160(winner)));

        fields[1] = keccak256("homeScore");
        values[1] = bytes32(uint256(homeScore));

        fields[2] = keccak256("awayScore");
        values[2] = bytes32(uint256(awayScore));

        fields[3] = keccak256("matchId");
        values[3] = bytes32(uint256(matchId));

        // Encode data
        bytes memory encodedData = abi.encode(winner, homeScore, awayScore, matchId);
        string memory schema = "address,uint8,uint8,uint64";

        // Submit result to oracle
        oracleCore.submitResult(oracleMatchId, encodedData, schema, fields, values);
    }

    /**
     * @notice Helper to convert uint to string
     */
    function _uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }

    /**
     * @notice Update team statistics after match
     */
    function _updateTeamStats(
        uint32 seasonId,
        uint8 homeTeam,
        uint8 awayTeam,
        uint8 homeScore,
        uint8 awayScore
    ) internal {
        TeamStats storage homeStats = seasonTeamStats[seasonId][homeTeam];
        TeamStats storage awayStats = seasonTeamStats[seasonId][awayTeam];

        homeStats.matchesPlayed++;
        awayStats.matchesPlayed++;

        homeStats.goalsScored += homeScore;
        homeStats.goalsConceded += awayScore;
        awayStats.goalsScored += awayScore;
        awayStats.goalsConceded += homeScore;

        if (homeScore > awayScore) {
            homeStats.wins++;
            homeStats.points += 3;
            awayStats.losses++;
        } else if (awayScore > homeScore) {
            awayStats.wins++;
            awayStats.points += 3;
            homeStats.losses++;
        } else {
            homeStats.draws++;
            awayStats.draws++;
            homeStats.points += 1;
            awayStats.points += 1;
        }
    }

    /**
     * @notice Calculate season winner based on points
     */
    function _calculateSeasonWinner(uint32 seasonId) internal view returns (uint8) {
        int16 maxPoints = -1;
        uint8 winner = 0;

        for (uint8 i = 0; i < 10; i++) {
            TeamStats storage stats = seasonTeamStats[seasonId][i];
            if (stats.points > maxPoints) {
                maxPoints = stats.points;
                winner = i;
            }
        }

        return winner;
    }

    receive() external payable {}
}
