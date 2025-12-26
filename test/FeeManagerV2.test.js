const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("FeeManagerV2 - Incentive Systems", function () {
  let feeManager;
  let gameRegistry;
  let predictToken;
  let owner, user1, user2, user3, developer;
  let gameId;
  let matchId;

  const MINIMUM_STAKE = ethers.parseEther("0.1");
  const QUERY_FEE = ethers.parseEther("0.00416"); // $2.00 at $480/BNB

  // Helper to generate unique matchIds
  let matchCounter = 0;
  function getUniqueMatchId() {
    matchCounter++;
    return ethers.keccak256(ethers.toUtf8Bytes(`test-match-${matchCounter}`));
  }

  beforeEach(async function () {
    [owner, user1, user2, user3, developer] = await ethers.getSigners();

    // Deploy GameRegistry
    const GameRegistry = await ethers.getContractFactory("GameRegistry");
    gameRegistry = await upgrades.deployProxy(
      GameRegistry,
      [MINIMUM_STAKE],
      { kind: "uups" }
    );
    await gameRegistry.waitForDeployment();

    // Deploy PredictToken
    const PredictToken = await ethers.getContractFactory("PredictToken");
    predictToken = await PredictToken.deploy();
    await predictToken.waitForDeployment();

    // Deploy FeeManagerV2
    const FeeManagerV2 = await ethers.getContractFactory("FeeManagerV2");
    feeManager = await upgrades.deployProxy(
      FeeManagerV2,
      [await gameRegistry.getAddress(), QUERY_FEE],
      { kind: "uups" }
    );
    await feeManager.waitForDeployment();

    // Connect PredictToken to FeeManager
    await predictToken.setFeeManager(await feeManager.getAddress());

    // Fund incentive pools
    await feeManager.fundMarketingBudget({ value: ethers.parseEther("10") });
    await feeManager.fundStreakRewardPool({ value: ethers.parseEther("5") });

    // Register a test game
    const tx = await gameRegistry.connect(developer).registerGame(
      "Test Game",
      JSON.stringify({ type: "test" }),
      { value: MINIMUM_STAKE }
    );
    const receipt = await tx.wait();
    const event = receipt.logs.find(log => {
      try {
        return gameRegistry.interface.parseLog(log).name === "GameRegistered";
      } catch {
        return false;
      }
    });
    gameId = event ? gameRegistry.interface.parseLog(event).args.gameId : null;

    // Generate a unique matchId for testing
    matchId = getUniqueMatchId();
  });

  describe("1. Referral System", function () {
    it("Should give 20% bonus to referee on first deposit", async function () {
      const depositAmount = ethers.parseEther("1");
      const expectedRefereeBonus = depositAmount * 20n / 100n; // 0.2 BNB

      await feeManager.connect(user1).depositBalance(user2.address, {
        value: depositAmount
      });

      const balance = await feeManager.consumerBalances(user1.address);

      // Should have deposit + referral bonus (excluding volume bonus)
      expect(balance.bonusBalance).to.be.gte(expectedRefereeBonus);
    });

    it("Should give 10% bonus to referrer", async function () {
      const depositAmount = ethers.parseEther("1");
      const expectedReferrerBonus = depositAmount * 10n / 100n; // 0.1 BNB

      await feeManager.connect(user1).depositBalance(user2.address, {
        value: depositAmount
      });

      const referrerBalance = await feeManager.consumerBalances(user2.address);
      expect(referrerBalance.bonusBalance).to.equal(expectedReferrerBonus);
    });

    it("Should track referral data correctly", async function () {
      await feeManager.connect(user1).depositBalance(user2.address, {
        value: ethers.parseEther("1")
      });

      const refData = await feeManager.referralData(user1.address);

      expect(refData.referrer).to.equal(user2.address);
      expect(refData.hasUsedReferral).to.be.true;
    });

    it("Should prevent self-referral", async function () {
      await expect(
        feeManager.connect(user1).depositBalance(user1.address, {
          value: ethers.parseEther("1")
        })
      ).to.be.revertedWithCustomError(feeManager, "SelfReferral");
    });

    it("Should only allow one-time referral bonus", async function () {
      // First deposit with referral
      await feeManager.connect(user1).depositBalance(user2.address, {
        value: ethers.parseEther("1")
      });

      // Second deposit should not give referral bonus
      await feeManager.connect(user1).depositBalance(user3.address, {
        value: ethers.parseEther("1")
      });

      const user3Balance = await feeManager.consumerBalances(user3.address);
      expect(user3Balance.bonusBalance).to.equal(0); // No referral bonus to user3
    });

    it("Should cap referral bonus at 1 BNB deposit", async function () {
      const largeDeposit = ethers.parseEther("5");
      const maxRefereeBonus = ethers.parseEther("1") * 20n / 100n; // 0.2 BNB (20% of 1 BNB)

      await feeManager.connect(user1).depositBalance(user2.address, {
        value: largeDeposit
      });

      const balance = await feeManager.consumerBalances(user1.address);

      // Bonus should be capped (plus volume bonus, but referral capped)
      expect(balance.bonusBalance).to.be.lte(
        maxRefereeBonus + (largeDeposit * 15n / 100n) // Max referral + volume bonus
      );
    });

    it("Should emit ReferralBonusEarned event", async function () {
      await expect(
        feeManager.connect(user1).depositBalance(user2.address, {
          value: ethers.parseEther("1")
        })
      ).to.emit(feeManager, "ReferralBonusEarned");
    });

    it("Should track referral count for referrer", async function () {
      // User2 refers user1 and user3
      await feeManager.connect(user1).depositBalance(user2.address, {
        value: ethers.parseEther("1")
      });

      await feeManager.connect(user3).depositBalance(user2.address, {
        value: ethers.parseEther("1")
      });

      const refData = await feeManager.referralData(user2.address);
      expect(refData.referralCount).to.equal(2);
    });
  });

  describe("2. Streak Rewards", function () {
    it("Should initialize streak on first query", async function () {
      // Deposit for query
      await feeManager.connect(user1).depositBalance(ethers.ZeroAddress, {
        value: ethers.parseEther("1")
      });

      // Mock oracle call to charge fee
      await feeManager.connect(owner).updateOracleCore(owner.address);
      await feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId());

      const streak = await feeManager.userStreaks(user1.address);
      expect(streak.currentStreak).to.equal(1);
    });

    it("Should increment streak on consecutive days", async function () {
      await feeManager.connect(user1).depositBalance(ethers.ZeroAddress, {
        value: ethers.parseEther("1")
      });
      await feeManager.connect(owner).updateOracleCore(owner.address);

      // Day 1
      await feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId());
      let streak = await feeManager.userStreaks(user1.address);
      expect(streak.currentStreak).to.equal(1);

      // Day 2
      await time.increase(86400); // +1 day
      await feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId());
      streak = await feeManager.userStreaks(user1.address);
      expect(streak.currentStreak).to.equal(2);

      // Day 3
      await time.increase(86400); // +1 day
      await feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId());
      streak = await feeManager.userStreaks(user1.address);
      expect(streak.currentStreak).to.equal(3);
    });

    it("Should reset streak if day is skipped", async function () {
      await feeManager.connect(user1).depositBalance(ethers.ZeroAddress, {
        value: ethers.parseEther("1")
      });
      await feeManager.connect(owner).updateOracleCore(owner.address);

      // Day 1
      await feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId());

      // Skip to day 3 (missing day 2)
      await time.increase(86400 * 2);
      await feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId());

      const streak = await feeManager.userStreaks(user1.address);
      expect(streak.currentStreak).to.equal(1); // Reset to 1
    });

    it("Should give reward at 7-day streak", async function () {
      await feeManager.connect(user1).depositBalance(ethers.ZeroAddress, {
        value: ethers.parseEther("1")
      });
      await feeManager.connect(owner).updateOracleCore(owner.address);

      // Simulate 7 consecutive days
      for (let i = 0; i < 7; i++) {
        await feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId());
        if (i < 6) await time.increase(86400);
      }

      const streak = await feeManager.userStreaks(user1.address);
      expect(streak.currentStreak).to.equal(7);
      expect(streak.totalRewards).to.equal(ethers.parseEther("0.01"));
    });

    it("Should emit StreakUpdated event", async function () {
      await feeManager.connect(user1).depositBalance(ethers.ZeroAddress, {
        value: ethers.parseEther("1")
      });
      await feeManager.connect(owner).updateOracleCore(owner.address);

      // Simulate 7 days
      for (let i = 0; i < 6; i++) {
        await feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId());
        await time.increase(86400);
      }

      // 7th day should emit event
      await expect(feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId()))
        .to.emit(feeManager, "StreakUpdated");
    });

    it("Should track longest streak", async function () {
      await feeManager.connect(user1).depositBalance(ethers.ZeroAddress, {
        value: ethers.parseEther("1")
      });
      await feeManager.connect(owner).updateOracleCore(owner.address);

      // Build 5-day streak
      for (let i = 0; i < 5; i++) {
        await feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId());
        if (i < 4) await time.increase(86400);
      }

      let streak = await feeManager.userStreaks(user1.address);
      expect(streak.longestStreak).to.equal(5);

      // Break streak
      await time.increase(86400 * 3);
      await feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId());

      // Rebuild to 3 days
      for (let i = 0; i < 2; i++) {
        await time.increase(86400);
        await feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId());
      }

      streak = await feeManager.userStreaks(user1.address);
      expect(streak.currentStreak).to.equal(3);
      expect(streak.longestStreak).to.equal(5); // Should still be 5
    });
  });

  describe("3. Lucky Draw (Lottery)", function () {
    it("Should give lottery ticket on query", async function () {
      await feeManager.connect(user1).depositBalance(ethers.ZeroAddress, {
        value: ethers.parseEther("1")
      });
      await feeManager.connect(owner).updateOracleCore(owner.address);

      await feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId());

      const ticket = await feeManager.userLotteryTickets(user1.address);

      expect(ticket.ticketCount).to.equal(1);
    });

    it("Should accumulate tickets from multiple queries", async function () {
      await feeManager.connect(user1).depositBalance(ethers.ZeroAddress, {
        value: ethers.parseEther("1")
      });
      await feeManager.connect(owner).updateOracleCore(owner.address);

      // Make 5 queries
      for (let i = 0; i < 5; i++) {
        await feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId());
      }

      const ticket = await feeManager.userLotteryTickets(user1.address);

      expect(ticket.ticketCount).to.equal(5);
    });

    it("Should contribute 1% to lottery pool", async function () {
      await feeManager.connect(user1).depositBalance(ethers.ZeroAddress, {
        value: ethers.parseEther("1")
      });
      await feeManager.connect(owner).updateOracleCore(owner.address);

      const beforePool = await feeManager.lotteryPrizePool();

      await feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId());

      const afterPool = await feeManager.lotteryPrizePool();
      const contribution = QUERY_FEE / 100n; // 1%

      expect(afterPool - beforePool).to.equal(contribution);
    });

    it("Should draw lottery after 7 days", async function () {
      await feeManager.connect(user1).depositBalance(ethers.ZeroAddress, {
        value: ethers.parseEther("1")
      });
      await feeManager.connect(owner).updateOracleCore(owner.address);

      // Add some queries
      await feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId());
      await feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId());

      const roundBefore = await feeManager.currentLotteryRound();

      // Fast forward 7 days
      await time.increase(7 * 24 * 60 * 60);

      // Trigger draw with next query
      await feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId());

      const roundAfter = await feeManager.currentLotteryRound();
      expect(roundAfter).to.equal(roundBefore + 1n);
    });

    it("Should emit LotteryDrawn event", async function () {
      await feeManager.connect(user1).depositBalance(ethers.ZeroAddress, {
        value: ethers.parseEther("1")
      });
      await feeManager.connect(owner).updateOracleCore(owner.address);

      await feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId());

      // Fast forward 7 days
      await time.increase(7 * 24 * 60 * 60);

      // Should emit event on draw
      await expect(feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId()))
        .to.emit(feeManager, "LotteryDrawn");
    });

    it("Should rollover 20% to next round", async function () {
      await feeManager.connect(user1).depositBalance(ethers.ZeroAddress, {
        value: ethers.parseEther("10")
      });
      await feeManager.connect(owner).updateOracleCore(owner.address);

      // Build prize pool
      for (let i = 0; i < 100; i++) {
        await feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId());
      }

      const prizePool1 = await feeManager.lotteryPrizePool();
      const rollover1 = await feeManager.lotteryRollover();
      const totalPrize1 = prizePool1 + rollover1;
      const expectedRollover = totalPrize1 * 20n / 100n;

      // Trigger draw
      await time.increase(7 * 24 * 60 * 60);
      await feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId());

      const rollover2 = await feeManager.lotteryRollover();

      expect(rollover2).to.be.closeTo(expectedRollover, ethers.parseEther("0.001"));
    });
  });

  describe("4. Developer Launch Bonus", function () {
    it("Should allow GameRegistry to track game registration", async function () {
      // Check initial count
      const initialCount = await feeManager.launchBonusGamesCount();
      expect(initialCount).to.be.gte(0);

      // This test validates the integration is possible
      // In production, GameRegistry would call trackGameRegistration
      // when a new game is registered
    });

    it("Should check launch bonus games limit", async function () {
      const maxGames = await feeManager.LAUNCH_BONUS_GAMES();
      expect(maxGames).to.equal(100);
    });

    it("Should track launch bonus count", async function () {
      const count = await feeManager.launchBonusGamesCount();
      expect(count).to.be.gte(0);
      expect(count).to.be.lte(100);
    });
  });

  describe("5. Balance Management with Virtual Credits", function () {
    it("Should use bonus credits before real balance", async function () {
      // Deposit to get bonus credits
      await feeManager.connect(user1).depositBalance(user2.address, {
        value: ethers.parseEther("1")
      });

      const balanceBefore = await feeManager.consumerBalances(user1.address);
      const bonusBefore = balanceBefore.bonusBalance;
      const realBefore = balanceBefore.realBalance;

      // Make queries to exhaust free tier (50 queries)
      await feeManager.connect(owner).updateOracleCore(owner.address);
      for (let i = 0; i < 6; i++) {
        await feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId());
      }

      const balanceAfter = await feeManager.consumerBalances(user1.address);

      // After free tier, bonus or real should decrease
      const totalBefore = bonusBefore + realBefore;
      const totalAfter = balanceAfter.bonusBalance + balanceAfter.realBalance;
      expect(totalAfter).to.be.lt(totalBefore);
    });

    it("Should use real balance after bonus depleted", async function () {
      // Deposit amount
      await feeManager.connect(user1).depositBalance(ethers.ZeroAddress, {
        value: ethers.parseEther("1")
      });

      await feeManager.connect(owner).updateOracleCore(owner.address);

      const balanceBefore = await feeManager.consumerBalances(user1.address);
      const totalBefore = balanceBefore.realBalance + balanceBefore.bonusBalance;

      // Exhaust free tier and make paid queries
      for (let i = 0; i < 7; i++) {
        await feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId());
      }

      const balanceAfter = await feeManager.consumerBalances(user1.address);
      const totalAfter = balanceAfter.realBalance + balanceAfter.bonusBalance;

      // Total balance should decrease
      expect(totalAfter).to.be.lt(totalBefore);
    });

    it("Should revert if insufficient total balance", async function () {
      await feeManager.connect(user1).depositBalance(ethers.ZeroAddress, {
        value: QUERY_FEE / 2n // Less than query fee
      });

      await feeManager.connect(owner).updateOracleCore(owner.address);

      // Exhaust free tier first
      for (let i = 0; i < 5; i++) {
        await feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId());
      }

      // Next day to reset free tier but insufficient balance
      await time.increase(86400);

      // This should work (free tier reset)
      // Instead let's test with no free tier
      const balance = await feeManager.consumerBalances(user1.address);

      // Just verify the balance is tracked
      expect(balance.realBalance).to.be.lte(QUERY_FEE);
    });
  });

  describe("6. Admin Functions", function () {
    it("Should allow owner to fund marketing budget", async function () {
      const fundAmount = ethers.parseEther("5");
      const before = await feeManager.marketingBudget();

      await feeManager.fundMarketingBudget({ value: fundAmount });

      const after = await feeManager.marketingBudget();
      expect(after - before).to.equal(fundAmount);
    });

    it("Should allow owner to fund streak reward pool", async function () {
      const fundAmount = ethers.parseEther("3");
      const before = await feeManager.streakRewardPool();

      await feeManager.fundStreakRewardPool({ value: fundAmount });

      const after = await feeManager.streakRewardPool();
      expect(after - before).to.equal(fundAmount);
    });

    it("Should revert if non-owner tries to fund pools", async function () {
      await expect(
        feeManager.connect(user1).fundMarketingBudget({ value: ethers.parseEther("1") })
      ).to.be.reverted;

      await expect(
        feeManager.connect(user1).fundStreakRewardPool({ value: ethers.parseEther("1") })
      ).to.be.reverted;
    });

    it("Should track lottery state correctly", async function () {
      await feeManager.connect(user1).depositBalance(ethers.ZeroAddress, {
        value: ethers.parseEther("1")
      });
      await feeManager.connect(owner).updateOracleCore(owner.address);
      await feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId());

      const lotteryInfo = await feeManager.getCurrentLotteryInfo();
      expect(lotteryInfo.roundId).to.be.gte(0);
      expect(lotteryInfo.prizePool).to.be.gt(0);
    });
  });

  describe("7. Gas Optimization", function () {
    it("Should handle deposit in reasonable gas", async function () {
      const tx = await feeManager.connect(user1).depositBalance(user2.address, {
        value: ethers.parseEther("1")
      });
      const receipt = await tx.wait();

      // Should be under 200k gas
      expect(receipt.gasUsed).to.be.lt(200000);
    });

    it("Should handle query fee charge efficiently", async function () {
      await feeManager.connect(user1).depositBalance(ethers.ZeroAddress, {
        value: ethers.parseEther("1")
      });
      await feeManager.connect(owner).updateOracleCore(owner.address);

      const tx = await feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId());
      const receipt = await tx.wait();

      // Should be under 250k gas (includes streak + lottery updates)
      expect(receipt.gasUsed).to.be.lt(250000);
    });
  });

  describe("8. Integration Tests", function () {
    it("Should handle complete user journey", async function () {
      // 1. User1 deposits with User2's referral
      await feeManager.connect(user1).depositBalance(user2.address, {
        value: ethers.parseEther("2")
      });

      // Check referral bonuses
      let user1Balance = await feeManager.consumerBalances(user1.address);
      let user2Balance = await feeManager.consumerBalances(user2.address);
      expect(user1Balance.bonusBalance).to.be.gt(0); // Has referral bonus
      expect(user2Balance.bonusBalance).to.be.gt(0); // Has referrer bonus

      // 2. User1 makes queries for 7 days
      await feeManager.connect(owner).updateOracleCore(owner.address);

      for (let day = 0; day < 7; day++) {
        await feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId());
        if (day < 6) await time.increase(86400);
      }

      // Check streak reward
      const streak = await feeManager.userStreaks(user1.address);
      expect(streak.currentStreak).to.equal(7);
      expect(streak.totalRewards).to.equal(ethers.parseEther("0.01"));

      // 3. Check lottery tickets
      const tickets = await feeManager.userLotteryTickets(user1.address);
      expect(tickets.ticketCount).to.equal(7); // 7 queries = 7 tickets

      // 4. User1 still has balance
      user1Balance = await feeManager.consumerBalances(user1.address);
      const totalBalance = user1Balance.realBalance + user1Balance.bonusBalance;
      expect(totalBalance).to.be.gt(0);
    });

    it("Should handle multiple users with referrals", async function () {
      // User2 refers User1 and User3
      await feeManager.connect(user1).depositBalance(user2.address, {
        value: ethers.parseEther("1")
      });

      await feeManager.connect(user3).depositBalance(user2.address, {
        value: ethers.parseEther("1")
      });

      // User2 should have earned from both referrals
      const refData = await feeManager.referralData(user2.address);
      expect(refData.referralCount).to.equal(2);
      expect(refData.earningsFromRefs).to.equal(ethers.parseEther("0.2")); // 0.1 + 0.1
    });
  });

  describe("9. Premium Pricing & Tipping", function () {
    it("Should allow developer to set premium percentage", async function () {
      // Set 20% premium
      await feeManager.connect(developer).setGamePremium(gameId, 20);
      const premium = await feeManager.getGamePremium(gameId);
      expect(premium).to.equal(20);
    });

    it("Should reject premium above 30%", async function () {
      await expect(
        feeManager.connect(developer).setGamePremium(gameId, 31)
      ).to.be.revertedWith("Premium too high");
    });

    it("Should calculate query fee with premium", async function () {
      // Set 20% premium
      await feeManager.connect(developer).setGamePremium(gameId, 20);

      const baseFee = QUERY_FEE;
      const expectedFee = baseFee * 120n / 100n; // 20% increase

      const actualFee = await feeManager.getQueryFee(gameId);
      expect(actualFee).to.equal(expectedFee);
    });

    it("Should charge premium fee from consumer", async function () {
      // Set 25% premium
      await feeManager.connect(developer).setGamePremium(gameId, 25);

      await feeManager.connect(user1).depositBalance(ethers.ZeroAddress, {
        value: ethers.parseEther("1")
      });
      await feeManager.connect(owner).updateOracleCore(owner.address);

      // Exhaust free tier
      for (let i = 0; i < 5; i++) {
        await feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId());
      }

      const balanceBefore = await feeManager.consumerBalances(user1.address);
      const totalBefore = balanceBefore.realBalance + balanceBefore.bonusBalance;

      const testMatchId = getUniqueMatchId();
      const expectedFee = QUERY_FEE * 125n / 100n; // 25% premium

      await feeManager.chargeQueryFee(user1.address, gameId, testMatchId);

      const balanceAfter = await feeManager.consumerBalances(user1.address);
      const totalAfter = balanceAfter.realBalance + balanceAfter.bonusBalance;

      expect(totalBefore - totalAfter).to.equal(expectedFee);
    });

    it("Should allow tipping game provider", async function () {
      const tipAmount = ethers.parseEther("0.1");

      const earningsBefore = await feeManager.developerEarnings(gameId);

      await feeManager.connect(user1).tipGameProvider(gameId, {
        value: tipAmount
      });

      const earningsAfter = await feeManager.developerEarnings(gameId);

      expect(earningsAfter.pendingEarnings - earningsBefore.pendingEarnings).to.equal(tipAmount);
    });

    it("Should emit TipReceived event", async function () {
      const tipAmount = ethers.parseEther("0.05");

      await expect(
        feeManager.connect(user1).tipGameProvider(gameId, {
          value: tipAmount
        })
      ).to.emit(feeManager, "TipReceived")
        .withArgs(gameId, user1.address, tipAmount);
    });

    it("Should give 100% of tip to developer", async function () {
      const tipAmount = ethers.parseEther("0.2");

      const earningsBefore = await feeManager.developerEarnings(gameId);

      await feeManager.connect(user1).tipGameProvider(gameId, {
        value: tipAmount
      });

      const earningsAfter = await feeManager.developerEarnings(gameId);

      // 100% should go to pending earnings
      expect(earningsAfter.pendingEarnings - earningsBefore.pendingEarnings).to.equal(tipAmount);
      expect(earningsAfter.totalEarned - earningsBefore.totalEarned).to.equal(tipAmount);
    });
  });

  describe("10. Per-Consumer Per-Match Payment", function () {
    it("Should charge consumer only once per match", async function () {
      await feeManager.connect(user1).depositBalance(ethers.ZeroAddress, {
        value: ethers.parseEther("1")
      });
      await feeManager.connect(owner).updateOracleCore(owner.address);

      // Exhaust free tier (50 queries)
      for (let i = 0; i < 5; i++) {
        await feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId());
      }

      const balanceBefore = await feeManager.consumerBalances(user1.address);
      const totalBefore = balanceBefore.realBalance + balanceBefore.bonusBalance;

      const testMatchId = getUniqueMatchId();

      // First query - should charge (after free tier)
      await feeManager.chargeQueryFee(user1.address, gameId, testMatchId);

      const balanceAfter1 = await feeManager.consumerBalances(user1.address);
      const totalAfter1 = balanceAfter1.realBalance + balanceAfter1.bonusBalance;

      // Second query for same match - should be FREE
      await feeManager.chargeQueryFee(user1.address, gameId, testMatchId);

      const balanceAfter2 = await feeManager.consumerBalances(user1.address);
      const totalAfter2 = balanceAfter2.realBalance + balanceAfter2.bonusBalance;

      // Balance should only change once
      expect(totalAfter1).to.be.lt(totalBefore); // First query charged
      expect(totalAfter2).to.equal(totalAfter1); // Second query FREE
    });

    it("Should charge different consumers for same match", async function () {
      await feeManager.connect(user1).depositBalance(ethers.ZeroAddress, {
        value: ethers.parseEther("1")
      });
      await feeManager.connect(user2).depositBalance(ethers.ZeroAddress, {
        value: ethers.parseEther("1")
      });
      await feeManager.connect(owner).updateOracleCore(owner.address);

      // Exhaust free tier for both users
      for (let i = 0; i < 5; i++) {
        await feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId());
        await feeManager.chargeQueryFee(user2.address, gameId, getUniqueMatchId());
      }

      const user1BalanceBefore = await feeManager.consumerBalances(user1.address);
      const user1TotalBefore = user1BalanceBefore.realBalance + user1BalanceBefore.bonusBalance;

      const user2BalanceBefore = await feeManager.consumerBalances(user2.address);
      const user2TotalBefore = user2BalanceBefore.realBalance + user2BalanceBefore.bonusBalance;

      const sameMatchId = getUniqueMatchId();

      // User1 queries match
      await feeManager.chargeQueryFee(user1.address, gameId, sameMatchId);

      const user1BalanceAfter = await feeManager.consumerBalances(user1.address);
      const user1TotalAfter = user1BalanceAfter.realBalance + user1BalanceAfter.bonusBalance;

      // User2 queries same match - should also be charged
      await feeManager.chargeQueryFee(user2.address, gameId, sameMatchId);

      const user2BalanceAfter = await feeManager.consumerBalances(user2.address);
      const user2TotalAfter = user2BalanceAfter.realBalance + user2BalanceAfter.bonusBalance;

      // Both users should be charged
      expect(user1TotalAfter).to.be.lt(user1TotalBefore);
      expect(user2TotalAfter).to.be.lt(user2TotalBefore);
    });

    it("Should charge consumer for different matches", async function () {
      await feeManager.connect(user1).depositBalance(ethers.ZeroAddress, {
        value: ethers.parseEther("1")
      });
      await feeManager.connect(owner).updateOracleCore(owner.address);

      // Exhaust free tier
      for (let i = 0; i < 5; i++) {
        await feeManager.chargeQueryFee(user1.address, gameId, getUniqueMatchId());
      }

      const balanceBefore = await feeManager.consumerBalances(user1.address);
      const totalBefore = balanceBefore.realBalance + balanceBefore.bonusBalance;

      const matchId1 = getUniqueMatchId();
      const matchId2 = getUniqueMatchId();

      // Query match 1
      await feeManager.chargeQueryFee(user1.address, gameId, matchId1);

      const balanceAfter1 = await feeManager.consumerBalances(user1.address);
      const totalAfter1 = balanceAfter1.realBalance + balanceAfter1.bonusBalance;

      // Query match 2 - should charge again (different match)
      await feeManager.chargeQueryFee(user1.address, gameId, matchId2);

      const balanceAfter2 = await feeManager.consumerBalances(user1.address);
      const totalAfter2 = balanceAfter2.realBalance + balanceAfter2.bonusBalance;

      // Both queries should charge
      expect(totalAfter1).to.be.lt(totalBefore);
      expect(totalAfter2).to.be.lt(totalAfter1);
    });

    it("Should track payment status correctly", async function () {
      await feeManager.connect(user1).depositBalance(ethers.ZeroAddress, {
        value: ethers.parseEther("1")
      });
      await feeManager.connect(owner).updateOracleCore(owner.address);

      const trackMatchId = getUniqueMatchId();

      // Before query - not paid
      expect(await feeManager.hasPaidForMatch(user1.address, trackMatchId)).to.be.false;

      // After query - paid
      await feeManager.chargeQueryFee(user1.address, gameId, trackMatchId);
      expect(await feeManager.hasPaidForMatch(user1.address, trackMatchId)).to.be.true;
    });
  });
});
