// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./VirtualFootball.sol";

/**
 * @title VirtualFootballBetting
 * @notice Extends VirtualFootball with betting functionality
 */
contract VirtualFootballBetting is VirtualFootball {
    constructor(
        address _oracleCore,
        address payable _feeManager,
        address _gameRegistry
    ) VirtualFootball(_oracleCore, _feeManager, _gameRegistry) {}

    // ============ Betting Functions ============

    /**
     * @notice Place a single bet on a match
     * @param matchId The match to bet on
     * @param betType Type of bet (winner, over/under, etc.)
     * @param selection The selection (0=home, 1=draw, 2=away for winner)
     * @param amount Bet amount
     */
    function placeBet(
        uint64 matchId,
        BetType betType,
        uint8 selection,
        uint128 amount
    ) external payable nonReentrant returns (uint256) {
        require(msg.value == amount, "Incorrect amount");
        return _createBet(msg.sender, matchId, betType, selection, amount);
    }

    /**
     * @notice Internal function to create a bet
     */
    function _createBet(
        address bettor,
        uint64 matchId,
        BetType betType,
        uint8 selection,
        uint128 amount
    ) internal returns (uint256) {
        Match storage matchData = matches[matchId];
        if (matchData.matchId == 0) revert MatchNotFound();
        require(block.timestamp < matchData.kickoffTime, "Betting closed");
        if (amount == 0) revert InvalidBetAmount();

        // Validate selection based on bet type
        if (betType == BetType.MATCH_WINNER) {
            require(selection <= 2, "Invalid selection"); // 0=home, 1=draw, 2=away
        } else if (betType == BetType.OVER_UNDER) {
            require(selection <= 1, "Invalid selection"); // 0=under 2.5, 1=over 2.5
        } else if (betType == BetType.BOTH_TEAMS_SCORE) {
            require(selection <= 1, "Invalid selection"); // 0=no, 1=yes
        }

        betCounter++;
        uint256 betId = betCounter;

        // Calculate odds based on pool
        uint16 odds = _calculateOdds(matchId, betType, selection, amount);

        bets[betId] = SingleBet({
            betId: betId,
            bettor: bettor,
            matchId: matchId,
            betType: betType,
            selection: selection,
            amount: amount,
            odds: odds,
            isSettled: false,
            isWon: false,
            isClaimed: false
        });

        userBets[bettor].push(betId);
        matchPools[matchId][betType][selection] += amount;
        matchData.totalPool += amount;

        // Add to season betting volume
        Season storage season = seasons[matchData.seasonId];
        season.totalBettingVolume += amount;

        emit BetPlaced(betId, bettor, matchId, betType, amount);

        return betId;
    }

    /**
     * @notice Place a bet slip (multi-bet or accumulator)
     * @param betIds Array of bet IDs to combine
     * @param slipType SINGLE, MULTI, or SYSTEM
     * @param stake Total stake for the slip
     */
    function placeBetSlip(
        uint256[] calldata betIds,
        BetSlipType slipType,
        uint128 stake
    ) external payable nonReentrant returns (uint256) {
        require(betIds.length > 0, "No bets in slip");
        require(msg.value == stake, "Incorrect stake");
        if (stake == 0) revert InvalidBetAmount();

        if (slipType == BetSlipType.SINGLE) {
            require(betIds.length == 1, "Single bet requires 1 selection");
        } else if (slipType == BetSlipType.MULTI) {
            require(betIds.length >= 2 && betIds.length <= 10, "Multi requires 2-10 selections");
        }

        betSlipCounter++;
        uint256 slipId = betSlipCounter;

        // Calculate combined odds
        uint32 totalOdds = _calculateSlipOdds(betIds, slipType);
        uint128 potentialWinnings = (stake * totalOdds) / 100;

        betSlips[slipId] = BetSlip({
            slipId: slipId,
            bettor: msg.sender,
            betIds: betIds,
            slipType: slipType,
            totalStake: stake,
            potentialWinnings: potentialWinnings,
            totalOdds: totalOdds,
            status: BetSlipStatus.PENDING,
            isClaimed: false
        });

        userBetSlips[msg.sender].push(slipId);

        emit BetSlipPlaced(slipId, msg.sender, slipType, stake, potentialWinnings);

        return slipId;
    }

    /**
     * @notice Place bet as a tipster
     * @param matchId The match to bet on
     * @param betType Type of bet
     * @param selection The selection
     * @param amount Bet amount
     */
    function placeBetAsTipster(
        uint64 matchId,
        BetType betType,
        uint8 selection,
        uint128 amount
    ) external payable nonReentrant returns (uint256) {
        // Ensure tipster is registered
        Tipster storage tipster = tipsters[msg.sender];
        require(tipster.tipsterAddress == msg.sender, "Not registered as tipster");
        require(msg.value == amount, "Incorrect amount");

        // Place normal bet using internal function
        uint256 betId = _createBet(msg.sender, matchId, betType, selection, amount);

        // Mark as tipster bet
        betToTipster[betId] = msg.sender;

        // Note: Followers can manually copy this bet
        // Auto-copy would require pre-deposited funds in contract

        return betId;
    }

    /**
     * @notice Settle a single bet
     * @param betId The bet to settle
     */
    function settleBet(uint256 betId) external {
        SingleBet storage bet = bets[betId];
        if (bet.betId == 0) revert BetNotFound();
        if (bet.isSettled) revert BetAlreadySettled();

        Match storage matchData = matches[bet.matchId];
        require(matchData.isFinalized, "Match not finalized");

        // Determine if bet won
        bool isWon = _checkBetResult(bet, matchData);
        bet.isWon = isWon;
        bet.isSettled = true;

        // Update tipster stats if this was a tipster bet
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
     * @param betId The bet to claim
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

        // If this is a copied bet, pay commission to tipster
        uint256 originalBetId = copiedBetToOriginal[betId];
        if (originalBetId != 0) {
            address tipsterAddr = betToTipster[originalBetId];
            if (tipsterAddr != address(0)) {
                uint128 winAmount = payout - bet.amount;
                uint128 commission = (winAmount * uint128(TIPSTER_COMMISSION)) / 100;
                netPayout -= commission;

                // Pay tipster
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

    /**
     * @notice Check if bet won based on match result
     */
    function _checkBetResult(
        SingleBet storage bet,
        Match storage matchData
    ) internal view returns (bool) {
        if (bet.betType == BetType.MATCH_WINNER) {
            if (bet.selection == 0) return matchData.homeScore > matchData.awayScore;
            if (bet.selection == 1) return matchData.homeScore == matchData.awayScore;
            if (bet.selection == 2) return matchData.awayScore > matchData.homeScore;
        } else if (bet.betType == BetType.OVER_UNDER) {
            uint8 totalGoals = matchData.homeScore + matchData.awayScore;
            if (bet.selection == 0) return totalGoals < 3; // Under 2.5
            if (bet.selection == 1) return totalGoals > 2; // Over 2.5
        } else if (bet.betType == BetType.BOTH_TEAMS_SCORE) {
            bool bothScored = matchData.homeScore > 0 && matchData.awayScore > 0;
            if (bet.selection == 0) return !bothScored;
            if (bet.selection == 1) return bothScored;
        }
        return false;
    }

    /**
     * @notice Calculate odds based on pool distribution
     */
    function _calculateOdds(
        uint64 matchId,
        BetType betType,
        uint8 selection,
        uint128 newAmount
    ) internal view returns (uint16) {
        // Get current pool for this selection
        uint128 currentPool = matchPools[matchId][betType][selection];
        uint128 totalPool = matches[matchId].totalPool;

        // Base odds calculation (parimutuel style)
        if (totalPool == 0) {
            // Default odds based on bet type
            if (betType == BetType.MATCH_WINNER) {
                if (selection == 0 || selection == 2) return 200; // 2.0 for home/away
                return 300; // 3.0 for draw
            }
            return 180; // 1.8 default
        }

        // Calculate implied odds
        uint256 poolAfter = currentPool + newAmount;
        uint256 totalAfter = totalPool + newAmount;

        if (poolAfter == 0) return 100;

        uint256 odds = (totalAfter * 100) / poolAfter;

        // Apply house edge (reduce odds by 5%)
        odds = (odds * 95) / 100;

        // Clamp odds between 1.1x and 10.0x
        if (odds < 110) odds = 110;
        if (odds > 1000) odds = 1000;

        return uint16(odds);
    }

    /**
     * @notice Calculate combined odds for bet slip
     */
    function _calculateSlipOdds(
        uint256[] calldata betIds,
        BetSlipType slipType
    ) internal view returns (uint32) {
        if (slipType == BetSlipType.SINGLE) {
            SingleBet storage bet = bets[betIds[0]];
            return uint32(bet.odds);
        }

        // Multi-bet: multiply all odds
        uint32 combinedOdds = 100;
        for (uint i = 0; i < betIds.length; i++) {
            SingleBet storage bet = bets[betIds[i]];
            combinedOdds = (combinedOdds * bet.odds) / 100;
        }

        return combinedOdds;
    }

    // ============ Tipster Functions ============

    /**
     * @notice Register as a tipster
     * @param name Tipster display name
     */
    function registerAsTipster(string calldata name) external {
        require(tipsters[msg.sender].tipsterAddress == address(0), "Already registered");
        require(bytes(name).length > 0, "Name required");

        tipsters[msg.sender] = Tipster({
            tipsterAddress: msg.sender,
            name: name,
            totalBets: 0,
            winningBets: 0,
            totalProfit: 0,
            followersCount: 0,
            winRate: 0,
            isVerified: false
        });

        emit TipsterRegistered(msg.sender, name);
    }

    /**
     * @notice Follow a tipster
     * @param tipsterAddr Address of tipster to follow
     * @param maxBetAmount Maximum amount to copy per bet
     * @param totalBudget Total budget for copying
     */
    function followTipster(
        address tipsterAddr,
        uint128 maxBetAmount,
        uint128 totalBudget,
        bool autoFollow
    ) external {
        if (tipsters[tipsterAddr].tipsterAddress == address(0)) revert TipsterNotFound();
        if (copySettings[msg.sender].tipster == tipsterAddr) revert AlreadyFollowing();
        if (maxBetAmount == 0 || totalBudget == 0) revert InvalidCopySettings();

        copySettings[msg.sender] = CopySettings({
            tipster: tipsterAddr,
            maxBetAmount: maxBetAmount,
            totalBudget: totalBudget,
            usedBudget: 0,
            autoFollow: autoFollow
        });

        tipsterFollowers[tipsterAddr].push(msg.sender);
        tipsters[tipsterAddr].followersCount++;

        emit TipsterFollowed(msg.sender, tipsterAddr);
    }

    /**
     * @notice Unfollow a tipster
     * @param tipsterAddr Address of tipster to unfollow
     */
    function unfollowTipster(address tipsterAddr) external {
        if (copySettings[msg.sender].tipster != tipsterAddr) revert NotFollowing();

        delete copySettings[msg.sender];

        // Remove from followers array
        address[] storage followers = tipsterFollowers[tipsterAddr];
        for (uint i = 0; i < followers.length; i++) {
            if (followers[i] == msg.sender) {
                followers[i] = followers[followers.length - 1];
                followers.pop();
                break;
            }
        }

        tipsters[tipsterAddr].followersCount--;

        emit TipsterUnfollowed(msg.sender, tipsterAddr);
    }

    /**
     * @notice Manually copy a tipster's bet
     * @param tipsterBetId The bet ID to copy
     */
    function copyBet(uint256 tipsterBetId, uint128 amount) external payable nonReentrant returns (uint256) {
        require(msg.value == amount, "Incorrect amount");

        SingleBet storage originalBet = bets[tipsterBetId];
        if (originalBet.betId == 0) revert BetNotFound();

        address tipsterAddr = betToTipster[tipsterBetId];
        if (tipsterAddr == address(0)) revert TipsterNotFound();

        // Check user is following this tipster
        CopySettings storage settings = copySettings[msg.sender];
        if (settings.tipster != tipsterAddr) revert NotFollowing();
        if (amount > settings.maxBetAmount) revert InvalidBetAmount();

        // Create copy bet
        uint256 copyBetId = _createBet(
            msg.sender,
            originalBet.matchId,
            originalBet.betType,
            originalBet.selection,
            amount
        );

        // Link to original
        copiedBetToOriginal[copyBetId] = tipsterBetId;

        emit BetCopied(msg.sender, tipsterAddr, copyBetId, tipsterBetId);

        return copyBetId;
    }

    // ============ View Functions ============

    /**
     * @notice Get league table for a season
     * @param seasonId The season ID
     * @return Array of team stats sorted by position
     */
    function getLeagueTable(uint32 seasonId) external view returns (TeamStats[] memory) {
        TeamStats[] memory table = new TeamStats[](10);
        for (uint8 i = 0; i < 10; i++) {
            table[i] = seasonTeamStats[seasonId][i];
        }
        return table;
    }

    /**
     * @notice Get user's bets
     * @param user User address
     * @return Array of bet IDs
     */
    function getUserBets(address user) external view returns (uint256[] memory) {
        return userBets[user];
    }

    /**
     * @notice Get match details
     * @param matchId Match ID
     */
    function getMatch(uint64 matchId) external view returns (Match memory) {
        return matches[matchId];
    }

    /**
     * @notice Get tipster details
     */
    function getTipster(address tipsterAddr) external view returns (Tipster memory) {
        return tipsters[tipsterAddr];
    }

    /**
     * @notice Get community prediction for season
     */
    function getCommunityPrediction(uint32 seasonId) external view returns (
        uint8 mostVotedTeam,
        uint32 voteCount,
        uint32 totalVotes
    ) {
        uint32 maxVotes = 0;
        uint8 topTeam = 0;

        for (uint8 i = 0; i < 10; i++) {
            uint32 votes = teamVoteCounts[seasonId][i];
            if (votes > maxVotes) {
                maxVotes = votes;
                topTeam = i;
            }
        }

        return (topTeam, maxVotes, seasons[seasonId].totalVotes);
    }
}
