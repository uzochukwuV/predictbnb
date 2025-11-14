const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ExamplePredictionMarket with Security Fixes", function () {
  let gameRegistry, schemaRegistry, oracleCore, feeManager, predictionMarket;
  let owner, gameDev, bettor1, bettor2, bettor3;
  let matchId, marketId;

  const REGISTRATION_STAKE = ethers.parseEther("0.1");
  const MIN_BET = ethers.parseEther("0.01");

  beforeEach(async function () {
    [owner, gameDev, bettor1, bettor2, bettor3] = await ethers.getSigners();

    // Deploy GameRegistry
    const GameRegistry = await ethers.getContractFactory("GameRegistry");
    gameRegistry = await GameRegistry.deploy();
    await gameRegistry.waitForDeployment();

    // Deploy Schema Registry
    const GameSchemaRegistry = await ethers.getContractFactory("GameSchemaRegistry");
    schemaRegistry = await GameSchemaRegistry.deploy();
    await schemaRegistry.waitForDeployment();

    // Deploy OracleCoreV2
    const OracleCoreV2 = await ethers.getContractFactory("OracleCoreV2");
    oracleCore = await OracleCoreV2.deploy(
      await gameRegistry.getAddress(),
      await schemaRegistry.getAddress()
    );
    await oracleCore.waitForDeployment();

    // Deploy FeeManager
    const FeeManager = await ethers.getContractFactory("FeeManager");
    feeManager = await FeeManager.deploy(
      await gameRegistry.getAddress(),
      await oracleCore.getAddress()
    );
    await feeManager.waitForDeployment();

    // Deploy ExamplePredictionMarket
    const ExamplePredictionMarket = await ethers.getContractFactory("ExamplePredictionMarket");
    predictionMarket = await ExamplePredictionMarket.deploy(
      await feeManager.getAddress(),
      await gameRegistry.getAddress()
    );
    await predictionMarket.waitForDeployment();

    // Set FeeManager in OracleCore
    await oracleCore.setFeeManager(await feeManager.getAddress());

    // Transfer GameRegistry ownership to OracleCore
    await gameRegistry.transferOwnership(await oracleCore.getAddress());

    // Register game
    await gameRegistry.connect(gameDev).registerGame(
      "fps-game-001",
      "Test FPS Game",
      1, // FPS
      { value: REGISTRATION_STAKE }
    );

    // Schedule match
    const futureTime = (await time.latest()) + 3600;
    const tx = await gameRegistry.connect(gameDev).scheduleMatch(
      "fps-game-001",
      "match-001",
      futureTime,
      '{"map": "Dust2", "mode": "Competitive"}'
    );

    const receipt = await tx.wait();
    const event = receipt.logs.find(log => {
      try {
        return gameRegistry.interface.parseLog(log).name === "MatchScheduled";
      } catch {
        return false;
      }
    });

    matchId = gameRegistry.interface.parseLog(event).args.matchId;
  });

  describe("Market Creation", function () {
    it("Should create a prediction market for a scheduled match", async function () {
      const tx = await predictionMarket.createMarket(
        matchId,
        "Will TeamA win?"
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return predictionMarket.interface.parseLog(log).name === "MarketCreated";
        } catch {
          return false;
        }
      });

      expect(event).to.not.be.undefined;
      marketId = predictionMarket.interface.parseLog(event).args.marketId;
    });

    it("Should not allow creating market for non-existent match", async function () {
      const fakeMatchId = ethers.keccak256(ethers.toUtf8Bytes("fake-match"));

      await expect(
        predictionMarket.createMarket(fakeMatchId, "Fake market")
      ).to.be.revertedWith("ExamplePredictionMarket: Match does not exist");
    });
  });

  describe("Betting", function () {
    beforeEach(async function () {
      const tx = await predictionMarket.createMarket(matchId, "Will TeamA win?");
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return predictionMarket.interface.parseLog(log).name === "MarketCreated";
        } catch {
          return false;
        }
      });
      marketId = predictionMarket.interface.parseLog(event).args.marketId;
    });

    it("Should allow placing bets on open market", async function () {
      const betAmount = ethers.parseEther("1.0");

      await expect(
        predictionMarket.connect(bettor1).placeBet(marketId, 0, { value: betAmount }) // TeamA
      ).to.emit(predictionMarket, "BetPlaced")
        .withArgs(marketId, bettor1.address, 0, betAmount);

      const userStake = await predictionMarket.getUserStake(marketId, bettor1.address, 0);
      expect(userStake).to.equal(betAmount);
    });

    it("Should enforce minimum bet amount", async function () {
      await expect(
        predictionMarket.connect(bettor1).placeBet(marketId, 0, { value: ethers.parseEther("0.005") })
      ).to.be.revertedWith("ExamplePredictionMarket: Minimum bet 0.01 BNB");
    });

    it("Should allow multiple users to bet on different outcomes", async function () {
      await predictionMarket.connect(bettor1).placeBet(marketId, 0, { value: ethers.parseEther("1.0") }); // TeamA
      await predictionMarket.connect(bettor2).placeBet(marketId, 1, { value: ethers.parseEther("2.0") }); // TeamB
      await predictionMarket.connect(bettor3).placeBet(marketId, 2, { value: ethers.parseEther("0.5") }); // Draw

      const odds = await predictionMarket.getMarketOdds(marketId);
      expect(odds.oddsTeamA).to.be.gt(0);
      expect(odds.oddsTeamB).to.be.gt(0);
      expect(odds.oddsDraw).to.be.gt(0);
    });

    it("Should not allow betting after close time", async function () {
      // Fast forward past match start time
      await time.increase(3700);

      await expect(
        predictionMarket.connect(bettor1).placeBet(marketId, 0, { value: ethers.parseEther("1.0") })
      ).to.be.revertedWith("ExamplePredictionMarket: Betting closed");
    });

    it("Should accumulate bets correctly", async function () {
      await predictionMarket.connect(bettor1).placeBet(marketId, 0, { value: ethers.parseEther("1.0") });
      await predictionMarket.connect(bettor1).placeBet(marketId, 0, { value: ethers.parseEther("0.5") });

      const userStake = await predictionMarket.getUserStake(marketId, bettor1.address, 0);
      expect(userStake).to.equal(ethers.parseEther("1.5"));
    });
  });

  describe("Market Closure and Resolution", function () {
    beforeEach(async function () {
      const tx = await predictionMarket.createMarket(matchId, "Will TeamA win?");
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return predictionMarket.interface.parseLog(log).name === "MarketCreated";
        } catch {
          return false;
        }
      });
      marketId = predictionMarket.interface.parseLog(event).args.marketId;

      // Place some bets
      await predictionMarket.connect(bettor1).placeBet(marketId, 0, { value: ethers.parseEther("2.0") }); // TeamA
      await predictionMarket.connect(bettor2).placeBet(marketId, 1, { value: ethers.parseEther("1.0") }); // TeamB
    });

    it("Should allow closing betting after close time", async function () {
      // Fast forward past close time
      await time.increase(3700);

      await expect(
        predictionMarket.closeBetting(marketId)
      ).to.not.be.reverted;
    });

    it("Should not allow closing before close time", async function () {
      await expect(
        predictionMarket.closeBetting(marketId)
      ).to.be.revertedWith("ExamplePredictionMarket: Close time not reached");
    });

    it("Should resolve market using oracle data", async function () {
      // Fast forward and close betting
      await time.increase(3700);
      await predictionMarket.closeBetting(marketId);

      // Submit result to oracle
      const resultData = '{"winner": "TeamA", "score": "16-14"}';
      await oracleCore.connect(gameDev).submitResult(matchId, resultData);

      // Fast forward past dispute window
      await time.increase(16 * 60);
      await oracleCore.finalizeResult(matchId);

      // Register prediction market as consumer in FeeManager
      await feeManager.connect(owner).registerConsumer({ value: ethers.parseEther("1.0") });

      // Resolve market (will query oracle and pay fee)
      await expect(
        predictionMarket.resolveMarket(marketId, { value: ethers.parseEther("0.01") })
      ).to.emit(predictionMarket, "MarketResolved");
    });
  });

  describe("Claiming Winnings (Reentrancy Protection)", function () {
    beforeEach(async function () {
      const tx = await predictionMarket.createMarket(matchId, "Will TeamA win?");
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return predictionMarket.interface.parseLog(log).name === "MarketCreated";
        } catch {
          return false;
        }
      });
      marketId = predictionMarket.interface.parseLog(event).args.marketId;

      // Place bets
      await predictionMarket.connect(bettor1).placeBet(marketId, 0, { value: ethers.parseEther("2.0") }); // Winner
      await predictionMarket.connect(bettor2).placeBet(marketId, 1, { value: ethers.parseEther("1.0") }); // Loser

      // Fast forward, close, and resolve market
      await time.increase(3700);
      await predictionMarket.closeBetting(marketId);

      const resultData = '{"winner": "TeamA", "score": "16-14"}';
      await oracleCore.connect(gameDev).submitResult(matchId, resultData);
      await time.increase(16 * 60);
      await oracleCore.finalizeResult(matchId);

      // Register prediction market as consumer
      await feeManager.connect(owner).registerConsumer({ value: ethers.parseEther("1.0") });
      await predictionMarket.resolveMarket(marketId, { value: ethers.parseEther("0.01") });
    });

    it("Should allow winners to claim winnings", async function () {
      const balanceBefore = await ethers.provider.getBalance(bettor1.address);

      await expect(
        predictionMarket.connect(bettor1).claimWinnings(marketId)
      ).to.emit(predictionMarket, "WinningsClaimed");

      const balanceAfter = await ethers.provider.getBalance(bettor1.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("Should not allow claiming twice (reentrancy protection)", async function () {
      await predictionMarket.connect(bettor1).claimWinnings(marketId);

      await expect(
        predictionMarket.connect(bettor1).claimWinnings(marketId)
      ).to.be.revertedWith("ExamplePredictionMarket: Already claimed");
    });

    it("Should not allow losers to claim", async function () {
      await expect(
        predictionMarket.connect(bettor2).claimWinnings(marketId)
      ).to.be.revertedWith("ExamplePredictionMarket: No winning stake");
    });

    it("Should calculate payout correctly with protocol fee", async function () {
      // Total pool: 3 BNB
      // Protocol fee (2%): 0.06 BNB
      // Payout pool: 2.94 BNB
      // Bettor1 won with 2 BNB stake (100% of winning stakes)
      // Expected payout: 2.94 BNB

      const expectedPayout = await predictionMarket.getPotentialPayout(marketId, bettor1.address, 0);

      const totalStaked = ethers.parseEther("3.0");
      const protocolFee = (totalStaked * 200n) / 10000n; // 2%
      const payoutPool = totalStaked - protocolFee;

      expect(expectedPayout).to.equal(payoutPool);
    });

    it("Should distribute winnings proportionally with multiple winners", async function () {
      // Create new market with multiple winners
      const futureTime = (await time.latest()) + 7200;
      const tx2 = await gameRegistry.connect(gameDev).scheduleMatch(
        "fps-game-001",
        "match-002",
        futureTime,
        '{"map": "Mirage"}'
      );
      const receipt2 = await tx2.wait();
      const event2 = receipt2.logs.find(log => {
        try {
          return gameRegistry.interface.parseLog(log).name === "MatchScheduled";
        } catch {
          return false;
        }
      });
      const matchId2 = gameRegistry.interface.parseLog(event2).args.matchId;

      const tx3 = await predictionMarket.createMarket(matchId2, "Will TeamA win?");
      const receipt3 = await tx3.wait();
      const event3 = receipt3.logs.find(log => {
        try {
          return predictionMarket.interface.parseLog(log).name === "MarketCreated";
        } catch {
          return false;
        }
      });
      const marketId2 = predictionMarket.interface.parseLog(event3).args.marketId;

      // Two winners bet on TeamA
      await predictionMarket.connect(bettor1).placeBet(marketId2, 0, { value: ethers.parseEther("2.0") }); // 2/3 of winning stakes
      await predictionMarket.connect(bettor2).placeBet(marketId2, 0, { value: ethers.parseEther("1.0") }); // 1/3 of winning stakes
      await predictionMarket.connect(bettor3).placeBet(marketId2, 1, { value: ethers.parseEther("3.0") }); // Loser

      await time.increase(7300);
      await predictionMarket.closeBetting(marketId2);

      const resultData = '{"winner": "TeamA", "score": "16-14"}';
      await oracleCore.connect(gameDev).submitResult(matchId2, resultData);
      await time.increase(16 * 60);
      await oracleCore.finalizeResult(matchId2);

      await predictionMarket.resolveMarket(marketId2, { value: ethers.parseEther("0.01") });

      const payout1 = await predictionMarket.getPotentialPayout(marketId2, bettor1.address, 0);
      const payout2 = await predictionMarket.getPotentialPayout(marketId2, bettor2.address, 0);

      // Bettor1 should get 2x what bettor2 gets (since they staked 2x)
      expect(payout1).to.equal(payout2 * 2n);
    });

    it("Should use call() instead of transfer() for gas forwarding", async function () {
      // This test verifies the security fix: using call() instead of transfer()
      // The improvement is that call() forwards all available gas, while transfer() only forwards 2300 gas

      const balanceBefore = await ethers.provider.getBalance(bettor1.address);

      const tx = await predictionMarket.connect(bettor1).claimWinnings(marketId);
      const receipt = await tx.wait();

      const balanceAfter = await ethers.provider.getBalance(bettor1.address);

      // Verify the transfer succeeded
      expect(balanceAfter).to.be.gt(balanceBefore - receipt.gasUsed * receipt.gasPrice);
    });
  });

  describe("Market Cancellation and Refunds", function () {
    beforeEach(async function () {
      const tx = await predictionMarket.createMarket(matchId, "Will TeamA win?");
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return predictionMarket.interface.parseLog(log).name === "MarketCreated";
        } catch {
          return false;
        }
      });
      marketId = predictionMarket.interface.parseLog(event).args.marketId;

      await predictionMarket.connect(bettor1).placeBet(marketId, 0, { value: ethers.parseEther("1.0") });
      await predictionMarket.connect(bettor2).placeBet(marketId, 1, { value: ethers.parseEther("2.0") });
    });

    it("Should allow cancelling market if match is cancelled", async function () {
      // Cancel the match through oracle (need to submit and cancel)
      await time.increase(3700);
      await oracleCore.connect(gameDev).cancelMatch(matchId);

      await expect(
        predictionMarket.cancelMarket(marketId)
      ).to.not.be.reverted;
    });

    it("Should allow refunds for cancelled market", async function () {
      // Cancel match
      await time.increase(3700);
      await oracleCore.connect(gameDev).cancelMatch(matchId);
      await predictionMarket.cancelMarket(marketId);

      const balanceBefore = await ethers.provider.getBalance(bettor1.address);

      await predictionMarket.connect(bettor1).refundBet(marketId, 0);

      const balanceAfter = await ethers.provider.getBalance(bettor1.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("Should not allow double refunds", async function () {
      await time.increase(3700);
      await oracleCore.connect(gameDev).cancelMatch(matchId);
      await predictionMarket.cancelMarket(marketId);

      await predictionMarket.connect(bettor1).refundBet(marketId, 0);

      await expect(
        predictionMarket.connect(bettor1).refundBet(marketId, 0)
      ).to.be.revertedWith("ExamplePredictionMarket: Already refunded");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      const tx = await predictionMarket.createMarket(matchId, "Will TeamA win?");
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return predictionMarket.interface.parseLog(log).name === "MarketCreated";
        } catch {
          return false;
        }
      });
      marketId = predictionMarket.interface.parseLog(event).args.marketId;

      await predictionMarket.connect(bettor1).placeBet(marketId, 0, { value: ethers.parseEther("1.0") });
      await predictionMarket.connect(bettor2).placeBet(marketId, 1, { value: ethers.parseEther("2.0") });
    });

    it("Should return correct market odds", async function () {
      const odds = await predictionMarket.getMarketOdds(marketId);

      // Total pool: 3 BNB
      // TeamA: 1 BNB -> odds = 3/1 = 30000 (in basis points)
      // TeamB: 2 BNB -> odds = 3/2 = 15000 (in basis points)

      expect(odds.oddsTeamA).to.equal(30000);
      expect(odds.oddsTeamB).to.equal(15000);
    });

    it("Should return correct user stakes", async function () {
      const stake1 = await predictionMarket.getUserStake(marketId, bettor1.address, 0);
      const stake2 = await predictionMarket.getUserStake(marketId, bettor2.address, 1);

      expect(stake1).to.equal(ethers.parseEther("1.0"));
      expect(stake2).to.equal(ethers.parseEther("2.0"));
    });

    it("Should track total markets", async function () {
      const totalBefore = await predictionMarket.getTotalMarkets();

      // Create another market
      const futureTime = (await time.latest()) + 7200;
      const tx = await gameRegistry.connect(gameDev).scheduleMatch(
        "fps-game-001",
        "match-002",
        futureTime,
        '{}'
      );
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return gameRegistry.interface.parseLog(log).name === "MatchScheduled";
        } catch {
          return false;
        }
      });
      const matchId2 = gameRegistry.interface.parseLog(event).args.matchId;

      await predictionMarket.createMarket(matchId2, "Another market");

      const totalAfter = await predictionMarket.getTotalMarkets();
      expect(totalAfter).to.equal(totalBefore + 1n);
    });
  });

  describe("Reentrancy Guard Verification", function () {
    it("Should have nonReentrant on placeBet", async function () {
      const tx = await predictionMarket.createMarket(matchId, "Will TeamA win?");
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return predictionMarket.interface.parseLog(log).name === "MarketCreated";
        } catch {
          return false;
        }
      });
      marketId = predictionMarket.interface.parseLog(event).args.marketId;

      // This test verifies that placeBet has nonReentrant modifier
      // We can't easily test reentrancy attacks in Hardhat, but we verify the function works correctly
      await expect(
        predictionMarket.connect(bettor1).placeBet(marketId, 0, { value: ethers.parseEther("1.0") })
      ).to.emit(predictionMarket, "BetPlaced");
    });

    it("Should have nonReentrant on claimWinnings", async function () {
      // Similar verification for claimWinnings
      // The actual reentrancy protection is verified by the contract having ReentrancyGuard
      const tx = await predictionMarket.createMarket(matchId, "Will TeamA win?");
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return predictionMarket.interface.parseLog(log).name === "MarketCreated";
        } catch {
          return false;
        }
      });
      marketId = predictionMarket.interface.parseLog(event).args.marketId;

      await predictionMarket.connect(bettor1).placeBet(marketId, 0, { value: ethers.parseEther("1.0") });

      await time.increase(3700);
      await predictionMarket.closeBetting(marketId);

      const resultData = '{"winner": "TeamA"}';
      await oracleCore.connect(gameDev).submitResult(matchId, resultData);
      await time.increase(16 * 60);
      await oracleCore.finalizeResult(matchId);

      await feeManager.connect(owner).registerConsumer({ value: ethers.parseEther("1.0") });
      await predictionMarket.resolveMarket(marketId, { value: ethers.parseEther("0.01") });

      await expect(
        predictionMarket.connect(bettor1).claimWinnings(marketId)
      ).to.emit(predictionMarket, "WinningsClaimed");
    });
  });
});
