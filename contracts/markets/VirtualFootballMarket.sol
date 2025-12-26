// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../OracleCore.sol";
import "../FeeManagerV2.sol";
import "../interfaces/IVirtualFootballGame.sol";

/**
 * @title VirtualFootballMarket
 * @notice Prediction market for Virtual Football - queries oracle for results
 * @dev Separated from game logic - this is the betting/market side
 */
contract VirtualFootballMarket is ReentrancyGuard {
    // ============ Enums ============

    enum BetType { MATCH_WINNER, OVER_UNDER, BOTH_TEAMS_SCORE }

    // ============ Structs ============

    struct SingleBet {
        uint256 betId;
        address bettor;
        uint64 gameMatchId; // Internal game match ID
        bytes32 oracleMatchId; // Oracle match ID (filled when match finalizes)
        BetType betType;
        uint8 selection;
        uint128 amount;
        uint16 odds; // Multiplied by 100
        bool isSettled;
        bool isWon;
        bool isClaimed;
    }

    struct Vote {
        address voter;
        uint8 predictedWinner;
        uint64 votedAt;
        bool claimed;
        bool isEarlyVoter;
    }

    struct Tipster {
        address tipsterAddress;
        string name;
        uint32 totalBets;
        uint32 winningBets;
        int128 totalProfit;
        uint32 followersCount;
        uint16 winRate;
    }

    // ============ State Variables ============

    IVirtualFootballGame public game;
    OracleCore public oracleCore;
    FeeManagerV2 public feeManager;

    // Betting
    uint256 public betCounter;
    mapping(uint256 => SingleBet) public bets;
    mapping(address => uint256[]) public userBets;
    mapping(uint64 => mapping(BetType => mapping(uint8 => uint128))) public matchPools;
    mapping(uint64 => uint128) public matchTotalPools;

    // Voting
    mapping(uint32 => mapping(address => Vote)) public seasonVotes;
    mapping(uint32 => mapping(uint8 => uint32)) public teamVoteCounts;
    mapping(uint32 => address[]) public seasonVoters;
    mapping(uint32 => uint128) public seasonBettingVolume;

    // Tipster system
    mapping(address => Tipster) public tipsters;
    mapping(address => address) public userFollowing; // user => tipster they're following
    mapping(uint256 => address) public betToTipster;
    mapping(uint256 => uint256) public copiedBetToOriginal;

    // Constants
    uint256 public constant VOTING_REWARD_PERCENTAGE = 1; // 1% of betting volume
    uint256 public constant EARLY_VOTER_BONUS = 20; // 20% bonus
    uint256 public constant TIPSTER_COMMISSION = 2; // 2% of copier winnings
    uint256 public constant PLATFORM_FEE = 5; // 5% of betting pool

    // ============ Events ============

    event VoteCast(address indexed voter, uint32 indexed seasonId, uint8 teamId, bool isEarlyVoter);
    event VotingRewardClaimed(address indexed voter, uint32 indexed seasonId, uint128 amount);
    event BetPlaced(uint256 indexed betId, address indexed bettor, uint64 indexed matchId, BetType betType, uint128 amount);
    event BetSettled(uint256 indexed betId, bool isWon, uint128 payout);
    event BetClaimed(uint256 indexed betId, address indexed bettor, uint128 amount);
    event TipsterRegistered(address indexed tipster, string name);
    event TipsterFollowed(address indexed follower, address indexed tipster);
    event BetCopied(address indexed copier, address indexed tipster, uint256 copyBetId, uint256 originalBetId);
    event TipsterCommissionPaid(address indexed tipster, uint256 indexed betId, uint128 amount);

    // ============ Errors ============

    error SeasonNotCompleted();
    error AlreadyVoted();
    error VotingClosed();
    error InvalidTeamId();
    error MatchNotFound();
    error BettingClosed();
    error InvalidBetAmount();
    error BetNotFound();
    error BetAlreadySettled();
    error BetAlreadyClaimed();
    error NotBetOwner();
    error TipsterNotFound();
    error NotFollowing();

    // ============ Constructor ============

    constructor(
        address _game,
        address _oracleCore,
        address payable _feeManager
    ) {
        game = IVirtualFootballGame(_game);
        oracleCore = OracleCore(_oracleCore);
        feeManager = FeeManagerV2(_feeManager);
    }

    // ============ Voting Functions ============

    /**
     * @notice Vote for season winner (FREE)
     */
    function voteForSeasonWinner(uint32 seasonId, uint8 teamId) external {
        IVirtualFootballGame.Season memory season = game.getSeason(seasonId);
        require(season.status == IVirtualFootballGame.SeasonStatus.UPCOMING, "Voting closed");
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

        emit VoteCast(msg.sender, seasonId, teamId, isEarlyVoter);
    }

    /**
     * @notice Claim voting rewards after season ends
     */
    function claimVotingReward(uint32 seasonId) external nonReentrant {
        IVirtualFootballGame.Season memory season = game.getSeason(seasonId);
        if (season.status != IVirtualFootballGame.SeasonStatus.COMPLETED) revert SeasonNotCompleted();

        Vote storage vote = seasonVotes[seasonId][msg.sender];
        require(vote.voter == msg.sender, "Not voted");
        require(!vote.claimed, "Already claimed");

        // Get season winner from game contract
        uint8 winner = _getSeasonWinner(seasonId);

        // Check if prediction was correct
        if (vote.predictedWinner != winner) {
            vote.claimed = true;
            return; // No reward for wrong prediction
        }

        // Calculate reward
        uint128 rewardPool = (seasonBettingVolume[seasonId] * uint128(VOTING_REWARD_PERCENTAGE)) / 100;
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

    // ============ Betting Functions ============

    /**
     * @notice Place a bet on a match
     */
    function placeBet(
        uint64 gameMatchId,
        BetType betType,
        uint8 selection,
        uint128 amount
    ) external payable nonReentrant returns (uint256) {
        require(msg.value == amount, "Incorrect amount");
        return _createBet(msg.sender, gameMatchId, betType, selection, amount, false);
    }

    /**
     * @notice Place bet as tipster
     */
    function placeBetAsTipster(
        uint64 gameMatchId,
        BetType betType,
        uint8 selection,
        uint128 amount
    ) external payable nonReentrant returns (uint256) {
        Tipster storage tipster = tipsters[msg.sender];
        require(tipster.tipsterAddress == msg.sender, "Not registered as tipster");
        require(msg.value == amount, "Incorrect amount");

        uint256 betId = _createBet(msg.sender, gameMatchId, betType, selection, amount, true);
        betToTipster[betId] = msg.sender;

        return betId;
    }

    /**
     * @notice Copy a tipster's bet
     */
    function copyBet(uint256 tipsterBetId, uint128 amount) external payable nonReentrant returns (uint256) {
        require(msg.value == amount, "Incorrect amount");

        SingleBet storage originalBet = bets[tipsterBetId];
        if (originalBet.betId == 0) revert BetNotFound();

        address tipsterAddr = betToTipster[tipsterBetId];
        if (tipsterAddr == address(0)) revert TipsterNotFound();
        if (userFollowing[msg.sender] != tipsterAddr) revert NotFollowing();

        uint256 copyBetId = _createBet(
            msg.sender,
            originalBet.gameMatchId,
            originalBet.betType,
            originalBet.selection,
            amount,
            false
        );

        copiedBetToOriginal[copyBetId] = tipsterBetId;

        emit BetCopied(msg.sender, tipsterAddr, copyBetId, tipsterBetId);

        return copyBetId;
    }

    /**
     * @notice Internal function to create a bet
     */
    function _createBet(
        address bettor,
        uint64 gameMatchId,
        BetType betType,
        uint8 selection,
        uint128 amount,
        bool isTipsterBet
    ) internal returns (uint256) {
        // Get match from game contract
        IVirtualFootballGame.Match memory matchData = game.getMatch(gameMatchId);
        if (matchData.matchId == 0) revert MatchNotFound();
        require(block.timestamp < matchData.kickoffTime, "Betting closed");
        if (amount == 0) revert InvalidBetAmount();

        // Validate selection
        if (betType == BetType.MATCH_WINNER) {
            require(selection <= 2, "Invalid selection");
        } else {
            require(selection <= 1, "Invalid selection");
        }

        betCounter++;
        uint256 betId = betCounter;

        // Calculate odds
        uint16 odds = _calculateOdds(gameMatchId, betType, selection, amount);

        bets[betId] = SingleBet({
            betId: betId,
            bettor: bettor,
            gameMatchId: gameMatchId,
            oracleMatchId: bytes32(0), // Will be filled when match finalizes
            betType: betType,
            selection: selection,
            amount: amount,
            odds: odds,
            isSettled: false,
            isWon: false,
            isClaimed: false
        });

        userBets[bettor].push(betId);
        matchPools[gameMatchId][betType][selection] += amount;
        matchTotalPools[gameMatchId] += amount;

        // Track betting volume for season
        seasonBettingVolume[matchData.seasonId] += amount;

        emit BetPlaced(betId, bettor, gameMatchId, betType, amount);

        return betId;
    }

    /**
     * @notice Settle a bet by querying oracle
     */
    function settleBet(uint256 betId) external {
        SingleBet storage bet = bets[betId];
        if (bet.betId == 0) revert BetNotFound();
        if (bet.isSettled) revert BetAlreadySettled();

        // Get match from game to find oracle match ID
        IVirtualFootballGame.Match memory matchData = game.getMatch(bet.gameMatchId);
        require(matchData.isFinalized, "Match not finalized");

        bytes32 oracleMatchId = matchData.oracleMatchId;
        bet.oracleMatchId = oracleMatchId;

        // Query oracle for result (this may charge a fee via FeeManager)
        bytes32 winnerBytes = oracleCore.getResultField(oracleMatchId, keccak256("winner"));
        bytes32 homeScoreBytes = oracleCore.getResultField(oracleMatchId, keccak256("homeScore"));
        bytes32 awayScoreBytes = oracleCore.getResultField(oracleMatchId, keccak256("awayScore"));

        uint8 homeScore = uint8(uint256(homeScoreBytes));
        uint8 awayScore = uint8(uint256(awayScoreBytes));

        // Determine if bet won
        bool isWon = _checkBetResult(bet, homeScore, awayScore);
        bet.isWon = isWon;
        bet.isSettled = true;

        // Update tipster stats if applicable
        address tipsterAddr = betToTipster[betId];
        if (tipsterAddr != address(0)) {
            Tipster storage tipster = tipsters[tipsterAddr];
            tipster.totalBets++;
            if (isWon) {
                tipster.winningBets++;
                int128 profit = int128(uint128((bet.amount * bet.odds) / 100)) - int128(bet.amount);
                tipster.totalProfit += profit;
            } else {
                tipster.totalProfit -= int128(bet.amount);
            }
            tipster.winRate = tipster.totalBets > 0
                ? uint16((tipster.winningBets * 10000) / tipster.totalBets)
                : 0;
        }

        uint128 payout = isWon ? (bet.amount * bet.odds) / 100 : 0;

        emit BetSettled(betId, isWon, payout);
    }

    /**
     * @notice Claim winnings from a settled bet
     */
    function claimBet(uint256 betId) external nonReentrant {
        SingleBet storage bet = bets[betId];
        if (bet.betId == 0) revert BetNotFound();
        if (bet.bettor != msg.sender) revert NotBetOwner();
        require(bet.isSettled, "Bet not settled");
        if (bet.isClaimed) revert BetAlreadyClaimed();
        require(bet.isWon, "Bet lost");

        bet.isClaimed = true;

        uint128 payout = (bet.amount * bet.odds) / 100;
        uint128 platformFee = (payout * uint128(PLATFORM_FEE)) / 100;
        uint128 netPayout = payout - platformFee;

        // Pay tipster commission if this is a copied bet
        uint256 originalBetId = copiedBetToOriginal[betId];
        if (originalBetId != 0) {
            address tipsterAddr = betToTipster[originalBetId];
            if (tipsterAddr != address(0)) {
                uint128 winAmount = payout - bet.amount;
                uint128 commission = (winAmount * uint128(TIPSTER_COMMISSION)) / 100;
                netPayout -= commission;

                (bool tipsterSuccess, ) = payable(tipsterAddr).call{value: commission}("");
                require(tipsterSuccess, "Tipster payment failed");

                emit TipsterCommissionPaid(tipsterAddr, betId, commission);
            }
        }

        // Transfer winnings
        (bool transferSuccess, ) = payable(msg.sender).call{value: netPayout}("");
        require(transferSuccess, "Transfer failed");

        emit BetClaimed(betId, msg.sender, netPayout);
    }

    // ============ Tipster Functions ============

    function registerAsTipster(string calldata name) external {
        require(tipsters[msg.sender].tipsterAddress == address(0), "Already registered");

        tipsters[msg.sender] = Tipster({
            tipsterAddress: msg.sender,
            name: name,
            totalBets: 0,
            winningBets: 0,
            totalProfit: 0,
            followersCount: 0,
            winRate: 0
        });

        emit TipsterRegistered(msg.sender, name);
    }

    function followTipster(address tipsterAddr) external {
        if (tipsters[tipsterAddr].tipsterAddress == address(0)) revert TipsterNotFound();

        address previousTipster = userFollowing[msg.sender];
        if (previousTipster != address(0)) {
            tipsters[previousTipster].followersCount--;
        }

        userFollowing[msg.sender] = tipsterAddr;
        tipsters[tipsterAddr].followersCount++;

        emit TipsterFollowed(msg.sender, tipsterAddr);
    }

    // ============ Internal Helper Functions ============

    function _checkBetResult(
        SingleBet storage bet,
        uint8 homeScore,
        uint8 awayScore
    ) internal view returns (bool) {
        if (bet.betType == BetType.MATCH_WINNER) {
            if (bet.selection == 0) return homeScore > awayScore; // Home win
            if (bet.selection == 1) return homeScore == awayScore; // Draw
            if (bet.selection == 2) return awayScore > homeScore; // Away win
        } else if (bet.betType == BetType.OVER_UNDER) {
            uint8 totalGoals = homeScore + awayScore;
            if (bet.selection == 0) return totalGoals < 3; // Under 2.5
            if (bet.selection == 1) return totalGoals > 2; // Over 2.5
        } else if (bet.betType == BetType.BOTH_TEAMS_SCORE) {
            bool bothScored = homeScore > 0 && awayScore > 0;
            if (bet.selection == 0) return !bothScored; // No
            if (bet.selection == 1) return bothScored; // Yes
        }
        return false;
    }

    function _calculateOdds(
        uint64 gameMatchId,
        BetType betType,
        uint8 selection,
        uint128 newAmount
    ) internal view returns (uint16) {
        uint128 currentPool = matchPools[gameMatchId][betType][selection];
        uint128 totalPool = matchTotalPools[gameMatchId];

        if (totalPool == 0) {
            // Default odds
            if (betType == BetType.MATCH_WINNER) {
                if (selection == 1) return 300; // Draw 3.0
                return 200; // Win 2.0
            }
            return 180; // 1.8 default
        }

        uint256 poolAfter = currentPool + newAmount;
        uint256 totalAfter = totalPool + newAmount;

        if (poolAfter == 0) return 100;

        uint256 odds = (totalAfter * 100) / poolAfter;
        odds = (odds * 95) / 100; // 5% house edge

        if (odds < 110) odds = 110;
        if (odds > 1000) odds = 1000;

        return uint16(odds);
    }

    function _getSeasonWinner(uint32 seasonId) internal view returns (uint8) {
        int16 maxPoints = -1;
        uint8 winner = 0;

        for (uint8 i = 0; i < 10; i++) {
            IVirtualFootballGame.TeamStats memory stats = game.getTeamStats(seasonId, i);
            if (stats.points > maxPoints) {
                maxPoints = stats.points;
                winner = i;
            }
        }

        return winner;
    }

    // ============ View Functions ============

    function getUserBets(address user) external view returns (uint256[] memory) {
        return userBets[user];
    }

    function getBet(uint256 betId) external view returns (SingleBet memory) {
        return bets[betId];
    }

    function getTipster(address tipsterAddr) external view returns (Tipster memory) {
        return tipsters[tipsterAddr];
    }

    function getCommunityPrediction(uint32 seasonId) external view returns (
        uint8 mostVotedTeam,
        uint32 voteCount,
        uint32 totalVotes
    ) {
        uint32 maxVotes = 0;
        uint8 topTeam = 0;
        uint32 total = 0;

        for (uint8 i = 0; i < 10; i++) {
            uint32 votes = teamVoteCounts[seasonId][i];
            total += votes;
            if (votes > maxVotes) {
                maxVotes = votes;
                topTeam = i;
            }
        }

        return (topTeam, maxVotes, total);
    }

    /**
     * @notice Fund this contract's prepaid oracle balance
     */
    function fundOracleBalance() external payable {
        feeManager.depositBalance{value: msg.value}(address(0));
    }

    receive() external payable {}
}
