// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title IVirtualFootballGame
 * @notice Interface for Virtual Football game that manages matches and submits to oracle
 */
interface IVirtualFootballGame {
    // Enums
    enum SeasonStatus { UPCOMING, ACTIVE, COMPLETED }

    // Structs
    struct Season {
        uint32 seasonId;
        uint64 startTime;
        uint64 endTime;
        SeasonStatus status;
        uint256 totalMatches;
    }

    struct Match {
        uint64 matchId;
        uint32 seasonId;
        uint8 homeTeam;
        uint8 awayTeam;
        uint64 kickoffTime;
        uint8 homeScore;
        uint8 awayScore;
        bool isFinalized;
        bytes32 oracleMatchId; // The matchId submitted to oracle
    }

    struct TeamStats {
        uint16 matchesPlayed;
        uint16 wins;
        uint16 draws;
        uint16 losses;
        uint32 goalsScored;
        uint32 goalsConceded;
        int16 points;
        uint8 position;
    }

    // Events
    event SeasonCreated(uint32 indexed seasonId, uint64 startTime, uint64 endTime);
    event SeasonStarted(uint32 indexed seasonId);
    event SeasonEnded(uint32 indexed seasonId, uint8 winner);
    event MatchCreated(uint64 indexed matchId, uint32 indexed seasonId, uint8 homeTeam, uint8 awayTeam, uint64 kickoffTime);
    event MatchFinalized(uint64 indexed matchId, bytes32 indexed oracleMatchId, uint8 homeScore, uint8 awayScore);

    // View functions
    function currentSeasonId() external view returns (uint32);
    function getSeason(uint32 seasonId) external view returns (Season memory);
    function getMatch(uint64 matchId) external view returns (Match memory);
    function getTeamStats(uint32 seasonId, uint8 teamId) external view returns (TeamStats memory);
    function getTeamName(uint8 teamId) external view returns (string memory);
    function getSeasonMatches(uint32 seasonId) external view returns (uint64[] memory);
    function gameId() external view returns (bytes32);

    // State-changing functions
    function createSeason(uint64 startTime) external returns (uint32);
    function startSeason(uint32 seasonId) external;
    function simulateMatch(uint64 matchId) external;
    function endSeason(uint32 seasonId) external;
}
