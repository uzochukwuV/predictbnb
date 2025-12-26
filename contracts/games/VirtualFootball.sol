// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../OracleCore.sol";
import "../FeeManagerV2.sol";
import "../GameRegistry.sol";

/**
 * @title VirtualFootball
 * @notice Virtual football betting game with seasons, voting, and copy betting
 * @dev Implements automated match generation, seasonal competitions, and social betting features
 */
contract VirtualFootball is ReentrancyGuard, Ownable {
    // ============ Enums ============

    enum SeasonStatus { UPCOMING, ACTIVE, COMPLETED }
    enum BetType { MATCH_WINNER, OVER_UNDER, BOTH_TEAMS_SCORE }
    enum BetSlipType { SINGLE, MULTI, SYSTEM }
    enum BetSlipStatus { PENDING, WON, LOST, PARTIAL_WIN }

    // ============ Structs ============

    struct Season {
        uint32 seasonId;
        uint64 startTime;
        uint64 endTime;
        SeasonStatus status;
        uint8 communityPredictedWinner;
        uint128 votingRewardPool;
        uint128 totalBettingVolume;
        uint32 totalVotes;
        uint256 totalMatches;
        bool rewardsDistributed;
    }

    struct TeamStats {
        uint16 matchesPlayed;
        uint16 wins;
        uint16 draws;
        uint16 losses;
        uint32 goalsScored;
        uint32 goalsConceded;
        int16 points; // 3 for win, 1 for draw
        uint8 position; // League position (1-10)
    }

    struct Vote {
        address voter;
        uint8 predictedWinner;
        uint64 votedAt;
        bool claimed;
        bool isEarlyVoter; // Voted in first 24 hours
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
        uint128 totalPool;
    }

    struct SingleBet {
        uint256 betId;
        address bettor;
        uint64 matchId;
        BetType betType;
        uint8 selection;
        uint128 amount;
        uint16 odds; // Multiplied by 100 (150 = 1.5x)
        bool isSettled;
        bool isWon;
        bool isClaimed;
    }

    struct BetSlip {
        uint256 slipId;
        address bettor;
        uint256[] betIds;
        BetSlipType slipType;
        uint128 totalStake;
        uint128 potentialWinnings;
        uint32 totalOdds; // Multiplied odds
        BetSlipStatus status;
        bool isClaimed;
    }

    struct Tipster {
        address tipsterAddress;
        string name;
        uint32 totalBets;
        uint32 winningBets;
        int128 totalProfit; // Can be negative
        uint32 followersCount;
        uint16 winRate; // Percentage * 100
        bool isVerified;
    }

    struct CopySettings {
        address tipster;
        uint128 maxBetAmount;
        uint128 totalBudget;
        uint128 usedBudget;
        bool autoFollow;
    }

    // ============ State Variables ============

    OracleCore public oracleCore;
    FeeManagerV2 public feeManager;
    GameRegistry public gameRegistry;
    bytes32 public gameId;

    // Team names (10 teams)
    string[10] public teamNames;

    // Season management
    uint32 public currentSeasonId;
    mapping(uint32 => Season) public seasons;
    mapping(uint32 => mapping(uint8 => TeamStats)) public seasonTeamStats;
    mapping(uint32 => mapping(address => Vote)) public seasonVotes;
    mapping(uint32 => mapping(uint8 => uint32)) public teamVoteCounts;
    mapping(uint32 => address[]) public seasonVoters;

    // Match management
    uint64 public matchCounter;
    mapping(uint64 => Match) public matches;
    mapping(uint32 => uint64[]) public seasonMatches;

    // Betting
    uint256 public betCounter;
    uint256 public betSlipCounter;
    mapping(uint256 => SingleBet) public bets;
    mapping(uint256 => BetSlip) public betSlips;
    mapping(address => uint256[]) public userBets;
    mapping(address => uint256[]) public userBetSlips;
    mapping(uint64 => mapping(BetType => mapping(uint8 => uint128))) public matchPools;

    // Tipster system
    mapping(address => Tipster) public tipsters;
    mapping(address => address[]) public tipsterFollowers;
    mapping(address => CopySettings) public copySettings;
    mapping(uint256 => address) public betToTipster;
    mapping(uint256 => uint256) public copiedBetToOriginal;

    // Constants
    uint64 public constant SEASON_DURATION = 14 days;
    uint64 public constant MATCH_INTERVAL = 30 minutes;
    uint256 public constant MATCHES_PER_DAY = 48;
    uint256 public constant VOTING_REWARD_PERCENTAGE = 1; // 1% of betting volume
    uint256 public constant EARLY_VOTER_BONUS = 20; // 20% bonus
    uint256 public constant TIPSTER_COMMISSION = 2; // 2% of copier winnings
    uint256 public constant PLATFORM_FEE = 5; // 5% of betting pool

    // ============ Events ============

    event SeasonCreated(uint32 indexed seasonId, uint64 startTime, uint64 endTime);
    event SeasonStarted(uint32 indexed seasonId);
    event SeasonEnded(uint32 indexed seasonId, uint8 winner);
    event VoteCast(address indexed voter, uint32 indexed seasonId, uint8 teamId, bool isEarlyVoter);
    event VotingRewardClaimed(address indexed voter, uint32 indexed seasonId, uint128 amount);

    event MatchCreated(uint64 indexed matchId, uint32 indexed seasonId, uint8 homeTeam, uint8 awayTeam, uint64 kickoffTime);
    event MatchFinalized(uint64 indexed matchId, uint8 homeScore, uint8 awayScore);

    event BetPlaced(uint256 indexed betId, address indexed bettor, uint64 indexed matchId, BetType betType, uint128 amount);
    event BetSlipPlaced(uint256 indexed slipId, address indexed bettor, BetSlipType slipType, uint128 stake, uint128 potentialWinnings);
    event BetSettled(uint256 indexed betId, bool isWon, uint128 payout);
    event BetClaimed(uint256 indexed betId, address indexed bettor, uint128 amount);

    event TipsterRegistered(address indexed tipster, string name);
    event TipsterFollowed(address indexed follower, address indexed tipster);
    event TipsterUnfollowed(address indexed follower, address indexed tipster);
    event BetCopied(address indexed copier, address indexed tipster, uint256 copyBetId, uint256 originalBetId);
    event TipsterCommissionPaid(address indexed tipster, uint256 indexed betId, uint128 amount);

    // ============ Errors ============

    error SeasonNotFound();
    error SeasonNotUpcoming();
    error SeasonNotActive();
    error SeasonNotCompleted();
    error AlreadyVoted();
    error VotingClosed();
    error InvalidTeamId();
    error MatchNotFound();
    error MatchNotStarted();
    error MatchAlreadyFinalized();
    error BettingClosed();
    error InvalidBetAmount();
    error InvalidOdds();
    error BetNotFound();
    error BetAlreadySettled();
    error BetAlreadyClaimed();
    error NotBetOwner();
    error InsufficientBalance();
    error TipsterNotFound();
    error AlreadyFollowing();
    error NotFollowing();
    error InvalidCopySettings();

    // ============ Constructor ============

    constructor(
        address _oracleCore,
        address payable _feeManager,
        address _gameRegistry
    ) Ownable(msg.sender) {
        oracleCore = OracleCore(_oracleCore);
        feeManager = FeeManagerV2(_feeManager);
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

    // ============ Season Management ============

    /**
     * @notice Create a new season
     * @param startTime When the season starts
     * @return seasonId The created season ID
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
     * @notice Start a season (callable by anyone when time arrives)
     */
    function startSeason(uint32 seasonId) external {
        Season storage season = seasons[seasonId];
        if (season.seasonId == 0) revert SeasonNotFound();
        if (season.status != SeasonStatus.UPCOMING) revert SeasonNotUpcoming();
        require(block.timestamp >= season.startTime, "Too early to start");

        season.status = SeasonStatus.ACTIVE;

        // Generate all matches for the season
        _generateSeasonMatches(seasonId);

        emit SeasonStarted(seasonId);
    }

    /**
     * @notice End a season and determine winner
     */
    function endSeason(uint32 seasonId) external {
        Season storage season = seasons[seasonId];
        if (season.seasonId == 0) revert SeasonNotFound();
        if (season.status != SeasonStatus.ACTIVE) revert SeasonNotActive();
        require(block.timestamp >= season.endTime, "Season not ended yet");

        season.status = SeasonStatus.COMPLETED;

        // Determine season winner (team with most points)
        uint8 winner = _calculateSeasonWinner(seasonId);

        // Update community prediction
        season.communityPredictedWinner = winner;

        emit SeasonEnded(seasonId, winner);
    }

    /**
     * @notice Generate matches for a season
     * @dev Creates round-robin schedule with ~336 matches
     */
    function _generateSeasonMatches(uint32 seasonId) internal {
        Season storage season = seasons[seasonId];
        uint64 currentTime = season.startTime;
        uint64 matchId = matchCounter;

        // Round-robin: each team plays every other team 3-4 times
        // Total: 10 teams × 9 opponents × 3.7 avg = ~333 matches
        for (uint8 round = 0; round < 4; round++) {
            for (uint8 i = 0; i < 10; i++) {
                for (uint8 j = i + 1; j < 10; j++) {
                    // Create match: team i vs team j
                    matchId++;

                    Match storage newMatch = matches[matchId];
                    newMatch.matchId = matchId;
                    newMatch.seasonId = seasonId;
                    newMatch.homeTeam = i;
                    newMatch.awayTeam = j;
                    newMatch.kickoffTime = currentTime;

                    seasonMatches[seasonId].push(matchId);
                    season.totalMatches++;

                    emit MatchCreated(matchId, seasonId, i, j, currentTime);

                    currentTime += MATCH_INTERVAL;
                }
            }
        }

        matchCounter = matchId;
    }

    /**
     * @notice Calculate season winner based on points
     */
    function _calculateSeasonWinner(uint32 seasonId) internal returns (uint8) {
        int16 maxPoints = -1;
        uint8 winner = 0;

        for (uint8 i = 0; i < 10; i++) {
            TeamStats storage stats = seasonTeamStats[seasonId][i];
            if (stats.points > maxPoints) {
                maxPoints = stats.points;
                winner = i;
            }
        }

        // Update positions
        _updateLeaguePositions(seasonId);

        return winner;
    }

    /**
     * @notice Update league table positions
     */
    function _updateLeaguePositions(uint32 seasonId) internal {
        // Simple bubble sort for 10 teams
        for (uint8 i = 0; i < 10; i++) {
            for (uint8 j = i + 1; j < 10; j++) {
                TeamStats storage team1 = seasonTeamStats[seasonId][i];
                TeamStats storage team2 = seasonTeamStats[seasonId][j];

                if (team2.points > team1.points) {
                    uint8 tempPos = team1.position;
                    team1.position = team2.position;
                    team2.position = tempPos;
                }
            }
        }
    }

    // ============ Voting System ============

    /**
     * @notice Vote for season winner (free)
     * @param seasonId The season to vote for
     * @param teamId Predicted winner (0-9)
     */
    function voteForSeasonWinner(uint32 seasonId, uint8 teamId) external {
        Season storage season = seasons[seasonId];
        if (season.seasonId == 0) revert SeasonNotFound();
        if (season.status != SeasonStatus.UPCOMING) revert VotingClosed();
        if (seasonVotes[seasonId][msg.sender].voter != address(0)) revert AlreadyVoted();
        if (teamId >= 10) revert InvalidTeamId();

        bool isEarlyVoter = block.timestamp < season.startTime - 1 days;

        seasonVotes[seasonId][msg.sender] = Vote({
            voter: msg.sender,
            predictedWinner: teamId,
            votedAt: uint64(block.timestamp),
            claimed: false,
            isEarlyVoter: isEarlyVoter
        });

        seasonVoters[seasonId].push(msg.sender);
        teamVoteCounts[seasonId][teamId]++;
        season.totalVotes++;

        emit VoteCast(msg.sender, seasonId, teamId, isEarlyVoter);
    }

    /**
     * @notice Claim voting rewards after season ends
     * @param seasonId The season to claim from
     */
    function claimVotingReward(uint32 seasonId) external nonReentrant {
        Season storage season = seasons[seasonId];
        if (season.status != SeasonStatus.COMPLETED) revert SeasonNotCompleted();

        Vote storage vote = seasonVotes[seasonId][msg.sender];
        require(vote.voter == msg.sender, "Not voted");
        require(!vote.claimed, "Already claimed");

        // Check if prediction was correct
        uint8 winner = season.communityPredictedWinner;
        if (vote.predictedWinner != winner) {
            vote.claimed = true;
            return; // No reward for wrong prediction
        }

        // Calculate reward
        uint128 rewardPool = (season.totalBettingVolume * uint128(VOTING_REWARD_PERCENTAGE)) / 100;
        uint32 correctVotes = teamVoteCounts[seasonId][winner];

        uint128 baseReward = rewardPool * 80 / 100 / correctVotes; // 80% split among correct voters
        uint128 bonus = vote.isEarlyVoter ? (baseReward * uint128(EARLY_VOTER_BONUS)) / 100 : 0;
        uint128 totalReward = baseReward + bonus;

        vote.claimed = true;

        // Transfer reward
        (bool success, ) = payable(msg.sender).call{value: totalReward}("");
        require(success, "Transfer failed");

        emit VotingRewardClaimed(msg.sender, seasonId, totalReward);
    }

    // ============ Match Simulation ============

    /**
     * @notice Simulate and finalize a match
     * @dev Uses block hash for pseudo-randomness
     * @param matchId The match to simulate
     */
    function simulateMatch(uint64 matchId) external {
        Match storage matchData = matches[matchId];
        if (matchData.matchId == 0) revert MatchNotFound();
        require(block.timestamp >= matchData.kickoffTime, "Match not started");
        if (matchData.isFinalized) revert MatchAlreadyFinalized();

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

        emit MatchFinalized(matchId, homeScore, awayScore);
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

    // Contract size limit - will continue in next message

    receive() external payable {}
}
