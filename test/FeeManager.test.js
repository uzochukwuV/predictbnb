const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("FeeManager with Security Fixes", function () {
  let gameRegistry, schemaRegistry, oracleCore, feeManager;
  let owner, gameDev, consumer1, consumer2, attacker;
  let matchId;

  const REGISTRATION_STAKE = ethers.parseEther("0.1");
  const MIN_DEPOSIT = ethers.parseEther("0.01");
  const BASE_QUERY_FEE = ethers.parseEther("0.003");

  beforeEach(async function () {
    [owner, gameDev, consumer1, consumer2, attacker] = await ethers.getSigners();

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

    // Set FeeManager in OracleCore
    await oracleCore.setFeeManager(await feeManager.getAddress());

    // Transfer GameRegistry ownership to OracleCore
    await gameRegistry.transferOwnership(await oracleCore.getAddress());

    // Register game and schedule match
    await gameRegistry.connect(gameDev).registerGame(
      "fps-game-001",
      "Test FPS Game",
      1, // FPS
      { value: REGISTRATION_STAKE }
    );

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

    // Fast forward past match time
    await time.increase(3700);

    // Submit and finalize a result for testing
    const resultData = '{"winner": "TeamA", "score": "16-14"}';
    await oracleCore.connect(gameDev).submitResult(matchId, resultData);
    await time.increase(16 * 60); // Past dispute window
    await oracleCore.finalizeResult(matchId);
  });

  describe("Minimum Deposit Requirement (Sybil Attack Prevention)", function () {
    it("Should require minimum 0.01 BNB deposit to register", async function () {
      await expect(
        feeManager.connect(consumer1).registerConsumer({ value: ethers.parseEther("0.009") })
      ).to.be.revertedWith("FeeManager: Minimum 0.01 BNB deposit required");
    });

    it("Should allow registration with exactly 0.01 BNB", async function () {
      await expect(
        feeManager.connect(consumer1).registerConsumer({ value: MIN_DEPOSIT })
      ).to.emit(feeManager, "ConsumerRegistered");

      const consumer = await feeManager.getConsumer(consumer1.address);
      expect(consumer.balance).to.equal(MIN_DEPOSIT);
      expect(consumer.isActive).to.be.true;
    });

    it("Should allow registration with more than 0.01 BNB", async function () {
      const deposit = ethers.parseEther("1.0");
      await feeManager.connect(consumer1).registerConsumer({ value: deposit });

      const consumer = await feeManager.getConsumer(consumer1.address);
      expect(consumer.balance).to.equal(deposit);
    });

    it("Should prevent double registration", async function () {
      await feeManager.connect(consumer1).registerConsumer({ value: MIN_DEPOSIT });

      await expect(
        feeManager.connect(consumer1).registerConsumer({ value: MIN_DEPOSIT })
      ).to.be.revertedWith("FeeManager: Already registered");
    });

    it("Should apply volume bonus on initial deposit", async function () {
      // Tier 1: 10 BNB = 5% bonus
      const deposit = ethers.parseEther("10");
      const expectedBonus = (deposit * 500n) / 10000n; // 5% = 0.5 BNB
      const expectedBalance = deposit + expectedBonus;

      await expect(
        feeManager.connect(consumer1).registerConsumer({ value: deposit })
      ).to.emit(feeManager, "BalanceDeposited")
        .withArgs(consumer1.address, deposit, expectedBonus, expectedBalance);

      const consumer = await feeManager.getConsumer(consumer1.address);
      expect(consumer.balance).to.equal(expectedBalance);
    });
  });

  describe("Payment-Before-Data Security Fix", function () {
    beforeEach(async function () {
      // Register consumer with balance
      await feeManager.connect(consumer1).registerConsumer({ value: ethers.parseEther("1.0") });
    });

    it("Should deduct payment BEFORE returning data", async function () {
      const consumerBefore = await feeManager.getConsumer(consumer1.address);
      const balanceBefore = consumerBefore.balance;

      // Use up free queries first
      const FREE_QUERIES = 50;
      for (let i = 0; i < FREE_QUERIES; i++) {
        await feeManager.connect(consumer1).queryResult(matchId);
      }

      const consumerAfterFree = await feeManager.getConsumer(consumer1.address);
      expect(consumerAfterFree.balance).to.equal(balanceBefore); // No balance change for free queries

      // Next query should cost BASE_QUERY_FEE
      await feeManager.connect(consumer1).queryResult(matchId);

      const consumerAfterPaid = await feeManager.getConsumer(consumer1.address);
      expect(consumerAfterPaid.balance).to.equal(balanceBefore - BASE_QUERY_FEE);
    });

    it("Should prevent query with insufficient balance", async function () {
      // Register consumer with minimal balance
      await feeManager.connect(consumer2).registerConsumer({ value: MIN_DEPOSIT });

      // Use up free queries
      const FREE_QUERIES = 50;
      for (let i = 0; i < FREE_QUERIES; i++) {
        await feeManager.connect(consumer2).queryResult(matchId);
      }

      // Try more queries until balance is insufficient
      // 0.01 BNB / 0.003 BNB per query = ~3 queries
      await feeManager.connect(consumer2).queryResult(matchId);
      await feeManager.connect(consumer2).queryResult(matchId);
      await feeManager.connect(consumer2).queryResult(matchId);

      // Next query should fail (insufficient balance)
      await expect(
        feeManager.connect(consumer2).queryResult(matchId)
      ).to.be.revertedWith("FeeManager: Insufficient balance. Please deposit funds.");
    });

    it("Should track query counts correctly", async function () {
      await feeManager.connect(consumer1).queryResult(matchId);
      await feeManager.connect(consumer1).queryResult(matchId);

      const consumer = await feeManager.getConsumer(consumer1.address);
      expect(consumer.totalQueriesMade).to.equal(2);
      expect(consumer.dailyQueriesUsed).to.equal(2);
    });

    it("Should emit QueryFeePaid event with correct data", async function () {
      // Use up free queries
      const FREE_QUERIES = 50;
      for (let i = 0; i < FREE_QUERIES; i++) {
        await feeManager.connect(consumer1).queryResult(matchId);
      }

      const consumerBefore = await feeManager.getConsumer(consumer1.address);
      const expectedRemainingBalance = consumerBefore.balance - BASE_QUERY_FEE;

      await expect(
        feeManager.connect(consumer1).queryResult(matchId)
      ).to.emit(feeManager, "QueryFeePaid")
        .withArgs(
          consumer1.address,
          matchId,
          "fps-game-001",
          BASE_QUERY_FEE,
          expectedRemainingBalance
        );
    });
  });

  describe("Batch Query Payment-Before-Data", function () {
    let matchId2, matchId3;

    beforeEach(async function () {
      // Register consumer with large balance
      await feeManager.connect(consumer1).registerConsumer({ value: ethers.parseEther("10.0") });

      // Create additional matches
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
      matchId2 = gameRegistry.interface.parseLog(event2).args.matchId;

      const tx3 = await gameRegistry.connect(gameDev).scheduleMatch(
        "fps-game-001",
        "match-003",
        futureTime,
        '{"map": "Inferno"}'
      );
      const receipt3 = await tx3.wait();
      const event3 = receipt3.logs.find(log => {
        try {
          return gameRegistry.interface.parseLog(log).name === "MatchScheduled";
        } catch {
          return false;
        }
      });
      matchId3 = gameRegistry.interface.parseLog(event3).args.matchId;

      // Fast forward and finalize all matches
      await time.increase(7300);
      const resultData = '{"winner": "TeamA", "score": "16-14"}';

      await oracleCore.connect(gameDev).submitResult(matchId2, resultData);
      await oracleCore.connect(gameDev).submitResult(matchId3, resultData);

      await time.increase(16 * 60);
      await oracleCore.finalizeResult(matchId2);
      await oracleCore.finalizeResult(matchId3);
    });

    it("Should calculate and deduct total fee BEFORE returning any data", async function () {
      const consumerBefore = await feeManager.getConsumer(consumer1.address);
      const balanceBefore = consumerBefore.balance;

      // Use up free queries
      const FREE_QUERIES = 50;
      for (let i = 0; i < FREE_QUERIES; i++) {
        await feeManager.connect(consumer1).queryResult(matchId);
      }

      // Batch query 3 matches (all should be paid)
      const matchIds = [matchId, matchId2, matchId3];
      await feeManager.connect(consumer1).batchQueryResults(matchIds);

      const consumerAfter = await feeManager.getConsumer(consumer1.address);
      const expectedDeduction = BASE_QUERY_FEE * 3n;

      expect(consumerAfter.balance).to.equal(balanceBefore - expectedDeduction);
      expect(consumerAfter.totalQueriesMade).to.equal(53); // 50 free + 3 paid
    });

    it("Should prevent batch query with insufficient balance", async function () {
      // Register consumer with minimal balance
      await feeManager.connect(consumer2).registerConsumer({ value: MIN_DEPOSIT });

      // Use up free queries
      const FREE_QUERIES = 50;
      for (let i = 0; i < FREE_QUERIES; i++) {
        await feeManager.connect(consumer2).queryResult(matchId);
      }

      // Try to batch query 10 matches (would need 0.03 BNB, but only has 0.01 BNB)
      const matchIds = Array(10).fill(matchId);

      await expect(
        feeManager.connect(consumer2).batchQueryResults(matchIds)
      ).to.be.revertedWith("FeeManager: Insufficient balance for batch query");
    });

    it("Should handle mixed free and paid queries in batch", async function () {
      const consumerBefore = await feeManager.getConsumer(consumer1.address);
      const balanceBefore = consumerBefore.balance;

      // Use 48 free queries (leaving 2 free)
      for (let i = 0; i < 48; i++) {
        await feeManager.connect(consumer1).queryResult(matchId);
      }

      // Batch query 5 matches: 2 free + 3 paid
      const matchIds = [matchId, matchId, matchId, matchId2, matchId3];
      await feeManager.connect(consumer1).batchQueryResults(matchIds);

      const consumerAfter = await feeManager.getConsumer(consumer1.address);
      const expectedDeduction = BASE_QUERY_FEE * 3n; // Only 3 paid queries

      expect(consumerAfter.balance).to.equal(balanceBefore - expectedDeduction);
      expect(consumerAfter.dailyQueriesUsed).to.equal(50); // All free queries used
      expect(consumerAfter.totalQueriesMade).to.equal(53);
    });

    it("Should enforce maximum batch size", async function () {
      const matchIds = Array(51).fill(matchId); // 51 matches (max is 50)

      await expect(
        feeManager.connect(consumer1).batchQueryResults(matchIds)
      ).to.be.revertedWith("FeeManager: Too many queries");
    });

    it("Should reject empty batch array", async function () {
      await expect(
        feeManager.connect(consumer1).batchQueryResults([])
      ).to.be.revertedWith("FeeManager: Empty array");
    });
  });

  describe("Daily Free Queries Reset", function () {
    beforeEach(async function () {
      await feeManager.connect(consumer1).registerConsumer({ value: ethers.parseEther("1.0") });
    });

    it("Should reset daily queries after 24 hours", async function () {
      // Use some free queries
      await feeManager.connect(consumer1).queryResult(matchId);
      await feeManager.connect(consumer1).queryResult(matchId);

      let consumer = await feeManager.getConsumer(consumer1.address);
      expect(consumer.dailyQueriesUsed).to.equal(2);

      // Fast forward 24 hours
      await time.increase(24 * 60 * 60);

      // Next query should reset the counter
      await feeManager.connect(consumer1).queryResult(matchId);

      consumer = await feeManager.getConsumer(consumer1.address);
      expect(consumer.dailyQueriesUsed).to.equal(1); // Reset to 1 (from the query we just made)
    });

    it("Should return correct remaining free queries", async function () {
      // No queries yet
      let remaining = await feeManager.getRemainingFreeQueries(consumer1.address);
      expect(remaining).to.equal(50);

      // Use 10 queries
      for (let i = 0; i < 10; i++) {
        await feeManager.connect(consumer1).queryResult(matchId);
      }

      remaining = await feeManager.getRemainingFreeQueries(consumer1.address);
      expect(remaining).to.equal(40);

      // Use all remaining
      for (let i = 0; i < 40; i++) {
        await feeManager.connect(consumer1).queryResult(matchId);
      }

      remaining = await feeManager.getRemainingFreeQueries(consumer1.address);
      expect(remaining).to.equal(0);
    });
  });

  describe("Revenue Distribution", function () {
    beforeEach(async function () {
      await feeManager.connect(consumer1).registerConsumer({ value: ethers.parseEther("10.0") });

      // Use up free queries
      const FREE_QUERIES = 50;
      for (let i = 0; i < FREE_QUERIES; i++) {
        await feeManager.connect(consumer1).queryResult(matchId);
      }
    });

    it("Should distribute revenue correctly (80% dev, 15% protocol, 5% disputer)", async function () {
      const treasuryBefore = await feeManager.protocolTreasury();
      const disputerPoolBefore = await feeManager.disputerPool();

      // Make a paid query
      await expect(
        feeManager.connect(consumer1).queryResult(matchId)
      ).to.emit(feeManager, "RevenueDistributed");

      const devRevenue = await feeManager.getDeveloperRevenue(gameDev.address);
      const treasuryAfter = await feeManager.protocolTreasury();
      const disputerPoolAfter = await feeManager.disputerPool();

      const expectedDevShare = (BASE_QUERY_FEE * 8000n) / 10000n; // 80%
      const expectedProtocolShare = (BASE_QUERY_FEE * 1500n) / 10000n; // 15%
      const expectedDisputerShare = (BASE_QUERY_FEE * 500n) / 10000n; // 5%

      expect(devRevenue.totalEarned).to.equal(expectedDevShare);
      expect(devRevenue.pendingWithdrawal).to.equal(expectedDevShare);
      expect(treasuryAfter - treasuryBefore).to.equal(expectedProtocolShare);
      expect(disputerPoolAfter - disputerPoolBefore).to.equal(expectedDisputerShare);
    });

    it("Should allow developer to withdraw revenue", async function () {
      // Make multiple paid queries
      for (let i = 0; i < 10; i++) {
        await feeManager.connect(consumer1).queryResult(matchId);
      }

      const devRevenue = await feeManager.getDeveloperRevenue(gameDev.address);
      const pendingAmount = devRevenue.pendingWithdrawal;

      expect(pendingAmount).to.be.gt(0);

      const balanceBefore = await ethers.provider.getBalance(gameDev.address);

      await expect(
        feeManager.connect(gameDev).withdrawRevenue()
      ).to.emit(feeManager, "DeveloperWithdrawal")
        .withArgs(gameDev.address, pendingAmount);

      const balanceAfter = await ethers.provider.getBalance(gameDev.address);
      expect(balanceAfter).to.be.gt(balanceBefore);

      const devRevenueAfter = await feeManager.getDeveloperRevenue(gameDev.address);
      expect(devRevenueAfter.pendingWithdrawal).to.equal(0);
      expect(devRevenueAfter.totalWithdrawn).to.equal(pendingAmount);
    });
  });

  describe("Volume Bonus Calculation", function () {
    it("Should calculate 5% bonus for 10 BNB deposit (Tier 1)", async function () {
      const deposit = ethers.parseEther("10");
      const bonus = await feeManager.calculateDepositBonus(deposit);
      const expectedBonus = (deposit * 500n) / 10000n; // 5%

      expect(bonus).to.equal(expectedBonus);
    });

    it("Should calculate 10% bonus for 50 BNB deposit (Tier 2)", async function () {
      const deposit = ethers.parseEther("50");
      const bonus = await feeManager.calculateDepositBonus(deposit);
      const expectedBonus = (deposit * 1000n) / 10000n; // 10%

      expect(bonus).to.equal(expectedBonus);
    });

    it("Should calculate 15% bonus for 100 BNB deposit (Tier 3)", async function () {
      const deposit = ethers.parseEther("100");
      const bonus = await feeManager.calculateDepositBonus(deposit);
      const expectedBonus = (deposit * 1500n) / 10000n; // 15%

      expect(bonus).to.equal(expectedBonus);
    });

    it("Should return 0 bonus for deposits below 10 BNB", async function () {
      const deposit = ethers.parseEther("5");
      const bonus = await feeManager.calculateDepositBonus(deposit);

      expect(bonus).to.equal(0);
    });
  });

  describe("Balance Deposit and Withdrawal", function () {
    beforeEach(async function () {
      await feeManager.connect(consumer1).registerConsumer({ value: MIN_DEPOSIT });
    });

    it("Should allow depositing additional balance", async function () {
      const consumerBefore = await feeManager.getConsumer(consumer1.address);
      const balanceBefore = consumerBefore.balance;

      const depositAmount = ethers.parseEther("5");
      await feeManager.connect(consumer1).depositBalance({ value: depositAmount });

      const consumerAfter = await feeManager.getConsumer(consumer1.address);
      expect(consumerAfter.balance).to.equal(balanceBefore + depositAmount);
    });

    it("Should allow withdrawing unused balance", async function () {
      // Deposit more
      await feeManager.connect(consumer1).depositBalance({ value: ethers.parseEther("1.0") });

      const consumerBefore = await feeManager.getConsumer(consumer1.address);
      const withdrawAmount = ethers.parseEther("0.5");

      const ethBalanceBefore = await ethers.provider.getBalance(consumer1.address);

      await expect(
        feeManager.connect(consumer1).withdrawBalance(withdrawAmount)
      ).to.emit(feeManager, "BalanceWithdrawn");

      const consumerAfter = await feeManager.getConsumer(consumer1.address);
      expect(consumerAfter.balance).to.equal(consumerBefore.balance - withdrawAmount);

      const ethBalanceAfter = await ethers.provider.getBalance(consumer1.address);
      expect(ethBalanceAfter).to.be.gt(ethBalanceBefore);
    });

    it("Should prevent withdrawing more than balance", async function () {
      const consumer = await feeManager.getConsumer(consumer1.address);
      const excessiveAmount = consumer.balance + ethers.parseEther("1.0");

      await expect(
        feeManager.connect(consumer1).withdrawBalance(excessiveAmount)
      ).to.be.revertedWith("FeeManager: Insufficient balance");
    });
  });
});
